import Link from "next/link";
import {
  CalendarCheck2,
  CalendarDays,
  DollarSign,
  Mail,
  Phone,
  Repeat2,
  UsersRound,
} from "lucide-react";
import type { ClientProfile } from "@/types";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
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
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AdminClientsDirectory({ clients }: { clients: ClientProfile[] }) {
  const repeatClients = clients.filter((client) => client.visits > 1).length;
  const upcomingClients = clients.filter((client) => client.nextVisit !== "Not booked").length;
  const totalSpentCents = clients.reduce((total, client) => total + client.totalSpentCents, 0);

  return (
    <main className="admin-shell clients-directory-page">
      <header className="admin-header">
        <Link href="/" className="admin-back">
          Client site
        </Link>
        <div>
          <p>Relationships, loyalty, and booking history</p>
          <h1>Clients</h1>
        </div>
        <Link href="/admin/appointments" className="admin-back">
          Calendar
        </Link>
      </header>

      <section className="clients-directory-grid">
        <div className="client-directory-metrics" aria-label="Client summary">
          <article>
            <UsersRound size={19} />
            <span>Total clients</span>
            <strong>{clients.length}</strong>
          </article>
          <article>
            <Repeat2 size={19} />
            <span>Repeat clients</span>
            <strong>{repeatClients}</strong>
          </article>
          <article>
            <CalendarCheck2 size={19} />
            <span>Booked ahead</span>
            <strong>{upcomingClients}</strong>
          </article>
          <article>
            <DollarSign size={19} />
            <span>Client value</span>
            <strong>{money(totalSpentCents)}</strong>
          </article>
        </div>

        <div className="admin-card client-list-card client-directory-card">
          <div className="admin-card-title">
            <UsersRound size={18} />
            <span>Client directory</span>
            <small>{clients.length} total</small>
          </div>
          <div className="client-list-summary">
            <strong>{clients.length}</strong>
            <p>Contact details, visit history, loyalty progress, future bookings, and appointment notes in one place.</p>
          </div>

          {clients.length ? (
            <div className="client-account-list">
              {clients.map((client) => (
                <article key={client.id} className="client-account-row">
                  <div className="client-account-avatar" aria-hidden="true">
                    {initials(client.name)}
                  </div>
                  <div className="client-account-main">
                    <div>
                      <strong>{client.name}</strong>
                      <span>Since {clientSince(client.createdAt)}</span>
                    </div>
                    {client.email ? <p>{client.email}</p> : null}
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
                    {client.email ? (
                      <a href={`mailto:${client.email}`} aria-label={`Email ${client.name}`}>
                        <Mail size={15} />
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-client-state">
              <CalendarDays size={34} />
              <h2>No clients yet</h2>
              <p>Clients appear here automatically after their first booking.</p>
              <Link href="/admin/appointments" className="admin-back">
                Add an appointment
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
