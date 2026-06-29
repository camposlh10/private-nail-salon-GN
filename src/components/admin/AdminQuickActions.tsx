"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarPlus, Clock, Megaphone, Scissors, Send, Sparkles, X } from "lucide-react";

export function AdminQuickActions() {
  const [promoOpen, setPromoOpen] = useState(false);
  const [audience, setAudience] = useState<"all" | "winback">("all");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function sendPromo() {
    if (!message.trim()) {
      setResult({ ok: false, text: "Write a message first." });
      return;
    }
    setBusy(true);
    setResult(null);
    const response = await fetch("/api/admin/marketing/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience, subject, message }),
    });
    const payload = (await response.json()) as { sent?: number; total?: number; mode?: string; error?: string };
    if (response.ok) {
      const queued = payload.mode === "outbox";
      setResult({ ok: true, text: queued ? `Queued for ${payload.sent} clients (set up email to deliver).` : `Sent to ${payload.sent} of ${payload.total} clients.` });
      setMessage("");
      setSubject("");
    } else {
      setResult({ ok: false, text: payload.error ?? "Could not send." });
    }
    setBusy(false);
  }

  return (
    <div className="admin-card quick-actions-card" id="quick-actions">
      <div className="admin-card-title">
        <Sparkles size={18} />
        <span>Quick actions</span>
      </div>

      <div className="quick-actions-grid">
        <Link className="quick-action" href="/admin/appointments">
          <span className="quick-action-icon"><CalendarPlus size={20} /></span>
          New appointment
        </Link>
        <Link className="quick-action" href="/admin/appointments">
          <span className="quick-action-icon"><Clock size={20} /></span>
          Block time off
        </Link>
        <button type="button" className={`quick-action${promoOpen ? " is-active" : ""}`} onClick={() => setPromoOpen((open) => !open)}>
          <span className="quick-action-icon"><Megaphone size={20} /></span>
          Send promotion
        </button>
        <Link className="quick-action" href="/admin#manage">
          <span className="quick-action-icon"><Scissors size={20} /></span>
          Manage services
        </Link>
      </div>

      {promoOpen ? (
        <div className="promo-form" id="promo">
          <div className="promo-form-head">
            <strong>Send a promotion</strong>
            <button type="button" onClick={() => setPromoOpen(false)} aria-label="Close"><X size={16} /></button>
          </div>
          <label className="promo-field">Audience
            <select value={audience} onChange={(e) => setAudience(e.target.value as "all" | "winback")}>
              <option value="all">All clients</option>
              <option value="winback">Clients with no upcoming visit</option>
            </select>
          </label>
          <label className="promo-field">Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="20% off this week!" />
          </label>
          <label className="promo-field">Message
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hi! Book your next set this week and get 20% off any gel service." />
          </label>
          <button type="button" className="promo-send" onClick={sendPromo} disabled={busy}>
            <Send size={15} /> {busy ? "Sending…" : "Send promotion"}
          </button>
          {result ? <p className={`promo-result ${result.ok ? "ok" : "bad"}`}>{result.text}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
