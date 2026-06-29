import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { getReadyPool, queryRows } from "./db";
import { readStore, writeStore } from "./demo-store";
import { getDataDir } from "./data-dir";
import { SESSION_COOKIE } from "./session-constants";

/**
 * Dependency-free auth: scrypt password hashing + HMAC-signed session cookies.
 * Accounts live in Postgres (`accounts`) when available, else the JSON demo
 * store. Two roles: `admin` (studio owner) and `client` (booking portal).
 */

export type Role = "admin" | "client";

export type StoredAccount = {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
};

export type Session = {
  sub: string;
  email: string;
  name: string;
  role: Role;
  exp: number;
};

export { SESSION_COOKIE };
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const secretPath = path.join(getDataDir(), "auth-secret");

function scrypt(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCb(password, salt, 32, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt);
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  try {
    const salt = Buffer.from(parts[1], "base64");
    const expected = Buffer.from(parts[2], "base64");
    const derived = await scrypt(password, salt);
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

// -- Session secret (env → persisted file/db → generated) -------------------

let secretCache: string | null = null;

async function getAuthSecret(): Promise<string> {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (secretCache) return secretCache;

  const pool = await getReadyPool();
  if (pool) {
    const rows = await queryRows<{ value: { secret: string } }>(
      `select value from app_settings where key = 'auth_secret' limit 1`,
    );
    if (rows?.[0]?.value?.secret) {
      secretCache = rows[0].value.secret;
      return secretCache;
    }
    const generated = randomBytes(32).toString("hex");
    const inserted = await pool.query<{ value: { secret: string } }>(
      `insert into app_settings (key, value) values ('auth_secret', $1::jsonb)
       on conflict (key) do update set value = app_settings.value
       returning value`,
      [JSON.stringify({ secret: generated })],
    );
    const persisted = inserted.rows[0]?.value?.secret;
    if (!persisted) throw new Error("Unable to create a persistent session secret.");
    secretCache = persisted;
    return persisted;
  }

  try {
    secretCache = (await readFile(secretPath, "utf8")).trim();
    if (secretCache) return secretCache;
  } catch {
    // fall through to generate
  }

  const generated = randomBytes(32).toString("hex");
  await mkdir(path.dirname(secretPath), { recursive: true });
  await writeFile(secretPath, generated, "utf8");
  secretCache = generated;
  return generated;
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

export async function createSessionToken(session: Session): Promise<string> {
  const secret = await getAuthSecret();
  const payload = base64url(JSON.stringify(session));
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const secret = await getAuthSecret();
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (typeof session.exp !== "number" || session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

function sessionFor(account: StoredAccount): Session {
  return {
    sub: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
}

// -- Cookie helpers (route handlers / server actions) -----------------------

export async function startSession(account: StoredAccount): Promise<void> {
  const token = await createSessionToken(sessionFor(account));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** Page guard: redirect to the admin login unless an admin is signed in. */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin/login");
  return session;
}

/** Page guard: redirect to the client login unless a client is signed in. */
export async function requireClient(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/account/login");
  return session;
}

// -- Account store ----------------------------------------------------------

type AccountRow = {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: Role;
  passwordHash: string;
  createdAt: Date;
};

function rowToAccount(row: AccountRow): StoredAccount {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function findAccountByEmail(email: string): Promise<StoredAccount | null> {
  const normalized = email.trim().toLowerCase();

  const rows = await queryRows<AccountRow>(
    `select id::text, email, name, phone, role, password_hash as "passwordHash", created_at as "createdAt"
     from accounts where lower(email) = $1 limit 1`,
    [normalized],
  );

  if (rows) {
    return rows[0] ? rowToAccount(rows[0]) : null;
  }

  const store = await readStore();
  return (store.accounts ?? []).find((account) => account.email.toLowerCase() === normalized) ?? null;
}

export type NewAccount = {
  email: string;
  name: string;
  phone?: string;
  password: string;
  role: Role;
};

export async function createAccount(input: NewAccount): Promise<StoredAccount> {
  const email = input.email.trim().toLowerCase();
  const existing = await findAccountByEmail(email);
  if (existing) throw new Error("An account with that email already exists.");

  const passwordHash = await hashPassword(input.password);

  const rows = await queryRows<AccountRow>(
    `insert into accounts (email, name, phone, role, password_hash)
     values ($1, $2, $3, $4, $5)
     returning id::text, email, name, phone, role, password_hash as "passwordHash", created_at as "createdAt"`,
    [email, input.name, input.phone ?? "", input.role, passwordHash],
  );

  if (rows) {
    if (!rows[0]) throw new Error("Unable to create account.");
    return rowToAccount(rows[0]);
  }

  const account: StoredAccount = {
    id: randomUUID(),
    email,
    name: input.name,
    phone: input.phone ?? "",
    role: input.role,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  const store = await readStore();
  // Re-check just before writing (the JSON store has no atomic unique constraint).
  const existingNow = (store.accounts ?? []).find((item) => item.email.toLowerCase() === email);
  if (existingNow) return existingNow;
  store.accounts = [...(store.accounts ?? []), account];
  await writeStore(store);
  return account;
}

export async function updateAccountPassword(email: string, password: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  const rows = await queryRows<{ id: string }>(
    `update accounts set password_hash = $2 where lower(email) = $1 returning id::text`,
    [normalized, passwordHash],
  );

  if (rows) return;

  const store = await readStore();
  const account = (store.accounts ?? []).find((item) => item.email.toLowerCase() === normalized);
  if (account) {
    account.passwordHash = passwordHash;
    await writeStore(store);
  }
}

export async function authenticate(email: string, password: string): Promise<StoredAccount | null> {
  const account = await findAccountByEmail(email);
  if (!account) {
    // Equalize timing so a missing account isn't distinguishable from a bad password.
    await verifyPassword(password, `scrypt$${randomBytes(16).toString("base64")}$${randomBytes(32).toString("base64")}`);
    return null;
  }
  const ok = await verifyPassword(password, account.passwordHash);
  return ok ? account : null;
}

/**
 * Make sure an admin account exists. Seeds from ADMIN_EMAIL / ADMIN_PASSWORD,
 * falling back to the studio owner email + a default password. Returns the
 * seeded credentials only when it actually created one (so the UI can warn).
 */
export async function ensureAdminSeed(ownerEmail: string): Promise<{ created: boolean; email: string; password?: string }> {
  const email = (process.env.ADMIN_EMAIL || ownerEmail || "admin@studio.local").trim().toLowerCase();
  const existing = await findAccountByEmail(email);
  if (existing && existing.role === "admin") return { created: false, email };

  const password = process.env.ADMIN_PASSWORD || "admin1234";

  if (existing) {
    // Promote an existing (client) account to admin and reset password to the seed.
    await updateAccountPassword(email, password);
    const rows = await queryRows(`update accounts set role = 'admin' where lower(email) = $1`, [email]);
    if (!rows) {
      const store = await readStore();
      const account = (store.accounts ?? []).find((item) => item.email.toLowerCase() === email);
      if (account) {
        account.role = "admin";
        await writeStore(store);
      }
    }
    return { created: true, email, password };
  }

  await createAccount({ email, name: "Studio Admin", password, role: "admin" });
  return { created: true, email, password };
}
