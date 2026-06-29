import type { BookingConfirmation } from "@/types";
import { getSettings } from "./settings";
import { getStudioConfig } from "./studio";
import type { AppointmentMessageKind } from "./email";

/**
 * SMS / WhatsApp notifications via the Twilio REST API (fetch only — no SDK).
 * Every send is a no-op (skipped) unless Twilio is enabled and configured in
 * Settings, so booking and messaging never fail when texting is off.
 */

export type SmsResult = { ok: boolean; skipped?: boolean; error?: string };

function normalizeNumber(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  // Keep a leading + and digits only.
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  return cleaned;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const { twilio } = (await getSettings()).integrations;

  if (!twilio.enabled || !twilio.accountSid || !twilio.authToken) {
    return { ok: false, skipped: true };
  }

  const isWhatsApp = twilio.channel === "whatsapp";
  const from = isWhatsApp ? twilio.whatsappFrom : twilio.smsFrom;

  if (!from || !to) {
    return { ok: false, skipped: true };
  }

  const toNumber = normalizeNumber(to);
  const toFormatted = isWhatsApp ? (toNumber.startsWith("whatsapp:") ? toNumber : `whatsapp:${toNumber}`) : toNumber;
  const fromFormatted = isWhatsApp ? (from.startsWith("whatsapp:") ? from : `whatsapp:${normalizeNumber(from)}`) : normalizeNumber(from);

  const params = new URLSearchParams({ To: toFormatted, From: fromFormatted, Body: body });
  const auth = Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString("base64");

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      return { ok: false, error: data.message ?? `Twilio responded ${response.status}.` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Twilio request failed." };
  }
}

function whenText(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
}

export async function sendBookingSms(booking: BookingConfirmation): Promise<SmsResult> {
  if (!booking.clientPhone) return { ok: false, skipped: true };
  const studio = await getStudioConfig();
  const body = `${studio.name}: your ${booking.serviceName} appointment is booked for ${whenText(booking.startAt, studio.timezone)}. Reply or call ${studio.phone} to make changes.`;
  return sendSms(booking.clientPhone, body);
}

export async function sendAppointmentMessageSms(
  booking: BookingConfirmation,
  kind: AppointmentMessageKind,
  customMessage?: string,
): Promise<SmsResult> {
  if (!booking.clientPhone) return { ok: false, skipped: true };
  const studio = await getStudioConfig();
  const when = whenText(booking.startAt, studio.timezone);

  let body: string;
  if (kind === "reminder") {
    body = `${studio.name} reminder: ${booking.serviceName} on ${when}. See you soon!`;
  } else if (kind === "cancellation") {
    body = `${studio.name}: your ${booking.serviceName} appointment on ${when} was cancelled. Reply to rebook.`;
  } else {
    body = customMessage?.trim() || `${studio.name}: an update about your ${booking.serviceName} appointment on ${when}.`;
  }

  return sendSms(booking.clientPhone, body);
}
