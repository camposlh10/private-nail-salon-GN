"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Pencil, Plus, Save, Scissors, Trash2, X, XCircle } from "lucide-react";
import type { Service, TimeSlot } from "@/types";

type ServiceDraft = {
  name: string;
  category: string;
  priceCents: number;
  durationMinutes: number;
  description: string;
  imageUrl: string;
  popular?: boolean;
  addon?: boolean;
};

const emptyDraft: ServiceDraft = {
  name: "",
  category: "manicure",
  priceCents: 6500,
  durationMinutes: 60,
  description: "",
  imageUrl: "https://images.unsplash.com/photo-1612887390768-fb02affea7a6?auto=format&fit=crop&w=900&q=85",
  popular: false,
  addon: false,
};

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function draftFromService(service: Service): ServiceDraft {
  return {
    name: service.name,
    category: service.category,
    priceCents: service.priceCents,
    durationMinutes: service.durationMinutes,
    description: service.description,
    imageUrl: service.imageUrl,
    popular: Boolean(service.popular),
    addon: Boolean(service.addon),
  };
}

function dollars(cents: number) {
  return Math.round(cents / 100);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

function timeLabelFromMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hours, minutes));
}

function selectedDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function slotRange(slot: TimeSlot) {
  return `${slot.label} - ${timeLabelFromMinutes(timeToMinutes(slot.time) + 30)}`;
}

export function AdminControls() {
  const [services, setServices] = useState<Service[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ServiceDraft>>({});
  const [newService, setNewService] = useState<ServiceDraft>(emptyDraft);
  const [selectedDate, setSelectedDate] = useState(dateValue(new Date()));
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const manicureCount = useMemo(() => services.filter((service) => service.category === "manicure").length, [services]);
  const pedicureCount = useMemo(() => services.filter((service) => service.category === "pedicure").length, [services]);
  const openSlotCount = slots.filter((slot) => slot.available).length;
  const blockedSlotCount = slots.length - openSlotCount;

  async function loadServices() {
    const response = await fetch("/api/services");
    const payload = (await response.json()) as { services?: Service[] };
    const nextServices = payload.services ?? [];

    setServices(nextServices);
    setDrafts(Object.fromEntries(nextServices.map((service) => [service.id, draftFromService(service)])));
  }

  async function loadAvailability(date = selectedDate) {
    const response = await fetch(`/api/availability?date=${date}&duration=30`);
    const payload = (await response.json()) as { slots?: TimeSlot[] };
    setSlots(payload.slots ?? []);
  }

  useEffect(() => {
    loadServices().catch(() => setStatus("Could not load services."));
  }, []);

  useEffect(() => {
    loadAvailability(selectedDate).catch(() => setStatus("Could not load availability."));
  }, [selectedDate]);

  async function saveService(id: string) {
    const draft = drafts[id];

    if (!draft) return;

    const response = await fetch(`/api/services/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft),
    });

    if (!response.ok) {
      setStatus("Service could not be saved.");
      return;
    }

    setStatus("Service saved. Clients will see the update.");
    await loadServices();
  }

  async function addService() {
    const response = await fetch("/api/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newService),
    });

    if (!response.ok) {
      setStatus("New service could not be added.");
      return;
    }

    setStatus("New service added.");
    setNewService(emptyDraft);
    await loadServices();
  }

  async function removeService(service: Service) {
    const confirmed = window.confirm(`Delete ${service.name}? Clients will no longer see this service.`);

    if (!confirmed) return;

    const response = await fetch(`/api/services/${service.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setStatus("Service could not be deleted.");
      return;
    }

    setStatus(`${service.name} deleted. Clients will no longer see it.`);
    await loadServices();
  }

  async function toggleSlot(slot: TimeSlot) {
    const response = await fetch("/api/availability", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: selectedDate,
        time: slot.time,
        available: !slot.available,
      }),
    });

    if (!response.ok) {
      setStatus("Availability could not be updated.");
      return;
    }

    setStatus(`${slot.label} is now ${slot.available ? "blocked" : "available"}.`);
    await loadAvailability(selectedDate);
  }

  function updateDraft(id: string, patch: Partial<ServiceDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  const renderFields = (draft: ServiceDraft, onChange: (patch: Partial<ServiceDraft>) => void) => (
    <div className="svc-fields">
      <label>Name
        <input value={draft.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Gel Fill" />
      </label>
      <label>Category
        <select value={draft.category} onChange={(e) => onChange({ category: e.target.value })}>
          <option value="manicure">Manicure</option>
          <option value="pedicure">Pedicure</option>
        </select>
      </label>
      <label>Price ($)
        <input type="number" min={0} value={dollars(draft.priceCents)} onChange={(e) => onChange({ priceCents: Number(e.target.value) * 100 })} />
      </label>
      <label>Duration (min)
        <input type="number" min={15} step={15} value={draft.durationMinutes} onChange={(e) => onChange({ durationMinutes: Number(e.target.value) })} />
      </label>
      <label className="svc-full">Description
        <textarea value={draft.description} onChange={(e) => onChange({ description: e.target.value })} />
      </label>
      <label className="svc-full">Image URL
        <input value={draft.imageUrl} onChange={(e) => onChange({ imageUrl: e.target.value })} placeholder="https://…" />
      </label>
      <label className="svc-full svc-check">
        <input type="checkbox" checked={Boolean(draft.addon)} onChange={(e) => onChange({ addon: e.target.checked })} />
        Add-on / extra (shown under &quot;Add extras&quot; when booking)
      </label>
    </div>
  );

  return (
    <section className="admin-management" id="manage">
      <div className="admin-management-heading">
        <div>
          <p>Studio controls</p>
          <h2>Services &amp; availability</h2>
        </div>
        <span>{manicureCount} manicure · {pedicureCount} pedicure</span>
      </div>

      {status ? <p className="admin-status">{status}</p> : null}

      <div className="svc-layout">
        {/* Services */}
        <div className="admin-card svc-card">
          <div className="svc-card-head">
            <h3><Scissors size={17} /> Services</h3>
            <button type="button" className="svc-add-btn" onClick={() => { setEditingId(editingId === "new" ? null : "new"); setNewService(emptyDraft); }}>
              {editingId === "new" ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add service</>}
            </button>
          </div>

          {editingId === "new" ? (
            <div className="svc-newform">
              {renderFields(newService, (patch) => setNewService((current) => ({ ...current, ...patch })))}
              <button type="button" className="svc-primary" onClick={async () => { await addService(); setEditingId(null); }}>
                <Plus size={16} /> Add service
              </button>
            </div>
          ) : null}

          <div className="svc-list">
            {services.length ? services.map((service) => {
              const draft = drafts[service.id] ?? draftFromService(service);
              const open = editingId === service.id;

              return (
                <div className={`svc-item${open ? " is-open" : ""}`} key={service.id}>
                  <div className="svc-item-row">
                    {draft.imageUrl ? <img src={draft.imageUrl} alt="" /> : <span className="svc-thumb-fallback"><Scissors size={16} /></span>}
                    <div className="svc-item-main">
                      <strong>{service.name}</strong>
                      <span>
                        ${dollars(service.priceCents)} · {service.durationMinutes} min · {service.category}
                        {service.addon ? <em className="svc-badge">add-on</em> : null}
                      </span>
                    </div>
                    <div className="svc-item-actions">
                      <button type="button" className="svc-edit" onClick={() => setEditingId(open ? null : service.id)}>
                        <Pencil size={14} /> {open ? "Close" : "Edit"}
                      </button>
                      <button type="button" className="svc-delete" onClick={() => removeService(service)}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>

                  {open ? (
                    <div className="svc-editform">
                      {renderFields(draft, (patch) => updateDraft(service.id, patch))}
                      <button type="button" className="svc-primary" onClick={() => saveService(service.id)}>
                        <Save size={16} /> Save changes
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            }) : (
              <div className="svc-empty">
                <strong>No services yet.</strong>
                <p>Click &quot;Add service&quot; to create your first one.</p>
              </div>
            )}
          </div>
        </div>

        {/* Availability */}
        <div className="admin-card svc-card">
          <div className="svc-card-head">
            <h3><CalendarDays size={17} /> Availability</h3>
            <input className="svc-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <p className="svc-subhead">{selectedDateLabel(selectedDate)}</p>
          <div className="svc-avail-counts">
            <span className="count-showed">{openSlotCount} open</span>
            <span className="count-noshow">{blockedSlotCount} blocked</span>
          </div>

          {slots.length ? (
            <div className="svc-slots">
              {slots.map((slot) => (
                <button
                  type="button"
                  key={slot.time}
                  className={`svc-slot ${slot.available ? "is-open" : "is-blocked"}`}
                  onClick={() => toggleSlot(slot)}
                  title={slotRange(slot)}
                >
                  {slot.available ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  <time>{slot.label}</time>
                  <small>{slot.available ? "Open" : "Blocked"}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="svc-empty"><strong>Closed this day.</strong><p>Set this weekday open in Settings → Business hours.</p></div>
          )}

          <p className="svc-note">Tap a time to block or reopen it. Clients only see times with enough room for their selected services.</p>
        </div>
      </div>
    </section>
  );
}
