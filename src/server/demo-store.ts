import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDir, isEphemeralServerlessRuntime } from "./data-dir";
import type { AdminNotification, Appointment, Expense, Service } from "@/types";
import type { AppSettings } from "./settings";
import type { StoredAccount } from "./auth";
import { demoServices } from "./demo-data";

type DemoStore = {
  services: Service[];
  availabilityOverrides: Record<string, Record<string, boolean>>;
  appointments: {
    id: string;
    serviceIds: string[];
    serviceName: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    appointmentAt: string;
    durationMinutes: number;
    priceCents: number;
    tipCents?: number;
    discountCents?: number;
    promoCode?: string;
    status?: Appointment["status"];
    notes?: string;
  }[];
  expenses?: Expense[];
  notifications: AdminNotification[];
  outbox: {
    id: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    status?: "queued" | "sent" | "failed";
    error?: string;
    createdAt: string;
    appointmentId?: string;
  }[];
  settings?: AppSettings;
  accounts?: StoredAccount[];
  clientReviews?: {
    id: string;
    name: string;
    email: string;
    rating: number;
    text: string;
    appointmentId?: string;
    createdAt: string;
  }[];
  payments?: {
    id: string;
    appointmentId?: string;
    sessionId?: string;
    paymentIntent?: string;
    amountCents: number;
    kind: "deposit" | "full";
    status: "pending" | "paid" | "failed" | "refunded";
    createdAt: string;
  }[];
};

const storePath = path.join(getDataDir(), "demo-store.json");

const initialStore: DemoStore = {
  services: demoServices,
  availabilityOverrides: {
    default: {
      "10:30": false,
      "12:00": false,
      "15:30": false,
    },
  },
  appointments: [],
  notifications: [],
  outbox: [],
  accounts: [],
};

async function ensureStore() {
  await mkdir(path.dirname(storePath), { recursive: true });

  try {
    await readFile(storePath, "utf8");
  } catch {
    await writeFile(storePath, JSON.stringify(initialStore, null, 2), "utf8");
  }
}

export async function readStore(): Promise<DemoStore> {
  await ensureStore();

  try {
    const raw = await readFile(storePath, "utf8");
    const store = JSON.parse(raw) as DemoStore;

    return {
      ...initialStore,
      ...store,
      services: Array.isArray(store.services) ? store.services : initialStore.services,
      availabilityOverrides: {
        ...initialStore.availabilityOverrides,
        ...(store.availabilityOverrides ?? {}),
      },
      appointments: store.appointments ?? [],
      notifications: store.notifications ?? [],
      outbox: store.outbox ?? [],
      settings: store.settings,
      accounts: store.accounts ?? [],
      clientReviews: store.clientReviews ?? [],
      payments: store.payments ?? [],
      expenses: store.expenses ?? [],
    };
  } catch {
    return initialStore;
  }
}

export async function writeStore(store: DemoStore) {
  if (isEphemeralServerlessRuntime()) {
    throw new Error(
      "Persistent storage is unavailable on this deployment. Configure DATABASE_URL in Vercel and redeploy.",
    );
  }

  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export function slugifyServiceName(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || `service-${Date.now()}`;
}
