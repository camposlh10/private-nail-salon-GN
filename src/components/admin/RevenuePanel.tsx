"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Check, X, Receipt, Trash2, Plus, Paperclip, DollarSign } from "lucide-react";
import type { AdminAppointment, Expense, RevenueSummary } from "@/types";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(cents / 100);
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function longDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function clockTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

const CATEGORIES = ["supplies", "rent", "tools", "marketing", "other"];

type RevenueData = { summary: RevenueSummary; appointments: AdminAppointment[]; expenses: Expense[] };

export function RevenuePanel({ initialDate }: { initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [tips, setTips] = useState<Record<string, string>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expense form
  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expCategory, setExpCategory] = useState("supplies");
  const [expFile, setExpFile] = useState<File | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }, []);

  const load = useCallback(async (forDate: string) => {
    setLoading(true);
    const response = await fetch(`/api/admin/revenue?date=${forDate}`);
    const payload = (await response.json()) as RevenueData;
    setData(payload);
    setTips(Object.fromEntries(payload.appointments.map((a) => [a.id, ((a.tipCents ?? 0) / 100 || "").toString()])));
    setLoading(false);
  }, []);

  useEffect(() => {
    load(date).catch(() => setLoading(false));
  }, [date, load]);

  async function setAttendance(appointment: AdminAppointment, status: "completed" | "no_show" | "confirmed") {
    const tipDollars = Number(tips[appointment.id] ?? "0") || 0;
    const response = await fetch(`/api/admin/appointments/${appointment.id}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, tipCents: status === "completed" ? Math.round(tipDollars * 100) : 0 }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      flash(payload.error ?? "Could not update.");
      return;
    }
    flash(
      status === "completed"
        ? `${appointment.clientName} marked as showed up.`
        : status === "no_show"
          ? `${appointment.clientName} marked as a no-show.`
          : `${appointment.clientName} reset to scheduled.`,
    );
    await load(date);
  }

  async function saveTip(appointment: AdminAppointment) {
    const tipDollars = Number(tips[appointment.id] ?? "0") || 0;
    const response = await fetch(`/api/admin/appointments/${appointment.id}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", tipCents: Math.round(tipDollars * 100) }),
    });
    if (response.ok) {
      flash(`Tip saved for ${appointment.clientName}.`);
      await load(date);
    }
  }

  async function addExpense() {
    const amount = Number(expAmount);
    if (!amount || amount <= 0) {
      flash("Enter an expense amount.");
      return;
    }
    setSavingExpense(true);
    let receiptUrl: string | undefined;

    if (expFile) {
      const form = new FormData();
      form.append("file", expFile);
      const up = await fetch("/api/admin/uploads", { method: "POST", body: form });
      if (up.ok) {
        receiptUrl = ((await up.json()) as { url: string }).url;
      } else {
        const err = (await up.json()) as { error?: string };
        flash(err.error ?? "Receipt upload failed.");
        setSavingExpense(false);
        return;
      }
    }

    const response = await fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, description: expDesc, category: expCategory, amountCents: Math.round(amount * 100), receiptUrl }),
    });

    if (response.ok) {
      setExpAmount("");
      setExpDesc("");
      setExpFile(null);
      flash("Expense added.");
      await load(date);
    } else {
      flash("Could not add expense.");
    }
    setSavingExpense(false);
  }

  async function removeExpense(id: string) {
    if (!window.confirm("Delete this expense?")) return;
    const response = await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
    if (response.ok) {
      flash("Expense deleted.");
      await load(date);
    }
  }

  const summary = data?.summary;
  const isToday = date === initialDate;

  return (
    <div className="revenue-wrap">
      {toast ? <div className="revenue-toast">{toast}</div> : null}

      <div className="revenue-head">
        <div>
          <h1>Revenue</h1>
          <p className="revenue-sub">{longDate(date)}{isToday ? " · Today" : ""}</p>
        </div>
        <div className="revenue-datenav">
          <button type="button" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day"><ChevronLeft size={18} /></button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" onClick={() => setDate(shiftDate(date, 1))} aria-label="Next day"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* Summary */}
      <div className="revenue-summary">
        <div className="revenue-stat is-net">
          <span>Net</span>
          <strong>{summary ? money(summary.netCents) : "—"}</strong>
          <small>after expenses</small>
        </div>
        <div className="revenue-stat">
          <span>Services</span>
          <strong>{summary ? money(summary.serviceRevenueCents) : "—"}</strong>
          <small>{summary?.showed ?? 0} showed up</small>
        </div>
        <div className="revenue-stat">
          <span>Tips</span>
          <strong>{summary ? money(summary.tipsCents) : "—"}</strong>
          <small>collected</small>
        </div>
        <div className="revenue-stat is-expense">
          <span>Expenses</span>
          <strong>{summary ? `- ${money(summary.expensesCents)}` : "—"}</strong>
          <small>{data?.expenses.length ?? 0} items</small>
        </div>
      </div>

      <div className="revenue-counts">
        <span className="count-showed">{summary?.showed ?? 0} showed</span>
        <span className="count-noshow">{summary?.noShow ?? 0} no-show</span>
        <span className="count-scheduled">{summary?.scheduled ?? 0} not marked</span>
      </div>

      {/* Appointments / attendance */}
      <section className="revenue-section">
        <h2>Clients</h2>
        <p className="section-note">Mark who showed up to count their service toward today&apos;s revenue, and log tips.</p>
        {loading ? (
          <p className="revenue-empty">Loading…</p>
        ) : data && data.appointments.length ? (
          data.appointments.map((appointment) => {
            const showed = appointment.status === "completed" || appointment.status === "checked_in";
            const noShow = appointment.status === "no_show";
            return (
              <div className={`revenue-appt${showed ? " is-showed" : ""}${noShow ? " is-noshow" : ""}`} key={appointment.id}>
                <div className="revenue-appt-when">{clockTime(appointment.startAt)}</div>
                <div className="revenue-appt-main">
                  <strong>{appointment.clientName}</strong>
                  <span>{appointment.serviceName} · {money(appointment.priceCents)}</span>
                </div>
                <div className="revenue-appt-actions">
                  <button type="button" className={`att-btn att-showed${showed ? " is-on" : ""}`} onClick={() => setAttendance(appointment, "completed")}>
                    <Check size={15} /> Showed
                  </button>
                  <button type="button" className={`att-btn att-noshow${noShow ? " is-on" : ""}`} onClick={() => setAttendance(appointment, "no_show")}>
                    <X size={15} /> No-show
                  </button>
                  {showed ? (
                    <label className="tip-field">
                      Tip
                      <span className="tip-input">
                        <DollarSign size={13} />
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={tips[appointment.id] ?? ""}
                          onChange={(e) => setTips((t) => ({ ...t, [appointment.id]: e.target.value }))}
                          onBlur={() => saveTip(appointment)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveTip(appointment); }}
                        />
                      </span>
                    </label>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <p className="revenue-empty">No appointments on this day.</p>
        )}
      </section>

      {/* Expenses */}
      <section className="revenue-section">
        <h2>Expenses</h2>
        <p className="section-note">Log supplies and other costs, and attach a receipt photo or PDF.</p>

        <div className="expense-form">
          <input className="exp-desc" placeholder="What was it? (e.g. gel polish)" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} />
          <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
          <span className="exp-amount">
            <DollarSign size={14} />
            <input type="number" min={0} step={1} placeholder="0" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
          </span>
          <label className={`exp-file${expFile ? " has-file" : ""}`}>
            <Paperclip size={15} />
            {expFile ? expFile.name.slice(0, 14) : "Receipt"}
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setExpFile(e.target.files?.[0] ?? null)} hidden />
          </label>
          <button type="button" className="exp-add" onClick={addExpense} disabled={savingExpense}>
            <Plus size={16} /> {savingExpense ? "Adding…" : "Add"}
          </button>
        </div>

        <div className="expense-list">
          {data?.expenses.length ? (
            data.expenses.map((expense) => (
              <div className="expense-row" key={expense.id}>
                <Receipt size={16} className="expense-icon" />
                <div className="expense-main">
                  <strong>{expense.description}</strong>
                  <span>{expense.category}</span>
                </div>
                {expense.receiptUrl ? (
                  <a className="expense-receipt" href={expense.receiptUrl} target="_blank" rel="noreferrer">
                    <Paperclip size={13} /> Receipt
                  </a>
                ) : null}
                <b className="expense-amount">- {money(expense.amountCents)}</b>
                <button type="button" className="expense-remove" onClick={() => removeExpense(expense.id)} aria-label="Delete expense">
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          ) : (
            <p className="revenue-empty">No expenses logged for this day.</p>
          )}
        </div>
      </section>
    </div>
  );
}
