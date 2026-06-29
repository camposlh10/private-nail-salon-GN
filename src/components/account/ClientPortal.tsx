"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, LogOut, RefreshCw, Star } from "lucide-react";
import type { AdminAppointment } from "@/types";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(value));
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(new Date(value));
}

function whenLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function ClientPortal({
  name,
  initialAppointments,
  bookingUrl,
}: {
  name: string;
  initialAppointments: AdminAppointment[];
  bookingUrl: string;
}) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { rating: number; text: string }>>({});
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);

  const now = Date.now();
  const upcoming = appointments.filter((appointment) => new Date(appointment.startAt).getTime() >= now);
  const past = appointments.filter((appointment) => new Date(appointment.startAt).getTime() < now);

  function rebookHref(appointment: AdminAppointment) {
    const ids = appointment.serviceIds?.length ? appointment.serviceIds.join(",") : "";
    return `/${ids ? `?rebook=${encodeURIComponent(ids)}` : ""}#booking`;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/account/login");
    router.refresh();
  }

  async function cancel(id: string) {
    if (!window.confirm("Cancel this appointment?")) return;
    setBusyId(id);
    const response = await fetch(`/api/account/appointments/${id}`, { method: "DELETE" });
    if (response.ok) {
      setAppointments((current) => current.filter((appointment) => appointment.id !== id));
    } else {
      window.alert("Could not cancel that appointment. Please call the studio.");
    }
    setBusyId(null);
  }

  function setDraft(id: string, patch: Partial<{ rating: number; text: string }>) {
    setReviewDrafts((current) => ({ ...current, [id]: { rating: current[id]?.rating ?? 0, text: current[id]?.text ?? "", ...patch } }));
  }

  async function submitReview(appointment: AdminAppointment) {
    const draft = reviewDrafts[appointment.id];
    if (!draft?.rating) {
      window.alert("Please tap a star rating first.");
      return;
    }
    setReviewBusy(appointment.id);
    const response = await fetch("/api/account/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: draft.rating, text: draft.text, appointmentId: appointment.id }),
    });
    if (response.ok) {
      setReviewedIds((current) => [...current, appointment.id]);
    } else {
      window.alert("Could not submit your review. Please try again.");
    }
    setReviewBusy(null);
  }

  function card(appointment: AdminAppointment, kind: "upcoming" | "past") {
    const draft = reviewDrafts[appointment.id] ?? { rating: 0, text: "" };
    const reviewed = reviewedIds.includes(appointment.id);
    return (
      <div className="portal-card" key={appointment.id}>
        <div className="portal-when">
          <div className="m">{monthLabel(appointment.startAt)}</div>
          <div className="d">{dayLabel(appointment.startAt)}</div>
        </div>
        <div className="portal-body">
          <h3>{appointment.serviceName}</h3>
          <div className="portal-meta">
            {whenLabel(appointment.startAt)} · {appointment.durationMinutes} min · {money(appointment.priceCents)}
          </div>
          <span className={`portal-status ${appointment.status}`}>{appointment.status.replace("_", " ")}</span>

          {kind === "upcoming" ? (
            <div>
              <button className="portal-cancel" type="button" disabled={busyId === appointment.id} onClick={() => cancel(appointment.id)}>
                {busyId === appointment.id ? "Cancelling…" : "Cancel appointment"}
              </button>
            </div>
          ) : (
            <div className="portal-past-actions">
              <a className="portal-rebook" href={rebookHref(appointment)}>
                <RefreshCw size={14} /> Book again
              </a>
              {reviewed ? (
                <span className="portal-review-thanks">Thanks for your review!</span>
              ) : (
                <div className="portal-review">
                  <div className="portal-stars" role="radiogroup" aria-label="Your rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`portal-star ${draft.rating >= star ? "is-on" : ""}`}
                        aria-label={`${star} star${star === 1 ? "" : "s"}`}
                        onClick={() => setDraft(appointment.id, { rating: star })}
                      >
                        <Star size={20} fill={draft.rating >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Leave a review (optional)"
                    value={draft.text}
                    onChange={(event) => setDraft(appointment.id, { text: event.target.value })}
                  />
                  <button className="portal-review-submit" type="button" disabled={reviewBusy === appointment.id} onClick={() => submitReview(appointment)}>
                    {reviewBusy === appointment.id ? "Sending…" : "Submit review"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="portal-wrap">
      <div className="portal-head">
        <div>
          <h1>Hi, {name.split(" ")[0]}</h1>
          <p className="portal-sub">Your appointments and visit history.</p>
        </div>
        <div className="portal-actions">
          <a className="portal-book-cta" href={bookingUrl}>
            <CalendarPlus size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
            Book new
          </a>
          <button className="settings-secondary" type="button" onClick={logout}>
            <LogOut size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
            Sign out
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Upcoming</h2>
      {upcoming.length ? (
        upcoming.map((appointment) => card(appointment, "upcoming"))
      ) : (
        <div className="portal-empty">
          No upcoming appointments. <a href={bookingUrl} style={{ color: "var(--rose-strong)", fontWeight: 700 }}>Book one now →</a>
        </div>
      )}

      {past.length ? (
        <>
          <h2 style={{ fontSize: 16, margin: "26px 0 12px" }}>Past visits</h2>
          {past.map((appointment) => card(appointment, "past"))}
        </>
      ) : null}
    </div>
  );
}
