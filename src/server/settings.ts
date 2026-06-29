import type { Promotion } from "@/types";
import { getReadyPool, queryRows } from "./db";
import { readStore, writeStore } from "./demo-store";

/**
 * Persistent, admin-editable configuration for the whole site.
 *
 * Stored in Postgres (`app_settings` row keyed `site`) when a database is
 * available, otherwise in the JSON demo store. Defaults are derived from the
 * environment so an existing `.env.local` keeps working with zero setup, and
 * anything the studio owner edits in the admin panel overrides those defaults.
 */

export type WeekdayHours = {
  open: boolean;
  openMinutes: number;
  closeMinutes: number;
};

export type BusinessHours = {
  // Index 0 = Sunday … 6 = Saturday.
  days: WeekdayHours[];
  slotStepMinutes: number;
};

export type ManualReview = {
  id: string;
  author: string;
  rating: number;
  text: string;
  date?: string;
  avatarUrl?: string;
};

export type Branding = {
  studioName: string;
  ownerName: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
};

export type SiteContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutBody: string;
  bookingNote: string;
  footerNote: string;
};

export type LocationInfo = {
  locationName: string;
  address: string;
  phone: string;
  email: string;
  ownerEmail: string;
  /** Extra addresses (comma-separated) that also get booking + change notifications. */
  notifyEmails: string;
  emailFrom: string;
  timezone: string;
  instagramUrl: string;
  mapImageUrl: string;
};

export type ReviewsConfig = {
  mode: "manual" | "google";
  headlineRating: number;
  totalCount: number;
  googlePlaceId: string;
  manual: ManualReview[];
};

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export type ResendConfig = {
  apiKey: string;
  from: string;
};

export type MailtrapConfig = {
  apiToken: string;
  // When set, emails are captured in the Mailtrap testing inbox (not delivered).
  // When empty, the Mailtrap Sending API delivers real emails.
  inboxId: string;
  from: string;
};

export type InstagramConfig = {
  userId: string;
  accessToken: string;
  graphVersion: string;
};

export type PinterestConfig = {
  accessToken: string;
  boardId: string;
  boardName: string;
  profileName: string;
  profileUrl: string;
};

export type StripeConfig = {
  mode: "off" | "deposit" | "full";
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  depositCents: number;
};

export type GoogleConfig = {
  placesApiKey: string;
  mapsStaticApiKey: string;
};

export type TwilioConfig = {
  enabled: boolean;
  channel: "sms" | "whatsapp";
  accountSid: string;
  authToken: string;
  smsFrom: string;
  whatsappFrom: string;
};

export type Integrations = {
  smtp: SmtpConfig;
  resend: ResendConfig;
  mailtrap: MailtrapConfig;
  stripe: StripeConfig;
  google: GoogleConfig;
  twilio: TwilioConfig;
  instagram: InstagramConfig;
  pinterest: PinterestConfig;
};

export type AppSettings = {
  branding: Branding;
  content: SiteContent;
  location: LocationInfo;
  hours: BusinessHours;
  reviews: ReviewsConfig;
  promotions: Promotion[];
  integrations: Integrations;
};

const SETTINGS_KEY = "site";

function env(name: string, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function defaultWeek(): WeekdayHours[] {
  // Open Mon–Sat 9:00–18:00, closed Sunday (matches the studio's original hours).
  const open = { open: true, openMinutes: 9 * 60, closeMinutes: 18 * 60 };
  const closed = { open: false, openMinutes: 9 * 60, closeMinutes: 18 * 60 };
  return [
    { ...closed }, // Sun
    { ...open }, // Mon
    { ...open }, // Tue
    { ...open }, // Wed
    { ...open }, // Thu
    { ...open }, // Fri
    { ...open }, // Sat
  ];
}

export function defaultSettings(): AppSettings {
  const studioName = env("STUDIO_NAME", "Nunez Nails");
  const ownerName = env("STUDIO_OWNER_NAME", "Gisela");
  const ownerEmail = env("STUDIO_OWNER_EMAIL", env("STUDIO_EMAIL", "hello@nuneznails.com"));
  const address = env("STUDIO_ADDRESS", "123 Beauty Lane, Houston, TX 77001");

  return {
    branding: {
      studioName,
      ownerName,
      tagline: "Private nail studio",
      primaryColor: "#ef8ca2",
      accentColor: "#03935f",
      logoUrl: "",
    },
    content: {
      heroEyebrow: "Private nail appointments in a calm studio",
      heroTitle: "Book nails that feel personal from the first tap.",
      heroSubtitle:
        "A Booksy-style experience for clients who want quick scheduling, clear prices, real availability, and a nail tech who remembers every detail.",
      aboutTitle: `Meet ${ownerName}`,
      aboutBody:
        "A private, one-on-one nail studio focused on healthy nails, clean work, and long-lasting gel. Every appointment is unhurried and just for you.",
      bookingNote: "Choose your services, pick a time, and you're booked. You'll get a confirmation right away.",
      footerNote: "Private nail care with simple booking, personalized notes, and modern client follow-up.",
    },
    location: {
      locationName: env("STUDIO_LOCATION_NAME", `${studioName} Private Studio`),
      address,
      phone: env("STUDIO_PHONE", "(555) 123-4567"),
      email: env("STUDIO_EMAIL", ownerEmail),
      ownerEmail,
      notifyEmails: env("STUDIO_NOTIFY_EMAILS"),
      emailFrom: env("EMAIL_FROM", `${studioName} <${ownerEmail}>`),
      timezone: env("STUDIO_TIMEZONE", "America/Chicago"),
      instagramUrl: "",
      mapImageUrl: "",
    },
    hours: {
      days: defaultWeek(),
      slotStepMinutes: 30,
    },
    reviews: {
      mode: "manual",
      headlineRating: 5,
      totalCount: 0,
      googlePlaceId: "",
      manual: [],
    },
    promotions: [],
    integrations: {
      smtp: {
        host: env("SMTP_HOST"),
        port: Number(env("SMTP_PORT", "587")) || 587,
        secure: env("SMTP_SECURE") === "true",
        user: env("SMTP_USER"),
        pass: env("SMTP_PASS"),
        from: env("EMAIL_FROM", `${studioName} <${ownerEmail}>`),
      },
      resend: {
        apiKey: env("RESEND_API_KEY"),
        from: env("RESEND_FROM", env("EMAIL_FROM", `${studioName} <${ownerEmail}>`)),
      },
      mailtrap: {
        apiToken: env("MAILTRAP_API_TOKEN"),
        inboxId: env("MAILTRAP_INBOX_ID"),
        from: env("MAILTRAP_FROM", env("EMAIL_FROM", `${studioName} <${ownerEmail}>`)),
      },
      stripe: {
        mode: env("STRIPE_SECRET_KEY") ? "deposit" : "off",
        secretKey: env("STRIPE_SECRET_KEY"),
        publishableKey: env("STRIPE_PUBLISHABLE_KEY"),
        webhookSecret: env("STRIPE_WEBHOOK_SECRET"),
        depositCents: Number(env("STRIPE_DEPOSIT_CENTS", "2000")) || 2000,
      },
      google: {
        placesApiKey: env("GOOGLE_PLACES_API_KEY"),
        mapsStaticApiKey: env("GOOGLE_MAPS_STATIC_API_KEY"),
      },
      twilio: {
        enabled: Boolean(env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN")),
        channel: "sms",
        accountSid: env("TWILIO_ACCOUNT_SID"),
        authToken: env("TWILIO_AUTH_TOKEN"),
        smsFrom: env("TWILIO_SMS_FROM"),
        whatsappFrom: env("TWILIO_WHATSAPP_FROM"),
      },
      instagram: {
        userId: env("INSTAGRAM_USER_ID"),
        accessToken: env("INSTAGRAM_ACCESS_TOKEN"),
        graphVersion: env("INSTAGRAM_GRAPH_VERSION", "v23.0"),
      },
      pinterest: {
        accessToken: env("PINTEREST_ACCESS_TOKEN"),
        boardId: env("PINTEREST_BOARD_ID"),
        boardName: env("PINTEREST_BOARD_NAME", "Nail Inspo"),
        profileName: env("PINTEREST_PROFILE_NAME", studioName),
        profileUrl: env("PINTEREST_PROFILE_URL"),
      },
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep-merge `patch` over `base`. Arrays and scalars replace; objects merge. */
function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch === undefined ? base : (patch as T));
  }

  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = (base as Record<string, unknown>)[key];
    result[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }

  return result as T;
}

async function readStored(): Promise<Partial<AppSettings> | null> {
  const rows = await queryRows<{ value: Partial<AppSettings> }>(
    `select value from app_settings where key = $1 limit 1`,
    [SETTINGS_KEY],
  );

  if (rows) {
    return rows[0]?.value ?? null;
  }

  const store = await readStore();
  return store.settings ?? null;
}

let cache: { value: AppSettings; at: number } | null = null;
const CACHE_MS = 2000;

export async function getSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.value;
  }

  const stored = await readStored();
  const merged = deepMerge(defaultSettings(), stored ?? {});

  // Business hours must always be a 7-day array; repair if a stored blob is malformed.
  if (!Array.isArray(merged.hours.days) || merged.hours.days.length !== 7) {
    merged.hours.days = defaultWeek();
  }

  cache = { value: merged, at: Date.now() };
  return merged;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = deepMerge(current, patch);

  if (!Array.isArray(next.hours.days) || next.hours.days.length !== 7) {
    next.hours.days = current.hours.days;
  }

  const pool = await getReadyPool();

  if (pool) {
    await queryRows(
      `
        insert into app_settings (key, value, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (key) do update
          set value = excluded.value,
              updated_at = now()
      `,
      [SETTINGS_KEY, JSON.stringify(next)],
    );
  } else {
    const store = await readStore();
    store.settings = next;
    await writeStore(store);
  }

  cache = { value: next, at: Date.now() };
  return next;
}

/** Force the next getSettings() to re-read (used after seeding / migrations). */
export function invalidateSettingsCache() {
  cache = null;
}

/**
 * Settings safe to expose to the browser / public site: everything except
 * integration secrets. Publishable keys and non-secret config are kept.
 */
export type PublicSettings = {
  branding: Branding;
  content: SiteContent;
  location: LocationInfo;
  hours: BusinessHours;
  reviews: ReviewsConfig;
  promotions: Promotion[];
  payments: { mode: StripeConfig["mode"]; depositCents: number; publishableKey: string };
};

export function toPublicSettings(settings: AppSettings): PublicSettings {
  return {
    branding: settings.branding,
    content: settings.content,
    location: settings.location,
    hours: settings.hours,
    reviews: settings.reviews,
    promotions: (settings.promotions ?? []).filter((promo) => promo.active),
    payments: {
      mode: settings.integrations.stripe.mode,
      depositCents: settings.integrations.stripe.depositCents,
      publishableKey: settings.integrations.stripe.publishableKey,
    },
  };
}

export async function getPublicSettings(): Promise<PublicSettings> {
  return toPublicSettings(await getSettings());
}
