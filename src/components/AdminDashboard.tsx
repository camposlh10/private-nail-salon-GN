import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  DollarSign,
  Gift,
  Mail,
  Megaphone,
  Menu,
  Phone,
  Plus,
  Send,
  UsersRound,
} from "lucide-react";
import type { AdminOverview, Appointment } from "@/types";
import { AdminControls } from "./AdminControls";
import { InstagramAdminCard } from "./InstagramAdminCard";
import { AdminQuickActions } from "./admin/AdminQuickActions";
import { SHOW_SOCIAL } from "./feature-flags";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function appointmentTime(appointment: Appointment) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(appointment.startAt));
}

function notificationTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function clientSince(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AdminDashboard({ overview }: { overview: AdminOverview }) {
  const clientCount = overview.clients.length;
  const revenue = overview.revenue;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link href="/" className="admin-back">
          Client site
        </Link>
        <div>
          <p>Good morning, Gisela</p>
          <h1>Dashboard</h1>
        </div>
        <a href="#notifications" aria-label="Notifications">
          <Bell size={20} />
        </a>
      </header>

      <section className="admin-grid">
        <div className="admin-column">
          <div className="admin-card today-card">
            <div className="admin-card-title">
              <Menu size={18} />
              <span>Today</span>
              <Link href="/admin/appointments" aria-label="Add appointment">
                <Plus size={18} />
              </Link>
            </div>
            <div className="metric-grid">
              <article>
                <span>Net today</span>
                <strong>{money(revenue.netCents)}</strong>
                <small>after expenses</small>
              </article>
              <article>
                <span>Appointments</span>
                <strong>{revenue.totalAppointments}</strong>
                <small>{revenue.showed} showed · {revenue.noShow} no-show</small>
              </article>
              <article>
                <span>Tips</span>
                <strong>{money(revenue.tipsCents)}</strong>
                <small>collected today</small>
              </article>
              <article>
                <span>Expenses</span>
                <strong>{money(revenue.expensesCents)}</strong>
                <small>logged today</small>
              </article>
            </div>
          </div>

          <AdminQuickActions />

          <div className="admin-card schedule-card">
            <div className="admin-card-title">
              <CalendarDays size={18} />
              <span>Upcoming today</span>
              <Link href="/admin/appointments">View all</Link>
            </div>
            <div className="schedule-list">
              {overview.appointments.slice(0, 4).map((appointment) => (
                <article key={appointment.id}>
                  <time>{appointmentTime(appointment)}</time>
                  <span>
                    <strong>{appointment.clientName}</strong>
                    {appointment.serviceName}
                  </span>
                  <small>{money(appointment.priceCents)}</small>
                </article>
              ))}
            </div>
          </div>

          <div className="admin-card notification-card" id="notifications">
            <div className="admin-card-title">
              <Bell size={18} />
              <span>Notifications</span>
              <small>{overview.notifications.filter((notification) => !notification.read).length} new</small>
            </div>
            <div className="notification-list">
              {overview.notifications.length ? (
                overview.notifications.map((notification) => (
                  <article key={notification.id} className={notification.read ? "" : "is-unread"}>
                    <span aria-hidden="true" />
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.body}</p>
                    </div>
                    <time>{notificationTime(notification.createdAt)}</time>
                  </article>
                ))
              ) : (
                <p>No new notifications yet.</p>
              )}
            </div>
          </div>

          {SHOW_SOCIAL ? <InstagramAdminCard /> : null}
        </div>

        <div id="clients" className="admin-column">
          <div className="admin-card revenue-overview-card">
            <div className="admin-card-title">
              <DollarSign size={18} />
              <span>Today&apos;s revenue</span>
              <Link href="/admin/revenue">Open</Link>
            </div>
            <div className="revenue-overview-net">
              <span>Net after expenses</span>
              <strong>{money(revenue.netCents)}</strong>
            </div>
            <dl className="revenue-overview-grid">
              <div>
                <dt>Services</dt>
                <dd>{money(revenue.serviceRevenueCents)}</dd>
              </div>
              <div>
                <dt>Tips</dt>
                <dd>{money(revenue.tipsCents)}</dd>
              </div>
              <div>
                <dt>Expenses</dt>
                <dd className="is-expense">- {money(revenue.expensesCents)}</dd>
              </div>
              <div>
                <dt>Showed up</dt>
                <dd>{revenue.showed} / {revenue.totalAppointments}</dd>
              </div>
            </dl>
            <div className="revenue-overview-counts">
              <span className="count-showed">{revenue.showed} showed</span>
              <span className="count-noshow">{revenue.noShow} no-show</span>
              <span className="count-scheduled">{revenue.scheduled} not marked</span>
            </div>
            <Link className="revenue-overview-cta" href="/admin/revenue">
              Mark who showed up, add tips &amp; expenses
              <ChevronRight size={16} />
            </Link>
          </div>

          <div className="admin-card client-list-card">
            <div className="admin-card-title">
              <UsersRound size={18} />
              <span>All client accounts</span>
              <small>{clientCount} total</small>
            </div>
            <div className="client-list-summary">
              <strong>{clientCount}</strong>
              <p>Clients with saved contact details, visit history, loyalty progress, and booking notes.</p>
            </div>
            <div className="client-account-list">
              {overview.clients.length ? (
                overview.clients.map((client) => (
                  <article key={client.id} className="client-account-row">
                    <div className="client-account-avatar" aria-hidden="true">
                      {initials(client.name)}
                    </div>
                    <div className="client-account-main">
                      <div>
                        <strong>{client.name}</strong>
                        <span>Since {clientSince(client.createdAt)}</span>
                      </div>
                      <p>{client.email}</p>
                      {client.phone ? <p>{client.phone}</p> : null}
                      <div className="client-account-stats">
                        <span>{client.visits} visits</span>
                        <span>{money(client.totalSpentCents)}</span>
                        <span>{client.loyaltyVisits}/10 loyalty</span>
                      </div>
                      <div className="client-account-meta">
                        <span>Last: {client.lastVisit}</span>
                        <span>Next: {client.nextVisit}</span>
                      </div>
                      <p className="client-account-notes">{client.notes}</p>
                    </div>
                    <div className="client-account-actions">
                      {client.phone ? (
                        <a href={`tel:${client.phone}`} aria-label={`Call ${client.name}`}>
                          <Phone size={15} />
                        </a>
                      ) : null}
                      <a href={`mailto:${client.email}`} aria-label={`Email ${client.name}`}>
                        <Mail size={15} />
                      </a>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty-client-list">No client accounts to show yet.</p>
              )}
            </div>
          </div>

          <div id="marketing" className="admin-card marketing-card">
            <div className="admin-card-title">
              <Megaphone size={18} />
              <span>Marketing</span>
              <a href="#quick-actions" aria-label="Send a promotion">
                <Send size={16} />
              </a>
            </div>
            {overview.campaigns.map((campaign) => (
              <article key={campaign.id}>
                <Gift size={18} />
                <span>
                  <strong>{campaign.title}</strong>
                  {campaign.audience}
                </span>
                <small>{campaign.clients} clients</small>
                <ChevronRight size={17} />
              </article>
            ))}
          </div>
        </div>
      </section>

      <AdminControls />
    </main>
  );
}
