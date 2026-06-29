import nodemailer from "nodemailer";
import type { AdminAppointment, BookingConfirmation, EmailDelivery } from "@/types";
import { getReadyPool, queryRows } from "./db";
import { readStore, writeStore } from "./demo-store";
import { getSettings, type AppSettings, type SmtpConfig } from "./settings";
import { getStudioConfig, type StudioConfig } from "./studio";

type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  appointmentId?: string;
};

export type AppointmentMessageKind = "reminder" | "cancellation" | "custom";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function appointmentWhen(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function calendarUrl(booking: BookingConfirmation) {
  const start = new Date(booking.startAt);
  const end = new Date(start.getTime() + booking.durationMinutes * 60 * 1000);
  const format = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const url = new URL("https://calendar.google.com/calendar/render");

  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", `${booking.serviceName} at ${booking.locationName}`);
  url.searchParams.set("dates", `${format(start)}/${format(end)}`);
  url.searchParams.set("details", `Appointment for ${booking.clientName}. Notes: ${booking.notes || "n/a"}`);
  url.searchParams.set("location", booking.locationAddress);

  return url.toString();
}

function section(title: string, body: string) {
  return `
    <tr>
      <td style="padding: 12px 0 0;">
        <div style="font-size: 18px; font-weight: 800; color: #343034; margin-bottom: 8px;">${title}</div>
        <div style="font-size: 17px; line-height: 1.55; color: #3f3a3d;">${body}</div>
      </td>
    </tr>
  `;
}

function mapCard(booking: BookingConfirmation, studio: StudioConfig) {
  if (studio.mapImageUrl) {
    return `
      <a href="${booking.mapsUrl}" style="display: block; text-decoration: none; color: inherit;" target="_blank">
        <img src="${studio.mapImageUrl}" width="560" alt="Map to ${booking.locationName}" style="display: block; width: 100%; max-width: 560px; border: 1px solid #eadfe4; border-radius: 12px; margin-top: 10px;" />
      </a>
    `;
  }

  return `
    <a href="${booking.mapsUrl}" style="display: block; text-decoration: none; color: inherit;" target="_blank">
      <div style="background: linear-gradient(135deg, #fff1f5, #f7fffb); border: 1px solid #eadfe4; border-radius: 12px; margin-top: 10px; padding: 18px;">
        <div style="font-size: 13px; font-weight: 900; letter-spacing: 0.08em; margin-bottom: 8px; text-transform: uppercase;">Map</div>
        <div style="font-size: 16px; font-weight: 800; color: #343034;">${booking.locationName}</div>
        <div style="font-size: 14px; line-height: 1.45; color: #7d6f75; margin-top: 4px;">${booking.locationAddress}</div>
        <div style="background: ${studio.primaryColor}; border-radius: 8px; color: #ffffff; display: inline-block; font-size: 14px; font-weight: 800; margin-top: 12px; padding: 9px 12px;">Open in Maps</div>
      </div>
    </a>
  `;
}

function emailHtml(booking: BookingConfirmation, recipient: "client" | "owner", studio: StudioConfig) {
  const title = recipient === "client" ? "Your appointment has been scheduled" : "New appointment has been scheduled";
  const who =
    recipient === "client"
      ? `<ul style="margin: 0; padding-left: 22px;"><li>${studio.ownerName} - Nail tech</li><li>${booking.clientName} - you</li></ul>`
      : `<ul style="margin: 0; padding-left: 22px;"><li>${studio.ownerName} - Nail tech</li><li>${booking.clientName} - client</li><li>${booking.clientEmail}${booking.clientPhone ? ` - ${booking.clientPhone}` : ""}</li></ul>`;

  return `
    <!doctype html>
    <html>
      <body style="margin: 0; background: #f7f2f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f7f2f4; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px; background: #ffffff; border-radius: 28px; overflow: hidden;">
                <tr>
                  <td style="padding: 32px 28px 24px;">
                    <div style="background: #d5f9e3; border-radius: 999px; color: #03935f; font-size: 42px; height: 86px; line-height: 86px; margin: 0 auto 24px; text-align: center; width: 86px;">&#10003;</div>
                    <h1 style="color: #343034; font-size: 28px; line-height: 1.18; margin: 0 0 22px; text-align: center;">${title}</h1>
                    <div style="border-top: 1px solid #cfc7cb;"></div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      ${section("Appointment", `${booking.serviceName}<br><span style="color: #7d6f75;">${money(booking.priceCents)} &middot; ${booking.durationMinutes} minutes</span>`)}
                      ${section("When", appointmentWhen(booking.startAt, studio.timezone))}
                      ${section("Who", who)}
                      ${section("Where", `${booking.locationName}<br>${booking.locationAddress}${mapCard(booking, studio)}`)}
                      ${section("Additional notes", booking.notes || "n/a")}
                    </table>
                    <div style="border-top: 1px solid #cfc7cb; margin-top: 24px; padding-top: 18px; text-align: center;">
                      <div style="color: #4f484d; font-size: 16px; line-height: 1.5;">Need to make a change? Reply to this email or call <a href="tel:${studio.phone}" style="color: #245ad6;">${studio.phone}</a>.</div>
                      <a href="${calendarUrl(booking)}" target="_blank" style="border: 1px solid #cfc7cb; border-radius: 8px; color: #343034; display: inline-block; font-size: 15px; font-weight: 800; margin-top: 16px; padding: 10px 14px; text-decoration: none;">Add to Google Calendar</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function emailText(booking: BookingConfirmation, recipient: "client" | "owner", studio: StudioConfig) {
  const intro = recipient === "client" ? "Your appointment has been scheduled." : "A new appointment has been scheduled.";

  return [
    intro,
    "",
    `Appointment: ${booking.serviceName}`,
    `When: ${appointmentWhen(booking.startAt, studio.timezone)}`,
    `Client: ${booking.clientName}`,
    `Email: ${booking.clientEmail}`,
    booking.clientPhone ? `Phone: ${booking.clientPhone}` : "",
    `Where: ${booking.locationName}, ${booking.locationAddress}`,
    `Map: ${booking.mapsUrl}`,
    `Notes: ${booking.notes || "n/a"}`,
    "",
    `Need to make a change? Reply to this email or call ${studio.phone}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function recordOutbox(message: EmailMessage, status: "queued" | "sent" | "failed", error?: string) {
  const activePool = await getReadyPool();

  if (activePool) {
    await queryRows(
      `
        insert into email_outbox (appointment_id, recipient, subject, html, text, status, error)
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [message.appointmentId ?? null, message.to, message.subject, message.html, message.text, status, error ?? null],
    );
    return;
  }

  const store = await readStore();
  store.outbox = [
    {
      id: `email-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      status,
      error,
      createdAt: new Date().toISOString(),
      appointmentId: message.appointmentId,
    },
    ...store.outbox,
  ].slice(0, 50);
  await writeStore(store);
}

function hasSmtp(smtp: SmtpConfig) {
  return Boolean(smtp.host && smtp.user && smtp.pass);
}

function hasResend(apiKey: string) {
  return Boolean(apiKey);
}

function hasMailtrap(apiToken: string) {
  return Boolean(apiToken);
}

/** Parse a "Name <email>" line into Mailtrap's {email,name} shape. */
function parseFrom(from: string, fallbackName: string): { email: string; name: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1] || fallbackName, email: match[2].trim() };
  return { name: fallbackName, email: from.trim() };
}

function splitRecipients(to: string): string[] {
  return to.split(/[,;]/).map((value) => value.trim()).filter(Boolean);
}

/** Deduped list of owner/studio addresses that should receive booking + change alerts. */
function ownerRecipients(studio: StudioConfig, settings: AppSettings): string {
  const extra = splitRecipients(settings.location.notifyEmails || "");
  const all = [studio.ownerEmail, ...extra].map((value) => value.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set(all)).join(", ");
}

function emailMode(settings: AppSettings): "mailtrap" | "resend" | "smtp" | "outbox" {
  if (hasMailtrap(settings.integrations.mailtrap.apiToken)) return "mailtrap";
  if (hasResend(settings.integrations.resend.apiKey)) return "resend";
  if (hasSmtp(settings.integrations.smtp)) return "smtp";
  return "outbox";
}

function transporterFor(smtp: SmtpConfig) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 587,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });
}

/** Send one message through the active provider (Resend preferred, else SMTP). Throws on failure. */
async function deliverEmail(settings: AppSettings, studio: StudioConfig, message: EmailMessage) {
  const { resend, smtp, mailtrap } = settings.integrations;

  if (hasMailtrap(mailtrap.apiToken)) {
    const from = parseFrom(mailtrap.from || studio.emailFrom, studio.name);
    const url = mailtrap.inboxId
      ? `https://sandbox.api.mailtrap.io/api/send/${mailtrap.inboxId}`
      : "https://send.api.mailtrap.io/api/send";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Api-Token": mailtrap.apiToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: splitRecipients(message.to).map((email) => ({ email })),
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { errors?: string[]; message?: string };
      throw new Error(data.errors?.join(", ") || data.message || `Mailtrap responded ${response.status}.`);
    }
    return;
  }

  if (hasResend(resend.apiKey)) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resend.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: resend.from || studio.emailFrom,
        to: splitRecipients(message.to),
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(data.message ?? `Resend responded ${response.status}.`);
    }
    return;
  }

  await transporterFor(smtp).sendMail({
    from: studio.emailFrom,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}

function buildMessages(booking: BookingConfirmation, studio: StudioConfig, ownerTo: string): { customer: EmailMessage; owner: EmailMessage } {
  return {
    customer: {
      to: booking.clientEmail,
      subject: `Your ${studio.name} appointment is scheduled`,
      html: emailHtml(booking, "client", studio),
      text: emailText(booking, "client", studio),
      appointmentId: booking.id,
    },
    owner: {
      to: ownerTo,
      subject: `New booking: ${booking.clientName} - ${booking.serviceName}`,
      html: emailHtml(booking, "owner", studio),
      text: emailText(booking, "owner", studio),
      appointmentId: booking.id,
    },
  };
}

function quickMessageCopy(booking: BookingConfirmation, kind: AppointmentMessageKind, studio: StudioConfig, customMessage?: string) {
  if (kind === "reminder") {
    return {
      title: "Appointment reminder",
      subject: `Reminder: your ${studio.name} appointment`,
      body: `This is a friendly reminder for your ${booking.serviceName} appointment on ${appointmentWhen(booking.startAt, studio.timezone)}.`,
    };
  }

  if (kind === "cancellation") {
    return {
      title: "Appointment cancellation",
      subject: `Update about your ${studio.name} appointment`,
      body: `Your ${booking.serviceName} appointment on ${appointmentWhen(booking.startAt, studio.timezone)} has been cancelled. Reply to this email if you want help finding another time.`,
    };
  }

  return {
    title: `Message from ${studio.name}`,
    subject: `Message about your ${studio.name} appointment`,
    body: customMessage?.trim() || `We wanted to send you an update about your ${booking.serviceName} appointment on ${appointmentWhen(booking.startAt, studio.timezone)}.`,
  };
}

function appointmentMessageHtml(booking: BookingConfirmation, kind: AppointmentMessageKind, studio: StudioConfig, customMessage?: string) {
  const copy = quickMessageCopy(booking, kind, studio, customMessage);

  return `
    <!doctype html>
    <html>
      <body style="margin: 0; background: #f7f2f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f7f2f4; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; background: #ffffff; border-radius: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 30px 26px;">
                    <h1 style="color: #343034; font-size: 28px; line-height: 1.18; margin: 0 0 12px;">${copy.title}</h1>
                    <p style="color: #4f484d; font-size: 17px; line-height: 1.55; margin: 0 0 20px;">${copy.body}</p>
                    <div style="border-top: 1px solid #eadfe4; border-bottom: 1px solid #eadfe4; padding: 16px 0;">
                      <div style="font-size: 15px; font-weight: 900; color: #343034;">${booking.serviceName}</div>
                      <div style="font-size: 15px; color: #7d6f75; line-height: 1.55; margin-top: 4px;">${appointmentWhen(booking.startAt, studio.timezone)}<br>${booking.durationMinutes} minutes &middot; ${money(booking.priceCents)}</div>
                    </div>
                    ${section("Where", `${booking.locationName}<br>${booking.locationAddress}${mapCard(booking, studio)}`)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function appointmentMessageText(booking: BookingConfirmation, kind: AppointmentMessageKind, studio: StudioConfig, customMessage?: string) {
  const copy = quickMessageCopy(booking, kind, studio, customMessage);

  return [
    copy.title,
    "",
    copy.body,
    "",
    `Appointment: ${booking.serviceName}`,
    `When: ${appointmentWhen(booking.startAt, studio.timezone)}`,
    `Where: ${booking.locationName}, ${booking.locationAddress}`,
    `Map: ${booking.mapsUrl}`,
  ].join("\n");
}

export async function sendAppointmentMessage(booking: BookingConfirmation, kind: AppointmentMessageKind, customMessage?: string): Promise<EmailDelivery> {
  if (!booking.clientEmail) {
    throw new Error("This appointment does not have a client email.");
  }

  const settings = await getSettings();
  const studio = await getStudioConfig();
  const mode = emailMode(settings);
  const copy = quickMessageCopy(booking, kind, studio, customMessage);
  const message: EmailMessage = {
    to: booking.clientEmail,
    subject: copy.subject,
    html: appointmentMessageHtml(booking, kind, studio, customMessage),
    text: appointmentMessageText(booking, kind, studio, customMessage),
    appointmentId: booking.id,
  };

  if (mode === "outbox") {
    await recordOutbox(message, "queued");

    return {
      mode: "outbox",
      customer: true,
      owner: false,
    };
  }

  try {
    await deliverEmail(settings, studio, message);
    await recordOutbox(message, "sent");

    return {
      mode,
      customer: true,
      owner: false,
    };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Email failed.";
    await recordOutbox(message, "failed", messageText);

    return {
      mode,
      customer: false,
      owner: false,
      errors: [messageText],
    };
  }
}

export async function sendBookingEmails(booking: BookingConfirmation): Promise<EmailDelivery> {
  const settings = await getSettings();
  const studio = await getStudioConfig();
  const mode = emailMode(settings);
  const messages = buildMessages(booking, studio, ownerRecipients(studio, settings));
  const delivery: EmailDelivery = {
    mode,
    customer: false,
    owner: false,
    errors: [],
  };

  if (mode === "outbox") {
    await recordOutbox(messages.customer, "queued");
    await recordOutbox(messages.owner, "queued");

    return {
      mode: "outbox",
      customer: true,
      owner: true,
    };
  }

  for (const [key, message] of Object.entries(messages) as [keyof typeof messages, EmailMessage][]) {
    try {
      await deliverEmail(settings, studio, message);
      delivery[key] = true;
      await recordOutbox(message, "sent");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Email failed.";
      delivery.errors?.push(`${key}: ${messageText}`);
      await recordOutbox(message, "failed", messageText);
    }
  }

  if (!delivery.errors?.length) {
    delete delivery.errors;
  }

  return delivery;
}

/**
 * Notify the studio owner(s) when a client books or changes an appointment.
 * Sends to ownerEmail + any extra notify addresses; queues to the outbox if no
 * provider is configured. Never throws (best-effort).
 */
export async function sendOwnerAppointmentChange(
  appointment: AdminAppointment,
  kind: "booked" | "rescheduled" | "cancelled",
): Promise<void> {
  const settings = await getSettings();
  const studio = await getStudioConfig();
  const to = ownerRecipients(studio, settings);
  if (!to) return;

  const verb = kind === "booked" ? "booked a new appointment" : kind === "rescheduled" ? "rescheduled their appointment" : "cancelled their appointment";
  const subject = `Appointment ${kind}: ${appointment.clientName} - ${appointment.serviceName}`;
  const when = appointmentWhen(appointment.startAt, studio.timezone);
  const lines = [
    `${appointment.clientName} ${verb}.`,
    "",
    `Service: ${appointment.serviceName}`,
    `When: ${when}`,
    `Duration: ${appointment.durationMinutes} minutes`,
    `Price: ${money(appointment.priceCents)}`,
    appointment.clientEmail ? `Client email: ${appointment.clientEmail}` : "",
    appointment.clientPhone ? `Client phone: ${appointment.clientPhone}` : "",
    appointment.notes ? `Notes: ${appointment.notes}` : "",
  ].filter(Boolean);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #343034; line-height: 1.5;">
      <h2 style="margin: 0 0 10px;">Appointment ${kind}</h2>
      ${lines.map((line) => `<p style="margin: 2px 0;">${line || "&nbsp;"}</p>`).join("")}
    </div>
  `;
  const message: EmailMessage = { to, subject, html, text: lines.join("\n"), appointmentId: appointment.id };

  if (emailMode(settings) === "outbox") {
    await recordOutbox(message, "queued");
    return;
  }

  try {
    await deliverEmail(settings, studio, message);
    await recordOutbox(message, "sent");
  } catch (error) {
    await recordOutbox(message, "failed", error instanceof Error ? error.message : "Email failed.");
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Send a promotional email blast to a list of client addresses. */
export async function sendPromotion(
  recipients: string[],
  subject: string,
  message: string,
): Promise<{ sent: number; failed: number; mode: EmailDelivery["mode"] }> {
  const settings = await getSettings();
  const studio = await getStudioConfig();
  const mode = emailMode(settings);
  const bodyHtml = escapeHtml(message).replace(/\n/g, "<br>");
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #343034; line-height: 1.6; max-width: 560px;">
      <h2 style="color: ${studio.primaryColor};">${escapeHtml(studio.name)}</h2>
      <p>${bodyHtml}</p>
      <p style="color: #7d6f75; font-size: 13px; margin-top: 18px;">${escapeHtml(studio.locationName)} · ${escapeHtml(studio.phone)}</p>
    </div>
  `;

  let sent = 0;
  let failed = 0;

  for (const to of recipients) {
    const email: EmailMessage = { to, subject, html, text: message };
    if (mode === "outbox") {
      await recordOutbox(email, "queued");
      sent += 1;
      continue;
    }
    try {
      await deliverEmail(settings, studio, email);
      await recordOutbox(email, "sent");
      sent += 1;
    } catch (error) {
      await recordOutbox(email, "failed", error instanceof Error ? error.message : "Email failed.");
      failed += 1;
    }
  }

  return { sent, failed, mode };
}

/** Verify a specific SMTP config without sending a real email. */
export async function testSmtp(smtp: SmtpConfig): Promise<{ ok: boolean; error?: string; configured: boolean }> {
  if (!hasSmtp(smtp)) return { ok: false, configured: false };

  try {
    await transporterFor(smtp).verify();
    return { ok: true, configured: true };
  } catch (error) {
    return { ok: false, configured: true, error: error instanceof Error ? error.message : "SMTP verification failed." };
  }
}

/**
 * Test the active email provider. Resend → sends a real test email to the owner;
 * SMTP → verifies the connection. Returns which provider was used.
 */
export async function testEmail(): Promise<{ ok: boolean; configured: boolean; provider?: "mailtrap" | "resend" | "smtp"; error?: string }> {
  const settings = await getSettings();
  const studio = await getStudioConfig();
  const { resend, smtp, mailtrap } = settings.integrations;
  const to = ownerRecipients(studio, settings) || studio.ownerEmail;
  const testMessage = (provider: string): EmailMessage => ({
    to,
    subject: `${studio.name} email is connected`,
    html: `<p>Your ${studio.name} booking emails are connected through ${provider}. You're all set.</p>`,
    text: `Your ${studio.name} booking emails are connected through ${provider}. You're all set.`,
  });

  if (hasMailtrap(mailtrap.apiToken)) {
    try {
      await deliverEmail(settings, studio, testMessage("Mailtrap"));
      return { ok: true, configured: true, provider: "mailtrap" };
    } catch (error) {
      return { ok: false, configured: true, provider: "mailtrap", error: error instanceof Error ? error.message : "Mailtrap test failed." };
    }
  }

  if (hasResend(resend.apiKey)) {
    try {
      await deliverEmail(settings, studio, testMessage("Resend"));
      return { ok: true, configured: true, provider: "resend" };
    } catch (error) {
      return { ok: false, configured: true, provider: "resend", error: error instanceof Error ? error.message : "Resend test failed." };
    }
  }

  if (hasSmtp(smtp)) {
    try {
      await transporterFor(smtp).verify();
      await deliverEmail(settings, studio, testMessage("Gmail"));
      return { ok: true, configured: true, provider: "smtp" };
    } catch (error) {
      return { ok: false, configured: true, provider: "smtp", error: error instanceof Error ? error.message : "SMTP send failed." };
    }
  }

  return { ok: false, configured: false };
}
