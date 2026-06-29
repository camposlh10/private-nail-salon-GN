"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Check, Mail, MapPin } from "lucide-react";
import type { BookingConfirmation } from "@/types";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function appointmentWhen(value?: string) {
  if (!value) return "Your selected appointment time";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function BookingConfirmationPage() {
  const params = useSearchParams();
  const bookingId = params.get("booking");
  const [booking, setBooking] = useState<BookingConfirmation | null>(null);

  useEffect(() => {
    if (!bookingId) return;

    const stored = sessionStorage.getItem(`booking-confirmation:${bookingId}`);

    if (stored) {
      setBooking(JSON.parse(stored) as BookingConfirmation);
      return;
    }

    fetch(`/api/bookings/${bookingId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { booking?: BookingConfirmation } | null) => {
        if (payload?.booking) {
          setBooking(payload.booking);
        }
      })
      .catch(() => undefined);
  }, [bookingId]);

  return (
    <main className="confirmation-shell">
      <section className="confirmation-card">
        <div className="confirmation-check">
          <Check size={44} />
        </div>
        <p className="eyebrow">Appointment confirmed</p>
        <h1>Thank you, your nail appointment is scheduled.</h1>
        <p className="confirmation-copy">
          We sent the appointment details to your email. The nail tech also received a copy, so both sides have the same confirmation.
        </p>

        <div className="confirmation-details">
          <article>
            <CalendarDays size={18} />
            <span>
              <strong>{booking?.serviceName ?? "Your selected services"}</strong>
              <small>{appointmentWhen(booking?.startAt)}</small>
              {booking ? <small>{money(booking.priceCents)} - {booking.durationMinutes} min</small> : null}
            </span>
          </article>

          <article>
            <Mail size={18} />
            <span>
              <strong>Email confirmation sent</strong>
              <small>{booking?.clientEmail ?? "Check the email you used to book."}</small>
            </span>
          </article>

          <a className="confirmation-map" href={booking?.mapsUrl ?? "https://www.google.com/maps"} target="_blank" rel="noreferrer">
            <MapPin size={19} />
            <span>
              <strong>{booking?.locationName ?? "Nunez Nails Private Studio"}</strong>
              <small>{booking?.locationAddress ?? "Open the map for directions."}</small>
            </span>
            <em>Open Maps</em>
          </a>
        </div>

        <div className="confirmation-actions">
          <Link className="primary-button" href="/">
            Back to home
          </Link>
          <Link className="ghost-button" href="/#booking">
            Book another
          </Link>
        </div>
      </section>
    </main>
  );
}
