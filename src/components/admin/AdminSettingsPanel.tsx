"use client";

import { useEffect, useState } from "react";
import { Save, Mail, Plus, Trash2, KeyRound, Database } from "lucide-react";
import type { Promotion } from "@/types";
import type {
  AppSettings,
  Branding,
  GoogleConfig,
  InstagramConfig,
  LocationInfo,
  MailtrapConfig,
  ManualReview,
  PinterestConfig,
  ResendConfig,
  ReviewsConfig,
  SiteContent,
  SmtpConfig,
  StripeConfig,
  TwilioConfig,
} from "@/server/settings";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function minutesToTime(value: number) {
  const h = String(Math.floor(value / 60)).padStart(2, "0");
  const m = String(value % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AdminSettingsPanel({ initialSettings }: { initialSettings: AppSettings }) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [smtpTest, setSmtpTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [dbInfo, setDbInfo] = useState<{ configured: boolean; ready: boolean } | null>(null);
  const [dbStatus, setDbStatus] = useState("");

  useEffect(() => {
    fetch("/api/admin/db")
      .then((r) => r.json())
      .then((d) => setDbInfo(d))
      .catch(() => undefined);
  }, []);

  async function initDb() {
    setDbStatus("Creating tables…");
    const response = await fetch("/api/admin/db", { method: "POST" });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (response.ok) {
      setDbStatus("Tables created. Your data now saves to Postgres.");
      fetch("/api/admin/db").then((r) => r.json()).then((d) => setDbInfo(d)).catch(() => undefined);
    } else {
      setDbStatus(payload.error ?? "Could not reach the database.");
    }
  }

  function patchBranding(patch: Partial<Branding>) {
    setSettings((s) => ({ ...s, branding: { ...s.branding, ...patch } }));
  }
  function patchContent(patch: Partial<SiteContent>) {
    setSettings((s) => ({ ...s, content: { ...s.content, ...patch } }));
  }
  function patchLocation(patch: Partial<LocationInfo>) {
    setSettings((s) => ({ ...s, location: { ...s.location, ...patch } }));
  }
  function patchReviews(patch: Partial<ReviewsConfig>) {
    setSettings((s) => ({ ...s, reviews: { ...s.reviews, ...patch } }));
  }
  function patchHoursDay(index: number, patch: Partial<AppSettings["hours"]["days"][number]>) {
    setSettings((s) => {
      const days = s.hours.days.map((day, i) => (i === index ? { ...day, ...patch } : day));
      return { ...s, hours: { ...s.hours, days } };
    });
  }
  function patchSmtp(patch: Partial<SmtpConfig>) {
    setSettings((s) => ({ ...s, integrations: { ...s.integrations, smtp: { ...s.integrations.smtp, ...patch } } }));
  }
  function patchResend(patch: Partial<ResendConfig>) {
    setSettings((s) => ({ ...s, integrations: { ...s.integrations, resend: { ...s.integrations.resend, ...patch } } }));
  }
  function patchMailtrap(patch: Partial<MailtrapConfig>) {
    setSettings((s) => ({ ...s, integrations: { ...s.integrations, mailtrap: { ...s.integrations.mailtrap, ...patch } } }));
  }
  function patchInstagram(patch: Partial<InstagramConfig>) {
    setSettings((s) => ({ ...s, integrations: { ...s.integrations, instagram: { ...s.integrations.instagram, ...patch } } }));
  }
  function patchPinterest(patch: Partial<PinterestConfig>) {
    setSettings((s) => ({ ...s, integrations: { ...s.integrations, pinterest: { ...s.integrations.pinterest, ...patch } } }));
  }
  function patchStripe(patch: Partial<StripeConfig>) {
    setSettings((s) => ({ ...s, integrations: { ...s.integrations, stripe: { ...s.integrations.stripe, ...patch } } }));
  }
  function patchGoogle(patch: Partial<GoogleConfig>) {
    setSettings((s) => ({ ...s, integrations: { ...s.integrations, google: { ...s.integrations.google, ...patch } } }));
  }
  function patchTwilio(patch: Partial<TwilioConfig>) {
    setSettings((s) => ({ ...s, integrations: { ...s.integrations, twilio: { ...s.integrations.twilio, ...patch } } }));
  }

  function addPromotion() {
    const promo: Promotion = { id: uid(), code: "", label: "", kind: "percent", value: 10, active: true };
    setSettings((s) => ({ ...s, promotions: [...(s.promotions ?? []), promo] }));
  }
  function updatePromotion(id: string, patch: Partial<Promotion>) {
    setSettings((s) => ({ ...s, promotions: (s.promotions ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }
  function removePromotion(id: string) {
    setSettings((s) => ({ ...s, promotions: (s.promotions ?? []).filter((p) => p.id !== id) }));
  }

  function addReview() {
    const review: ManualReview = { id: uid(), author: "", rating: 5, text: "" };
    patchReviews({ manual: [...settings.reviews.manual, review] });
  }
  function updateReview(id: string, patch: Partial<ManualReview>) {
    patchReviews({ manual: settings.reviews.manual.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }
  function removeReview(id: string) {
    patchReviews({ manual: settings.reviews.manual.filter((r) => r.id !== id) });
  }

  async function save() {
    setSaving(true);
    setStatus("");
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const payload = (await response.json()) as { settings?: AppSettings; error?: string };
    if (response.ok && payload.settings) {
      setSettings(payload.settings);
      setStatus("Saved. Your site is updated.");
    } else {
      setStatus(payload.error ?? "Could not save settings.");
    }
    setSaving(false);
  }

  async function testEmail() {
    setSmtpTest(null);
    // Save first so the test uses the values currently on screen.
    await save();
    const response = await fetch("/api/admin/settings/test-email", { method: "POST" });
    const payload = (await response.json()) as { ok: boolean; configured: boolean; provider?: string; error?: string };
    if (payload.ok) {
      setSmtpTest({ ok: true, message: payload.provider === "resend" ? "Connected. A test email was sent to your owner address — check your inbox." : "Connected. Emails will send." });
    } else if (!payload.configured) {
      setSmtpTest({ ok: false, message: "Add a Resend API key, or SMTP host/user/password, first." });
    } else if (payload.error && /not verified|domain/i.test(payload.error)) {
      setSmtpTest({ ok: false, message: "Resend rejected your From address: it must use a domain you verified at resend.com/domains. A Gmail/Yahoo From won't work — clear the Resend key and use Option B (Gmail) instead, or verify your own domain." });
    } else {
      setSmtpTest({ ok: false, message: payload.error ?? "Could not connect." });
    }
  }

  async function changePassword() {
    setPasswordStatus("");
    if (newPassword.length < 8) {
      setPasswordStatus("Password must be at least 8 characters.");
      return;
    }
    const response = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    if (response.ok) {
      setPasswordStatus("Admin password updated.");
      setNewPassword("");
    } else {
      const payload = (await response.json()) as { error?: string };
      setPasswordStatus(payload.error ?? "Could not update password.");
    }
  }

  const { branding, content, location, reviews, hours, integrations } = settings;

  return (
    <div className="settings-wrap">
      <h1>Site settings</h1>
      <p className="settings-lede">Edit your website text, hours, reviews, and integrations — no code needed.</p>

      {status ? <p className="settings-status">{status}</p> : null}

      {/* Branding */}
      <section className="settings-section">
        <h2>Branding</h2>
        <p className="section-note">Studio name, colors, and logo used across the site and emails.</p>
        <div className="settings-grid">
          <label className="settings-field">Studio name
            <input value={branding.studioName} onChange={(e) => patchBranding({ studioName: e.target.value })} />
          </label>
          <label className="settings-field">Owner / nail tech name
            <input value={branding.ownerName} onChange={(e) => patchBranding({ ownerName: e.target.value })} />
          </label>
          <label className="settings-field">Tagline
            <input value={branding.tagline} onChange={(e) => patchBranding({ tagline: e.target.value })} />
          </label>
          <label className="settings-field">Logo image URL
            <input value={branding.logoUrl} onChange={(e) => patchBranding({ logoUrl: e.target.value })} placeholder="https://…" />
          </label>
          <label className="settings-field">Primary color
            <input type="color" value={branding.primaryColor} onChange={(e) => patchBranding({ primaryColor: e.target.value })} />
          </label>
          <label className="settings-field">Accent color
            <input type="color" value={branding.accentColor} onChange={(e) => patchBranding({ accentColor: e.target.value })} />
          </label>
        </div>
      </section>

      {/* Homepage content */}
      <section className="settings-section">
        <h2>Homepage text</h2>
        <p className="section-note">The words customers read on your booking site.</p>
        <div className="settings-grid">
          <label className="settings-field">Hero eyebrow
            <input value={content.heroEyebrow} onChange={(e) => patchContent({ heroEyebrow: e.target.value })} />
          </label>
          <label className="settings-field">Hero title
            <input value={content.heroTitle} onChange={(e) => patchContent({ heroTitle: e.target.value })} />
          </label>
          <label className="settings-field full">Hero subtitle
            <textarea value={content.heroSubtitle} onChange={(e) => patchContent({ heroSubtitle: e.target.value })} />
          </label>
          <label className="settings-field">About title
            <input value={content.aboutTitle} onChange={(e) => patchContent({ aboutTitle: e.target.value })} />
          </label>
          <label className="settings-field">Booking note
            <input value={content.bookingNote} onChange={(e) => patchContent({ bookingNote: e.target.value })} />
          </label>
          <label className="settings-field full">About text
            <textarea value={content.aboutBody} onChange={(e) => patchContent({ aboutBody: e.target.value })} />
          </label>
          <label className="settings-field full">Footer note
            <input value={content.footerNote} onChange={(e) => patchContent({ footerNote: e.target.value })} />
          </label>
        </div>
      </section>

      {/* Location */}
      <section className="settings-section">
        <h2>Location &amp; contact</h2>
        <p className="section-note">Shown on the site, in confirmation emails, and on the map.</p>
        <div className="settings-grid">
          <label className="settings-field">Location name
            <input value={location.locationName} onChange={(e) => patchLocation({ locationName: e.target.value })} />
          </label>
          <label className="settings-field">Phone
            <input value={location.phone} onChange={(e) => patchLocation({ phone: e.target.value })} />
          </label>
          <label className="settings-field full">Address
            <input value={location.address} onChange={(e) => patchLocation({ address: e.target.value })} />
          </label>
          <label className="settings-field">Public email
            <input value={location.email} onChange={(e) => patchLocation({ email: e.target.value })} />
          </label>
          <label className="settings-field">Owner email (gets booking alerts)
            <input value={location.ownerEmail} onChange={(e) => patchLocation({ ownerEmail: e.target.value })} />
          </label>
          <label className="settings-field full">Also notify these emails (comma-separated)
            <input value={location.notifyEmails} onChange={(e) => patchLocation({ notifyEmails: e.target.value })} placeholder="second@email.com, third@email.com" />
            <small>Booking, reschedule, and cancellation alerts go to the owner email plus everyone listed here.</small>
          </label>
          <label className="settings-field">From address (emails)
            <input value={location.emailFrom} onChange={(e) => patchLocation({ emailFrom: e.target.value })} />
          </label>
          <label className="settings-field">Timezone
            <input value={location.timezone} onChange={(e) => patchLocation({ timezone: e.target.value })} placeholder="America/Chicago" />
          </label>
          <label className="settings-field full">Instagram URL
            <input value={location.instagramUrl} onChange={(e) => patchLocation({ instagramUrl: e.target.value })} placeholder="https://instagram.com/…" />
          </label>
        </div>
      </section>

      {/* Business hours */}
      <section className="settings-section">
        <h2>Business hours</h2>
        <p className="section-note">Customers can only book inside these windows. Closed days show no times.</p>
        {hours.days.map((day, index) => (
          <div className="hours-row" key={index}>
            <span className="day-name">{DAYS[index]}</span>
            <label className="hours-toggle">
              <input type="checkbox" checked={day.open} onChange={(e) => patchHoursDay(index, { open: e.target.checked })} />
              {day.open ? "Open" : "Closed"}
            </label>
            <label className="settings-field">Opens
              <input type="time" step={1800} value={minutesToTime(day.openMinutes)} disabled={!day.open}
                onChange={(e) => patchHoursDay(index, { openMinutes: timeToMinutes(e.target.value) })} />
            </label>
            <label className="settings-field">Closes
              <input type="time" step={1800} value={minutesToTime(day.closeMinutes)} disabled={!day.open}
                onChange={(e) => patchHoursDay(index, { closeMinutes: timeToMinutes(e.target.value) })} />
            </label>
          </div>
        ))}
        <div className="settings-grid" style={{ marginTop: 14 }}>
          <label className="settings-field">Time slot size (minutes)
            <select value={hours.slotStepMinutes} onChange={(e) => setSettings((s) => ({ ...s, hours: { ...s.hours, slotStepMinutes: Number(e.target.value) } }))}>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </label>
        </div>
      </section>

      {/* Reviews */}
      <section className="settings-section">
        <h2>Reviews</h2>
        <p className="section-note">Show your own testimonials, or pull live Google reviews (needs a Google Places API key below).</p>
        <div className="settings-grid">
          <label className="settings-field">Source
            <select value={reviews.mode} onChange={(e) => patchReviews({ mode: e.target.value as ReviewsConfig["mode"] })}>
              <option value="manual">Manual (I'll type them)</option>
              <option value="google">Google reviews (live)</option>
            </select>
          </label>
          <label className="settings-field">Headline rating
            <input type="number" min={0} max={5} step={0.1} value={reviews.headlineRating} onChange={(e) => patchReviews({ headlineRating: Number(e.target.value) })} />
          </label>
          <label className="settings-field">Total review count
            <input type="number" min={0} value={reviews.totalCount} onChange={(e) => patchReviews({ totalCount: Number(e.target.value) })} />
          </label>
          <label className="settings-field">Google Place ID
            <input value={reviews.googlePlaceId} onChange={(e) => patchReviews({ googlePlaceId: e.target.value })} placeholder="ChIJ…" />
          </label>
        </div>

        {reviews.mode === "manual" ? (
          <div style={{ marginTop: 14 }}>
            {reviews.manual.map((review) => (
              <div className="review-row" key={review.id}>
                <div className="review-row-top">
                  <input style={{ flex: 1 }} placeholder="Customer name" value={review.author} onChange={(e) => updateReview(review.id, { author: e.target.value })} />
                  <input type="number" min={1} max={5} style={{ width: 70 }} value={review.rating} onChange={(e) => updateReview(review.id, { rating: Number(e.target.value) })} />
                  <button type="button" className="review-row-remove" onClick={() => removeReview(review.id)}><Trash2 size={15} /></button>
                </div>
                <textarea placeholder="What they said…" value={review.text} onChange={(e) => updateReview(review.id, { text: e.target.value })} />
              </div>
            ))}
            <button type="button" className="settings-secondary" onClick={addReview}><Plus size={15} style={{ verticalAlign: "-3px" }} /> Add review</button>
          </div>
        ) : null}
      </section>

      {/* Promotions */}
      <section className="settings-section">
        <h2>Promotions &amp; deals</h2>
        <p className="section-note">Create promo codes clients can apply at booking. Active deals also show on your site. Percent = % off the total; Amount = dollars off.</p>
        {(settings.promotions ?? []).map((promo) => (
          <div className="review-row" key={promo.id}>
            <div className="review-row-top">
              <input style={{ width: 130, textTransform: "uppercase" }} placeholder="CODE" value={promo.code} onChange={(e) => updatePromotion(promo.id, { code: e.target.value.toUpperCase() })} />
              <input style={{ flex: 1 }} placeholder="Label (e.g. 15% off your first visit)" value={promo.label} onChange={(e) => updatePromotion(promo.id, { label: e.target.value })} />
              <button type="button" className="review-row-remove" onClick={() => removePromotion(promo.id)}><Trash2 size={15} /></button>
            </div>
            <div className="settings-grid">
              <label className="settings-field">Type
                <select value={promo.kind} onChange={(e) => updatePromotion(promo.id, { kind: e.target.value as Promotion["kind"] })}>
                  <option value="percent">Percent (%)</option>
                  <option value="amount">Amount ($)</option>
                </select>
              </label>
              <label className="settings-field">{promo.kind === "percent" ? "Percent off" : "Dollars off"}
                <input
                  type="number"
                  min={0}
                  value={promo.kind === "amount" ? Math.round(promo.value / 100) : promo.value}
                  onChange={(e) => updatePromotion(promo.id, { value: promo.kind === "amount" ? Number(e.target.value) * 100 : Number(e.target.value) })}
                />
              </label>
              <label className="hours-toggle" style={{ alignSelf: "end", paddingBottom: 10 }}>
                <input type="checkbox" checked={promo.active} onChange={(e) => updatePromotion(promo.id, { active: e.target.checked })} />
                Active (shown publicly)
              </label>
            </div>
          </div>
        ))}
        <button type="button" className="settings-secondary" onClick={addPromotion}><Plus size={15} style={{ verticalAlign: "-3px" }} /> Add promotion</button>
      </section>

      {/* Email */}
      <section className="settings-section">
        <h2>Email — confirmations &amp; reminders</h2>
        <p className="section-note">Pick <strong>one</strong> option below, then click <strong>Save &amp; send test email</strong>. If more than one is filled in, Mailtrap wins, then Resend, then Gmail/SMTP. Until one works, emails are saved to a local outbox (not delivered).</p>

        <h3 style={{ fontSize: 14, margin: "4px 0 10px", color: "var(--ink)" }}>Option A — Mailtrap (API token)</h3>
        <p className="section-note" style={{ marginTop: 0 }}>
          Paste your Mailtrap <strong>API token</strong>. Leave <em>Inbox ID</em> blank to send real emails with Mailtrap <strong>Email Sending</strong> (needs a verified domain or Mailtrap&apos;s demo domain in the From line). Add an <em>Inbox ID</em> to use a Mailtrap <strong>testing inbox</strong> — emails are captured there (great for trying things out, not delivered to clients).
        </p>
        <div className="settings-grid">
          <label className="settings-field">Mailtrap API token
            <input type="password" value={integrations.mailtrap.apiToken} onChange={(e) => patchMailtrap({ apiToken: e.target.value })} placeholder="your Mailtrap token" />
          </label>
          <label className="settings-field">Testing Inbox ID (optional)
            <input value={integrations.mailtrap.inboxId} onChange={(e) => patchMailtrap({ inboxId: e.target.value })} placeholder="leave blank to send for real" />
          </label>
          <label className="settings-field full">From line
            <input value={integrations.mailtrap.from} onChange={(e) => patchMailtrap({ from: e.target.value })} placeholder="Nunez Nails <hello@yourdomain.com>" />
          </label>
        </div>

        <h3 style={{ fontSize: 14, margin: "18px 0 10px", color: "var(--ink)" }}>Option B — Resend API (only if you own a domain)</h3>
        <p className="section-note" style={{ marginTop: 0, background: "#fff7e6", border: "1px solid #f3d9a4", borderRadius: 8, padding: "8px 10px" }}>
          ⚠️ Resend can only send from a <strong>domain you verified</strong> at resend.com/domains. A free <code>@gmail.com</code> / <code>@yahoo.com</code> From address will be rejected. If you don&apos;t have your own domain, leave this blank and use <strong>Option B (Gmail)</strong> below.
        </p>
        <div className="settings-grid">
          <label className="settings-field">Resend API key
            <input type="password" value={integrations.resend.apiKey} onChange={(e) => patchResend({ apiKey: e.target.value })} placeholder="re_…" />
          </label>
          <label className="settings-field">From line (must be your verified domain)
            <input value={integrations.resend.from} onChange={(e) => patchResend({ from: e.target.value })} placeholder="Nunez Nails <hello@yourdomain.com>" />
          </label>
        </div>

        <h3 style={{ fontSize: 14, margin: "18px 0 10px", color: "var(--ink)" }}>Option C — Gmail (easiest, no domain needed)</h3>
        <p className="section-note" style={{ marginTop: 0 }}>Sends from your Gmail to clients. In your Google account: turn on 2-Step Verification, create an <strong>App Password</strong>, then enter: host <code>smtp.gmail.com</code>, port <code>465</code>, secure on, username = your Gmail, password = the 16-character app password. <em>Tip: clear the Resend API key above so Gmail is used.</em></p>
        <div className="settings-grid">
          <label className="settings-field">SMTP host
            <input value={integrations.smtp.host} onChange={(e) => patchSmtp({ host: e.target.value })} placeholder="smtp.gmail.com" />
          </label>
          <label className="settings-field">Port
            <input type="number" value={integrations.smtp.port} onChange={(e) => patchSmtp({ port: Number(e.target.value) })} />
          </label>
          <label className="settings-field">Username (email)
            <input value={integrations.smtp.user} onChange={(e) => patchSmtp({ user: e.target.value })} />
          </label>
          <label className="settings-field">App password
            <input type="password" value={integrations.smtp.pass} onChange={(e) => patchSmtp({ pass: e.target.value })} placeholder="16-character app password" />
          </label>
          <label className="settings-field">From line
            <input value={integrations.smtp.from} onChange={(e) => patchSmtp({ from: e.target.value })} placeholder="Studio <you@gmail.com>" />
          </label>
          <label className="hours-toggle" style={{ alignSelf: "end", paddingBottom: 10 }}>
            <input type="checkbox" checked={integrations.smtp.secure} onChange={(e) => patchSmtp({ secure: e.target.checked })} />
            Secure (SSL, port 465)
          </label>
        </div>
        <div style={{ marginTop: 14 }}>
          <button type="button" className="settings-secondary" onClick={testEmail}><Mail size={15} style={{ verticalAlign: "-3px" }} /> Save &amp; send test email</button>
          {smtpTest ? <p className={`settings-test-result ${smtpTest.ok ? "ok" : "bad"}`}>{smtpTest.message}</p> : null}
        </div>
      </section>

      {/* Payments / Stripe */}
      <section className="settings-section">
        <h2>Payments &amp; deposits (Stripe)</h2>
        <p className="section-note">Collect a deposit (or full amount) at booking. Get your keys at dashboard.stripe.com. Leave on "Off" to keep booking free.</p>
        <div className="settings-grid">
          <label className="settings-field">Mode
            <select value={integrations.stripe.mode} onChange={(e) => patchStripe({ mode: e.target.value as StripeConfig["mode"] })}>
              <option value="off">Off (no payment)</option>
              <option value="deposit">Require a deposit</option>
              <option value="full">Require full payment</option>
            </select>
          </label>
          <label className="settings-field">Deposit amount (USD)
            <input type="number" min={0} value={Math.round(integrations.stripe.depositCents / 100)} onChange={(e) => patchStripe({ depositCents: Number(e.target.value) * 100 })} />
          </label>
          <label className="settings-field">Publishable key
            <input value={integrations.stripe.publishableKey} onChange={(e) => patchStripe({ publishableKey: e.target.value })} placeholder="pk_live_…" />
          </label>
          <label className="settings-field">Secret key
            <input type="password" value={integrations.stripe.secretKey} onChange={(e) => patchStripe({ secretKey: e.target.value })} placeholder="sk_live_…" />
          </label>
          <label className="settings-field full">Webhook signing secret
            <input type="password" value={integrations.stripe.webhookSecret} onChange={(e) => patchStripe({ webhookSecret: e.target.value })} placeholder="whsec_…" />
          </label>
        </div>
      </section>

      {/* Google */}
      <section className="settings-section">
        <h2>Google</h2>
        <p className="section-note">Places API key powers live reviews. Maps Static key renders a map image in emails.</p>
        <div className="settings-grid">
          <label className="settings-field">Places API key
            <input type="password" value={integrations.google.placesApiKey} onChange={(e) => patchGoogle({ placesApiKey: e.target.value })} />
          </label>
          <label className="settings-field">Maps Static API key
            <input type="password" value={integrations.google.mapsStaticApiKey} onChange={(e) => patchGoogle({ mapsStaticApiKey: e.target.value })} />
          </label>
        </div>
      </section>

      {/* Instagram */}
      <section className="settings-section">
        <h2>Instagram</h2>
        <p className="section-note">Show her real posts in the website gallery and in the admin Instagram insights. Needs an Instagram <strong>Professional</strong> account linked to a Facebook Page, plus a Graph API token with that business account. Leave empty to show sample posts.</p>
        <div className="settings-grid">
          <label className="settings-field">Instagram Business account ID
            <input value={integrations.instagram.userId} onChange={(e) => patchInstagram({ userId: e.target.value })} placeholder="178…" />
          </label>
          <label className="settings-field">Graph API version
            <input value={integrations.instagram.graphVersion} onChange={(e) => patchInstagram({ graphVersion: e.target.value })} placeholder="v23.0" />
          </label>
          <label className="settings-field full">Access token
            <input type="password" value={integrations.instagram.accessToken} onChange={(e) => patchInstagram({ accessToken: e.target.value })} placeholder="EAA…" />
          </label>
        </div>
      </section>

      {/* Pinterest */}
      <section className="settings-section">
        <h2>Pinterest (Nail Inspo)</h2>
        <p className="section-note">Pulls saved pins into the &quot;Nail Inspo&quot; strip. Create a Pinterest developer app, generate an OAuth token with board/pin read scopes. Leave empty to show sample inspo.</p>
        <div className="settings-grid">
          <label className="settings-field full">Access token
            <input type="password" value={integrations.pinterest.accessToken} onChange={(e) => patchPinterest({ accessToken: e.target.value })} placeholder="pina_…" />
          </label>
          <label className="settings-field">Board ID
            <input value={integrations.pinterest.boardId} onChange={(e) => patchPinterest({ boardId: e.target.value })} />
          </label>
          <label className="settings-field">Board name
            <input value={integrations.pinterest.boardName} onChange={(e) => patchPinterest({ boardName: e.target.value })} />
          </label>
          <label className="settings-field">Profile name
            <input value={integrations.pinterest.profileName} onChange={(e) => patchPinterest({ profileName: e.target.value })} />
          </label>
          <label className="settings-field">Profile URL
            <input value={integrations.pinterest.profileUrl} onChange={(e) => patchPinterest({ profileUrl: e.target.value })} placeholder="https://www.pinterest.com/…" />
          </label>
        </div>
      </section>

      {/* SMS / WhatsApp */}
      <section className="settings-section">
        <h2>SMS &amp; WhatsApp (Twilio)</h2>
        <p className="section-note">Text booking confirmations and reminders. Get credentials at twilio.com. Leave disabled to use email only.</p>
        <div className="settings-grid">
          <label className="hours-toggle" style={{ alignSelf: "end", paddingBottom: 10 }}>
            <input type="checkbox" checked={integrations.twilio.enabled} onChange={(e) => patchTwilio({ enabled: e.target.checked })} />
            Enable text messages
          </label>
          <label className="settings-field">Channel
            <select value={integrations.twilio.channel} onChange={(e) => patchTwilio({ channel: e.target.value as TwilioConfig["channel"] })}>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>
          <label className="settings-field">Account SID
            <input value={integrations.twilio.accountSid} onChange={(e) => patchTwilio({ accountSid: e.target.value })} placeholder="AC…" />
          </label>
          <label className="settings-field">Auth token
            <input type="password" value={integrations.twilio.authToken} onChange={(e) => patchTwilio({ authToken: e.target.value })} />
          </label>
          <label className="settings-field">SMS from number
            <input value={integrations.twilio.smsFrom} onChange={(e) => patchTwilio({ smsFrom: e.target.value })} placeholder="+1…" />
          </label>
          <label className="settings-field">WhatsApp from number
            <input value={integrations.twilio.whatsappFrom} onChange={(e) => patchTwilio({ whatsappFrom: e.target.value })} placeholder="whatsapp:+1…" />
          </label>
        </div>
      </section>

      {/* Admin password */}
      <section className="settings-section">
        <h2>Admin password</h2>
        <p className="section-note">Change the password you use to sign in to this admin.</p>
        <div className="settings-grid">
          <label className="settings-field">New password
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
          </label>
          <div style={{ alignSelf: "end", paddingBottom: 6 }}>
            <button type="button" className="settings-secondary" onClick={changePassword}><KeyRound size={15} style={{ verticalAlign: "-3px" }} /> Update password</button>
          </div>
        </div>
        {passwordStatus ? <p className="settings-test-result ok">{passwordStatus}</p> : null}
      </section>

      {/* Data storage */}
      <section className="settings-section">
        <h2><Database size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Data storage</h2>
        <p className="section-note">
          {dbInfo == null
            ? "Checking database…"
            : !dbInfo.configured
              ? "No DATABASE_URL is set, so data is saved to a local file store. That's fine for one studio — set DATABASE_URL to use Postgres."
              : dbInfo.ready
                ? "Connected to Postgres. Use the button below after deploys to create or update tables."
                : "DATABASE_URL is set but Postgres isn't reachable (often a wrong password). Fix the credentials, then create the tables. Until then, data is saved to the local file store."}
        </p>
        <button type="button" className="settings-secondary" onClick={initDb} disabled={!dbInfo?.configured}>
          <Database size={15} style={{ verticalAlign: "-3px" }} /> Create / update tables
        </button>
        {dbStatus ? <p className="settings-test-result ok">{dbStatus}</p> : null}
      </section>

      <div className="settings-save-bar">
        <button type="button" className="settings-save" onClick={save} disabled={saving}>
          <Save size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          {saving ? "Saving…" : "Save all settings"}
        </button>
      </div>
    </div>
  );
}
