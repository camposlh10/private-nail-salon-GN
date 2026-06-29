"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Bell,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  LayoutList,
  Mail,
  MessageSquareText,
  MoveRight,
  Plus,
  Trash2,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import type { AdminAppointment, AppointmentStatus, EmailDelivery, Service, TimeSlot } from "@/types";

type AppointmentsPayload = {
  date: string;
  appointments: AdminAppointment[];
  dayAppointments: AdminAppointment[];
  slots: TimeSlot[];
};

type Draft = { date: string; time: string };

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function timeLabelFromMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2026, 0, 1, hours, minutes));
}

function appointmentDate(appointment: AdminAppointment) {
  const date = new Date(appointment.startAt);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function appointmentTime(appointment: AdminAppointment) {
  const date = new Date(appointment.startAt);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function monthOf(dateValue: string) {
  return dateValue.slice(0, 7);
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));
}

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Build a 6-week grid (Sun-first) of date strings; days outside the month are null. */
function monthGrid(month: string): (string | null)[] {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(year, m - 1, 1);
  const daysInMonth = new Date(year, m, 0).getDate();
  const lead = first.getDay();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function clockTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function overlaps(slotStart: number, slotEnd: number, appointment: AdminAppointment) {
  const appointmentStart = timeToMinutes(appointmentTime(appointment));
  const appointmentEnd = appointmentStart + appointment.durationMinutes;
  return slotStart < appointmentEnd && appointmentStart < slotEnd;
}

function deliveryLabel(delivery?: EmailDelivery) {
  if (!delivery) return "Message sent.";
  if (delivery.mode === "outbox") return "Message queued (set up email in Settings to send for real).";
  if (delivery.customer) return "Message sent.";
  return delivery.errors?.[0] ?? "Message could not be sent.";
}

const STATUS_META: Record<AppointmentStatus, { label: string; cls: string }> = {
  confirmed: { label: "Scheduled", cls: "is-scheduled" },
  checked_in: { label: "Showed up", cls: "is-showed" },
  completed: { label: "Showed up", cls: "is-showed" },
  no_show: { label: "No-show", cls: "is-noshow" },
  cancelled: { label: "Cancelled", cls: "is-cancelled" },
};

export function AdminAppointmentsPanel({
  initialDate,
  initialAppointments,
  initialDayAppointments,
  initialSlots,
}: {
  initialDate: string;
  initialAppointments: AdminAppointment[];
  initialDayAppointments: AdminAppointment[];
  initialSlots: TimeSlot[];
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [dayAppointments, setDayAppointments] = useState(initialDayAppointments);
  const [slots, setSlots] = useState(initialSlots);
  const [services, setServices] = useState<Service[]>([]);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [customMessages, setCustomMessages] = useState<Record<string, string>>({});
  const [tips, setTips] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTime, setDragOverTime] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<{ time: string; name: string; phone: string; email: string; serviceIds: string[]; notes: string } | null>(null);
  const [view, setView] = useState<"month" | "day">("month");
  const [month, setMonth] = useState(monthOf(initialDate));
  const [monthAppointments, setMonthAppointments] = useState<AdminAppointment[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadMonth(forMonth = month) {
    const response = await fetch(`/api/admin/calendar?month=${forMonth}`);
    const payload = (await response.json()) as { appointments?: AdminAppointment[] };
    setMonthAppointments(payload.appointments ?? []);
  }

  function flash(text: string, kind: "success" | "error" = "success") {
    setToast({ kind, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }

  const selected = useMemo(
    () => dayAppointments.find((item) => item.id === selectedId) ?? appointments.find((item) => item.id === selectedId) ?? null,
    [selectedId, dayAppointments, appointments],
  );

  const selectedDraft = selected
    ? drafts[selected.id] ?? { date: appointmentDate(selected), time: appointmentTime(selected) }
    : null;

  async function refresh(date = selectedDate) {
    const response = await fetch(`/api/admin/appointments?date=${date}&limit=80`);
    const payload = (await response.json()) as Partial<AppointmentsPayload> & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Could not load appointments.");
    setAppointments(payload.appointments ?? []);
    setDayAppointments(payload.dayAppointments ?? []);
    setSlots(payload.slots ?? []);
    setDrafts({});
  }

  useEffect(() => {
    refresh(selectedDate).catch((error) => flash(error instanceof Error ? error.message : "Could not load appointments.", "error"));
    setSelectedId(null);
    setAddForm(null);
  }, [selectedDate]);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((p: { services?: Service[] }) => setServices(p.services ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (view === "month") {
      loadMonth(month).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, month, selectedDate]);

  function pickDay(date: string) {
    setSelectedDate(date);
    setView("day");
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    const base = selected && selected.id === id ? { date: appointmentDate(selected), time: appointmentTime(selected) } : { date: selectedDate, time: "09:00" };
    setDrafts((current) => ({ ...current, [id]: { ...base, ...current[id], ...patch } }));
  }

  async function toggleSlot(slot: TimeSlot) {
    const response = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedDate, time: slot.time, available: !slot.available }),
    });
    if (!response.ok) {
      flash("Could not update that time block.", "error");
      return;
    }
    flash(`${slot.label} is now ${slot.available ? "blocked" : "open"}.`);
    await refresh(selectedDate);
  }

  async function rescheduleAppointment(appointment: AdminAppointment) {
    const draft = drafts[appointment.id] ?? { date: appointmentDate(appointment), time: appointmentTime(appointment) };
    const response = await fetch(`/api/admin/appointments/${appointment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      flash(payload.error ?? "Could not move the appointment.", "error");
      return;
    }
    flash(`${appointment.clientName} moved to ${displayDate(draft.date)} at ${timeLabelFromMinutes(timeToMinutes(draft.time))}.`);
    setSelectedDate(draft.date);
    await refresh(draft.date);
  }

  async function moveAppointmentTo(id: string, date: string, time: string) {
    const appointment = dayAppointments.find((item) => item.id === id) ?? appointments.find((item) => item.id === id);
    if (!appointment) return;
    if (appointment.source === "demo") {
      flash("Sample appointments can't be moved.", "error");
      return;
    }
    if (appointmentDate(appointment) === date && appointmentTime(appointment) === time) return;
    const response = await fetch(`/api/admin/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, time }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      flash(payload.error ?? "That time is blocked or already booked.", "error");
      return;
    }
    flash(`${appointment.clientName} moved to ${timeLabelFromMinutes(timeToMinutes(time))}.`);
    await refresh(date);
  }

  function dropProps(slot: TimeSlot) {
    return {
      onDragOver: (event: React.DragEvent) => {
        if (!draggingId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (dragOverTime !== slot.time) setDragOverTime(slot.time);
      },
      onDragLeave: () => setDragOverTime((current) => (current === slot.time ? null : current)),
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        const id = event.dataTransfer.getData("text/plain") || draggingId;
        setDragOverTime(null);
        setDraggingId(null);
        if (id) void moveAppointmentTo(id, selectedDate, slot.time);
      },
    };
  }

  async function removeAppointment(appointment: AdminAppointment) {
    if (!window.confirm(`Remove ${appointment.clientName}'s ${appointment.serviceName} appointment?`)) return;
    const response = await fetch(`/api/admin/appointments/${appointment.id}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      flash(payload.error ?? "Could not remove the appointment.", "error");
      return;
    }
    flash(`${appointment.clientName}'s appointment was removed.`);
    setSelectedId(null);
    await refresh(selectedDate);
  }

  async function sendMessage(appointment: AdminAppointment, kind: "reminder" | "cancellation" | "custom") {
    const labels = { reminder: "reminder", cancellation: "cancellation", custom: "message" } as const;
    if (!window.confirm(`Send a ${labels[kind]} ${kind === "custom" ? "" : "email "}to ${appointment.clientName}${appointment.clientEmail ? ` (${appointment.clientEmail})` : ""}?`)) {
      return;
    }
    const response = await fetch(`/api/admin/appointments/${appointment.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, message: customMessages[appointment.id] ?? "" }),
    });
    const payload = (await response.json()) as { emailDelivery?: EmailDelivery; error?: string };
    if (!response.ok) {
      flash(payload.error ?? "Could not send the message.", "error");
      return;
    }
    flash(`${kind[0].toUpperCase()}${kind.slice(1)} to ${appointment.clientName}: ${deliveryLabel(payload.emailDelivery)}`);
    if (kind === "custom") setCustomMessages((current) => ({ ...current, [appointment.id]: "" }));
  }

  async function setAttendance(appointment: AdminAppointment, status: AppointmentStatus) {
    const tipDollars = Number(tips[appointment.id] ?? "0") || 0;
    const response = await fetch(`/api/admin/appointments/${appointment.id}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, tipCents: status === "completed" ? Math.round(tipDollars * 100) : 0 }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      flash(payload.error ?? "Could not update attendance.", "error");
      return;
    }
    flash(status === "completed" ? `${appointment.clientName} marked as showed up.` : `${appointment.clientName} marked as a no-show.`);
    await refresh(selectedDate);
  }

  function openAdd(time: string) {
    setSelectedId(null);
    setAddForm({ time, name: "", phone: "", email: "", serviceIds: services[0] ? [services[0].id] : [], notes: "" });
  }

  async function submitAdd() {
    if (!addForm) return;
    if (!addForm.name.trim()) {
      flash("Enter a client name.", "error");
      return;
    }
    if (!addForm.serviceIds.length) {
      flash("Pick at least one service.", "error");
      return;
    }
    const response = await fetch("/api/admin/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addForm, date: selectedDate }),
    });
    const payload = (await response.json()) as { appointment?: AdminAppointment; error?: string };
    if (!response.ok || !payload.appointment) {
      flash(payload.error ?? "Could not add the appointment.", "error");
      return;
    }
    flash(`${payload.appointment.clientName} added at ${clockTime(payload.appointment.startAt)}.`);
    setAddForm(null);
    await refresh(selectedDate);
    setSelectedId(payload.appointment.id);
  }

  const openSlots = slots.filter((slot) => slot.available).length;
  const blockedSlots = slots.length - openSlots;
  const addTotal = addForm ? services.filter((s) => addForm.serviceIds.includes(s.id)).reduce((sum, s) => sum + s.priceCents, 0) : 0;
  const addDuration = addForm ? services.filter((s) => addForm.serviceIds.includes(s.id)).reduce((sum, s) => sum + s.durationMinutes, 0) : 0;

  return (
    <main className="appointments-page">
      {toast ? <div className={`appt-toast ${toast.kind}`}>{toast.text}</div> : null}

      <header className="appointments-header">
        <Link href="/admin" className="admin-back">
          <ArrowLeft size={18} />
          Dashboard
        </Link>
        <div>
          <p>Admin schedule</p>
          <h1>Calendar</h1>
        </div>
      </header>

      <section className="appointments-toolbar">
        <div className="view-toggle" role="tablist" aria-label="Calendar view">
          <button type="button" className={view === "month" ? "is-on" : ""} onClick={() => setView("month")}>
            <CalendarRange size={15} /> Month
          </button>
          <button type="button" className={view === "day" ? "is-on" : ""} onClick={() => setView("day")}>
            <LayoutList size={15} /> Day
          </button>
        </div>
        {view === "day" ? (
          <>
            <label>
              Calendar date
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
            <div className="appointments-metrics">
              <span>{dayAppointments.length} on {displayDate(selectedDate)}</span>
              <span>{openSlots} open</span>
              <span>{blockedSlots} blocked</span>
            </div>
          </>
        ) : (
          <div className="appointments-metrics">
            <span>{monthAppointments.length} this month</span>
          </div>
        )}
        <button
          type="button"
          className="add-appt-btn"
          onClick={() => {
            setView("day");
            openAdd(slots.find((s) => s.available)?.time ?? "09:00");
          }}
        >
          <UserPlus size={16} />
          Add appointment
        </button>
      </section>

      {view === "month" ? (
        <MonthCalendar
          month={month}
          appointments={monthAppointments}
          onMonthChange={setMonth}
          onPickDay={pickDay}
        />
      ) : (
      <section className="appointment-workspace">
        {/* CALENDAR — the core */}
        <div className="admin-card appointment-calendar-card">
          <div className="admin-card-title">
            <CalendarDays size={18} />
            <span>{displayDate(selectedDate)} schedule</span>
          </div>

          <div className="calendar-legend" aria-label="Calendar color legend">
            <span><i className="legend-open" /> Free</span>
            <span><i className="legend-appointment" /> Client</span>
            <span><i className="legend-blocked" /> Blocked</span>
          </div>
          <p className="drag-hint">Click a client to manage them · drag to reschedule · click a free slot to add or block.</p>

          <div className="appointment-calendar-list">
            {slots.map((slot) => {
              const slotStart = timeToMinutes(slot.time);
              const slotEnd = slotStart + 30;
              const appointment = dayAppointments.find((item) => overlaps(slotStart, slotEnd, item));
              const startsAppointment = appointment && appointmentTime(appointment) === slot.time;
              const range = `${slot.label} - ${timeLabelFromMinutes(slotEnd)}`;
              const rowClass = `appointment-calendar-row${dragOverTime === slot.time ? " is-drop-target" : ""}`;

              if (startsAppointment && appointment) {
                const meta = STATUS_META[appointment.status];
                return (
                  <article className={rowClass} key={slot.time} {...dropProps(slot)}>
                    <time>{slot.label}</time>
                    <div
                      className={`appointment-calendar-block is-appointment${selectedId === appointment.id ? " is-selected" : ""}${draggingId === appointment.id ? " is-dragging" : ""}`}
                      draggable={appointment.source !== "demo"}
                      onClick={() => { setSelectedId(appointment.id); setAddForm(null); }}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", appointment.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingId(appointment.id);
                      }}
                      onDragEnd={() => { setDraggingId(null); setDragOverTime(null); }}
                      title={appointment.source === "demo" ? "Sample appointment" : "Click to manage · drag to reschedule"}
                    >
                      <div className="appt-block-top">
                        <strong>{appointment.clientName}</strong>
                        <span className={`appt-status-dot ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <span>{appointment.serviceName}</span>
                      <small>{range} · {appointment.durationMinutes} min · {money(appointment.priceCents)}</small>
                    </div>
                  </article>
                );
              }

              if (appointment) {
                return (
                  <article className={rowClass} key={slot.time} {...dropProps(slot)}>
                    <time>{slot.label}</time>
                    <button type="button" className="appointment-calendar-block is-busy" onClick={() => setSelectedId(appointment.id)}>
                      <strong>In appointment</strong>
                      <span>{appointment.clientName}</span>
                      <small>{range}</small>
                    </button>
                  </article>
                );
              }

              return (
                <article className={rowClass} key={slot.time} {...dropProps(slot)}>
                  <time>{slot.label}</time>
                  <div className="free-slot-cell">
                    <button
                      type="button"
                      className={`appointment-calendar-block ${slot.available ? "is-open" : "is-blocked"}`}
                      onClick={() => toggleSlot(slot)}
                    >
                      <strong>
                        {slot.available ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        {slot.available ? "Free" : "Blocked time"}
                      </strong>
                      <small>{range} · tap to {slot.available ? "block" : "reopen"}</small>
                    </button>
                    {slot.available ? (
                      <button type="button" className="slot-add" onClick={() => openAdd(slot.time)} aria-label={`Add appointment at ${slot.label}`}>
                        <Plus size={16} />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* CONTEXTUAL PANEL */}
        <div className="admin-card appointment-detail-card">
          {addForm ? (
            <div className="appt-add-form">
              <div className="admin-card-title">
                <UserPlus size={18} />
                <span>Add appointment</span>
                <button type="button" className="panel-close" onClick={() => setAddForm(null)} aria-label="Close"><X size={16} /></button>
              </div>
              <label className="panel-field">Client name
                <input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} autoFocus />
              </label>
              <div className="panel-row">
                <label className="panel-field">Phone
                  <input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
                </label>
                <label className="panel-field">Email (optional)
                  <input value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
                </label>
              </div>
              <div className="panel-row">
                <label className="panel-field">Date
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                </label>
                <label className="panel-field">Time
                  <input type="time" step={1800} value={addForm.time} onChange={(e) => setAddForm({ ...addForm, time: e.target.value })} />
                </label>
              </div>
              <div className="panel-field">Services
                <div className="service-pick">
                  {services.map((service) => {
                    const on = addForm.serviceIds.includes(service.id);
                    return (
                      <button
                        type="button"
                        key={service.id}
                        className={`service-pick-chip${on ? " is-on" : ""}`}
                        onClick={() => setAddForm({ ...addForm, serviceIds: on ? addForm.serviceIds.filter((id) => id !== service.id) : [...addForm.serviceIds, service.id] })}
                      >
                        {on ? <Check size={13} /> : null}
                        {service.name} · {money(service.priceCents)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="panel-field">Notes
                <textarea value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
              </label>
              <div className="appt-add-summary">{addDuration} min · {money(addTotal)}</div>
              <button type="button" className="panel-primary" onClick={submitAdd}>
                <Plus size={16} /> Add to calendar
              </button>
            </div>
          ) : selected ? (
            <SelectedAppointment
              appointment={selected}
              draft={selectedDraft!}
              tipValue={tips[selected.id] ?? (((selected.tipCents ?? 0) / 100) || "").toString()}
              customMessage={customMessages[selected.id] ?? ""}
              onClose={() => setSelectedId(null)}
              onDraft={(patch) => updateDraft(selected.id, patch)}
              onReschedule={() => rescheduleAppointment(selected)}
              onRemove={() => removeAppointment(selected)}
              onMessage={(kind) => sendMessage(selected, kind)}
              onCustom={(text) => setCustomMessages((c) => ({ ...c, [selected.id]: text }))}
              onAttendance={(status) => setAttendance(selected, status)}
              onTip={(value) => setTips((t) => ({ ...t, [selected.id]: value }))}
            />
          ) : (
            <div className="appt-daylist">
              <div className="admin-card-title">
                <Bell size={18} />
                <span>{displayDate(selectedDate)}</span>
              </div>
              {dayAppointments.length ? (
                <>
                  <p className="appt-daylist-hint">Tap a client to manage them.</p>
                  {dayAppointments.map((appointment) => {
                    const meta = STATUS_META[appointment.status];
                    return (
                      <button type="button" className="appt-daylist-row" key={appointment.id} onClick={() => setSelectedId(appointment.id)}>
                        <time>{clockTime(appointment.startAt)}</time>
                        <span>
                          <strong>{appointment.clientName}</strong>
                          <small>{appointment.serviceName}</small>
                        </span>
                        <em className={`appt-status-dot ${meta.cls}`}>{meta.label}</em>
                      </button>
                    );
                  })}
                </>
              ) : (
                <p className="empty-client-list">No appointments yet. Click a free time on the calendar to add one.</p>
              )}
            </div>
          )}
        </div>
      </section>
      )}
    </main>
  );
}

function MonthCalendar({
  month,
  appointments,
  onMonthChange,
  onPickDay,
}: {
  month: string;
  appointments: AdminAppointment[];
  onMonthChange: (month: string) => void;
  onPickDay: (date: string) => void;
}) {
  const today = todayKey();
  const cells = monthGrid(month);
  const byDay = new Map<string, AdminAppointment[]>();
  for (const appointment of appointments) {
    const key = appointmentDate(appointment);
    const list = byDay.get(key) ?? [];
    list.push(appointment);
    byDay.set(key, list);
  }

  return (
    <section className="admin-card month-calendar">
      <div className="month-calendar-head">
        <button type="button" onClick={() => onMonthChange(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" onClick={() => onMonthChange(shiftMonth(month, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
      </div>

      <div className="month-weekdays">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="month-grid">
        {cells.map((date, index) => {
          if (!date) return <div className="month-cell is-empty" key={`empty-${index}`} />;
          const dayAppts = (byDay.get(date) ?? []).sort((a, b) => a.startAt.localeCompare(b.startAt));
          const dayNum = Number(date.slice(8, 10));
          return (
            <button
              type="button"
              className={`month-cell${date === today ? " is-today" : ""}${dayAppts.length ? " has-appts" : ""}`}
              key={date}
              onClick={() => onPickDay(date)}
            >
              <span className="month-cell-num">{dayNum}</span>
              <span className="month-cell-list">
                {dayAppts.slice(0, 3).map((appointment) => (
                  <em key={appointment.id} className={STATUS_META[appointment.status].cls} title={`${clockTime(appointment.startAt)} ${appointment.clientName}`}>
                    {clockTime(appointment.startAt)} {appointment.clientName}
                  </em>
                ))}
                {dayAppts.length > 3 ? <em className="month-cell-more">+{dayAppts.length - 3} more</em> : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="drag-hint">Click any day to open it — block times, add walk-ins, reschedule, and manage clients.</p>
    </section>
  );
}

function SelectedAppointment({
  appointment,
  draft,
  tipValue,
  customMessage,
  onClose,
  onDraft,
  onReschedule,
  onRemove,
  onMessage,
  onCustom,
  onAttendance,
  onTip,
}: {
  appointment: AdminAppointment;
  draft: Draft;
  tipValue: string;
  customMessage: string;
  onClose: () => void;
  onDraft: (patch: Partial<Draft>) => void;
  onReschedule: () => void;
  onRemove: () => void;
  onMessage: (kind: "reminder" | "cancellation" | "custom") => void;
  onCustom: (text: string) => void;
  onAttendance: (status: AppointmentStatus) => void;
  onTip: (value: string) => void;
}) {
  const isDemo = appointment.source === "demo";
  const meta = STATUS_META[appointment.status];
  const showed = appointment.status === "completed" || appointment.status === "checked_in";
  const noShow = appointment.status === "no_show";

  return (
    <div className="appt-detail">
      <div className="admin-card-title">
        <span className="appt-detail-name">{appointment.clientName}</span>
        <em className={`appt-status-dot ${meta.cls}`}>{meta.label}</em>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Back"><X size={16} /></button>
      </div>

      <p className="appt-detail-meta">
        {clockTime(appointment.startAt)} · {appointment.serviceName} · {appointment.durationMinutes} min · {money(appointment.priceCents)}
        {appointment.tipCents ? ` · tip ${money(appointment.tipCents)}` : ""}
      </p>

      <div className="appointment-contact-row">
        {appointment.clientEmail ? <a href={`mailto:${appointment.clientEmail}`}>{appointment.clientEmail}</a> : <span>No email</span>}
        {appointment.clientPhone ? <a href={`tel:${appointment.clientPhone}`}>{appointment.clientPhone}</a> : null}
      </div>

      {isDemo ? (
        <p className="appointment-demo-note">Sample appointment. Real bookings can be managed here.</p>
      ) : (
        <>
          {/* Attendance + tips */}
          <div className="panel-block">
            <span className="panel-label">Attendance</span>
            <div className="appt-attendance">
              <button type="button" className={`att-btn att-showed${showed ? " is-on" : ""}`} onClick={() => onAttendance("completed")}>
                <Check size={15} /> Showed up
              </button>
              <button type="button" className={`att-btn att-noshow${noShow ? " is-on" : ""}`} onClick={() => onAttendance("no_show")}>
                <X size={15} /> No-show
              </button>
              {showed ? (
                <label className="tip-field">Tip
                  <span className="tip-input">
                    <DollarSign size={13} />
                    <input
                      type="number"
                      min={0}
                      value={tipValue}
                      onChange={(e) => onTip(e.target.value)}
                      onBlur={() => onAttendance("completed")}
                      onKeyDown={(e) => { if (e.key === "Enter") onAttendance("completed"); }}
                    />
                  </span>
                </label>
              ) : null}
            </div>
          </div>

          {/* Messaging */}
          <div className="panel-block">
            <span className="panel-label">Send a message</span>
            <div className="appointment-message-actions">
              <button className="message-button is-reminder" type="button" onClick={() => onMessage("reminder")}>
                <Bell size={15} /> Reminder
              </button>
              <button className="message-button is-cancel" type="button" onClick={() => onMessage("cancellation")}>
                <Ban size={15} /> Cancellation
              </button>
            </div>
            <div className="custom-message-row">
              <textarea value={customMessage} onChange={(e) => onCustom(e.target.value)} placeholder="Write a custom message..." />
              <button className="message-button is-custom" type="button" onClick={() => onMessage("custom")}>
                <MessageSquareText size={15} /> Send custom
              </button>
            </div>
          </div>

          {/* Reschedule */}
          <div className="panel-block">
            <span className="panel-label">Reschedule</span>
            <div className="appointment-edit-row">
              <label>Date
                <input type="date" value={draft.date} onChange={(e) => onDraft({ date: e.target.value })} />
              </label>
              <label>Time
                <input type="time" step={1800} value={draft.time} onChange={(e) => onDraft({ time: e.target.value })} />
              </label>
            </div>
            <div className="appointment-admin-actions">
              <button className="move-button" type="button" onClick={onReschedule}>
                <MoveRight size={15} /> Save new time
              </button>
              <button className="remove-button" type="button" onClick={onRemove}>
                <Trash2 size={15} /> Remove
              </button>
            </div>
          </div>

          {appointment.notes ? <p className="appointment-note"><Mail size={14} /> {appointment.notes}</p> : null}
        </>
      )}
    </div>
  );
}
