import { createHmac, timingSafeEqual } from "node:crypto";
import { getReadyPool, queryRows } from "./db";
import { readStore, writeStore } from "./demo-store";
import { getSettings } from "./settings";
import { getBookingConfirmation } from "./repository";

/**
 * Stripe Checkout integration via the REST API (fetch only — no SDK dependency).
 * Activates when a secret key is configured in Settings; otherwise every entry
 * point reports "not configured" so booking stays free and unblocked.
 */

export type CheckoutResult = { url: string } | { error: string; configured: boolean };

type PaymentRecord = {
  appointmentId: string;
  sessionId?: string;
  paymentIntent?: string;
  amountCents: number;
  kind: "deposit" | "full";
  status: "pending" | "paid" | "failed" | "refunded";
};

export async function isStripeConfigured(): Promise<boolean> {
  const { stripe } = (await getSettings()).integrations;
  return stripe.mode !== "off" && Boolean(stripe.secretKey);
}

async function recordPayment(record: PaymentRecord) {
  const pool = await getReadyPool();

  if (pool) {
    await queryRows(
      `insert into payments (appointment_id, session_id, payment_intent, amount_cents, kind, status)
       values ($1, $2, $3, $4, $5, $6)`,
      [record.appointmentId, record.sessionId ?? null, record.paymentIntent ?? null, record.amountCents, record.kind, record.status],
    );
    return;
  }

  const store = await readStore();
  store.payments = [
    {
      id: `pay-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      appointmentId: record.appointmentId,
      sessionId: record.sessionId,
      paymentIntent: record.paymentIntent,
      amountCents: record.amountCents,
      kind: record.kind,
      status: record.status,
      createdAt: new Date().toISOString(),
    },
    ...(store.payments ?? []),
  ].slice(0, 100);
  await writeStore(store);
}

async function markPaymentPaid(sessionId: string, paymentIntent?: string) {
  const pool = await getReadyPool();

  if (pool) {
    await queryRows(
      `update payments set status = 'paid', payment_intent = coalesce($2, payment_intent), updated_at = now() where session_id = $1`,
      [sessionId, paymentIntent ?? null],
    );
    return;
  }

  const store = await readStore();
  const payment = (store.payments ?? []).find((item) => item.sessionId === sessionId);
  if (payment) {
    payment.status = "paid";
    if (paymentIntent) payment.paymentIntent = paymentIntent;
    await writeStore(store);
  }
}

/** Create a Stripe Checkout Session for a booking's deposit (or full amount). */
export async function createBookingCheckout(bookingId: string, baseUrl: string): Promise<CheckoutResult> {
  const settings = await getSettings();
  const stripe = settings.integrations.stripe;

  if (stripe.mode === "off" || !stripe.secretKey) {
    return { error: "Online payments are not enabled.", configured: false };
  }

  const booking = await getBookingConfirmation(bookingId);
  if (!booking) {
    return { error: "Booking not found.", configured: true };
  }

  const kind: "deposit" | "full" = stripe.mode === "full" ? "full" : "deposit";
  const fullDue = Math.max(0, booking.priceCents - (booking.discountCents ?? 0));
  const amount = kind === "full" ? fullDue : Math.max(50, stripe.depositCents);
  const label = kind === "full" ? `Payment — ${booking.serviceName}` : `Deposit — ${booking.serviceName}`;

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${baseUrl}/booking-confirmed?booking=${encodeURIComponent(bookingId)}&paid=1`);
  params.set("cancel_url", `${baseUrl}/booking-confirmed?booking=${encodeURIComponent(bookingId)}`);
  if (booking.clientEmail) params.set("customer_email", booking.clientEmail);
  params.set("metadata[bookingId]", bookingId);
  params.set("metadata[kind]", kind);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(amount));
  params.set("line_items[0][price_data][product_data][name]", label);

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripe.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };

    if (!response.ok || !data.url) {
      return { error: data.error?.message ?? "Stripe could not create a checkout.", configured: true };
    }

    await recordPayment({ appointmentId: bookingId, sessionId: data.id, amountCents: amount, kind, status: "pending" });
    return { url: data.url };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Stripe request failed.", configured: true };
  }
}

/** Verify a Stripe webhook signature (t=…,v1=… scheme) and return the event. */
export async function handleWebhook(rawBody: string, signatureHeader: string | null): Promise<{ ok: boolean; error?: string }> {
  const stripe = (await getSettings()).integrations.stripe;

  if (!stripe.webhookSecret) {
    return { ok: false, error: "Webhook secret not configured." };
  }

  const parts = Object.fromEntries((signatureHeader ?? "").split(",").map((kv) => kv.split("=") as [string, string]));
  const timestamp = parts["t"];
  const provided = parts["v1"];

  if (!timestamp || !provided) {
    return { ok: false, error: "Missing signature." };
  }

  const expected = createHmac("sha256", stripe.webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "Invalid signature." };
  }

  try {
    const event = JSON.parse(rawBody) as { type: string; data: { object: { id: string; payment_intent?: string } } };
    if (event.type === "checkout.session.completed") {
      await markPaymentPaid(event.data.object.id, event.data.object.payment_intent);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid event payload." };
  }
}
