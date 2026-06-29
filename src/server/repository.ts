import type { AdminAppointment, AdminNotification, AdminOverview, Appointment, AppointmentStatus, BookingConfirmation, BookingRequest, ClientProfile, ClientReview, Expense, Promotion, RevenueSummary, Service, TimeSlot } from "@/types";
import { randomUUID } from "node:crypto";
import { demoAppointments, demoClients, demoOverview } from "./demo-data";
import { readStore, slugifyServiceName, writeStore } from "./demo-store";
import { getReadyPool, queryRows } from "./db";
import { getStudioConfig } from "./studio";
import { getSettings, type BusinessHours, type WeekdayHours } from "./settings";

type ServiceRow = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  category: string;
  imageUrl: string;
  popular: boolean;
  addon: boolean;
};

type AppointmentRow = {
  id: string;
  clientName: string;
  serviceName: string;
  startAt: Date;
  durationMinutes: number;
  status: Appointment["status"];
  priceCents: number;
};

type AdminAppointmentRow = AppointmentRow & {
  clientEmail: string;
  clientPhone: string;
  serviceIds: string[];
  notes: string;
  tipCents: number;
  discountCents: number;
};

type AppointmentBlockRow = {
  id?: string;
  appointmentTime: Date;
  durationMinutes: number;
};

type BookingConfirmationRow = {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceName: string;
  startAt: Date;
  durationMinutes: number;
  priceCents: number;
  discountCents: number;
  promoCode: string | null;
  notes: string;
};

type AvailabilityOverrideRow = {
  time: string;
  available: boolean;
};

type AdminNotificationRow = {
  id: string;
  type: AdminNotification["type"];
  title: string;
  body: string;
  createdAt: Date;
  read: boolean;
  appointmentId?: string;
};

type ClientProfileRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  visits: number;
  totalSpentCents: number;
  lastVisit: Date | null;
  nextVisit: Date | null;
  loyaltyVisits: number;
  notes: string;
  createdAt: Date;
};

export type ServiceInput = {
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  category: string;
  imageUrl: string;
  popular?: boolean;
  addon?: boolean;
};

const SLOT_STEP_MINUTES = 30;

function dayHoursFor(date: string, hours: BusinessHours): WeekdayHours {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return hours.days[weekday] ?? { open: false, openMinutes: 9 * 60, closeMinutes: 18 * 60 };
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60).toString().padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

function timeLabel(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hours, minutes));
}

function dateLabel(value?: Date | string | null, fallback = "Not booked") {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function dateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function timeKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function endAt(startAt: string, durationMinutes: number) {
  return new Date(new Date(startAt).getTime() + durationMinutes * 60 * 1000).toISOString();
}

function rowToAdminAppointment(row: AdminAppointmentRow, source: AdminAppointment["source"]): AdminAppointment {
  const startAt = row.startAt.toISOString();

  return {
    id: row.id,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    serviceIds: row.serviceIds?.length ? row.serviceIds : [],
    serviceName: row.serviceName,
    startAt,
    endAt: endAt(startAt, row.durationMinutes),
    durationMinutes: row.durationMinutes,
    status: row.status,
    priceCents: row.priceCents,
    tipCents: row.tipCents ?? 0,
    discountCents: row.discountCents ?? 0,
    notes: row.notes,
    source,
  };
}

function mergeClients(clients: ClientProfile[]) {
  const seen = new Set<string>();
  const merged: ClientProfile[] = [];

  for (const client of clients) {
    const key = client.email.toLowerCase() || client.id;

    if (seen.has(key)) continue;

    seen.add(key);
    merged.push(client);
  }

  return merged;
}

function baseSlots(date: string, durationMinutes: number, hours: BusinessHours) {
  const dayHours = dayHoursFor(date, hours);
  const step = hours.slotStepMinutes || SLOT_STEP_MINUTES;
  const safeDuration = Math.max(durationMinutes, step);
  const slots: TimeSlot[] = [];

  if (!dayHours.open) {
    return slots;
  }

  for (let minutes = dayHours.openMinutes; minutes + safeDuration <= dayHours.closeMinutes; minutes += step) {
    const time = minutesToTime(minutes);
    slots.push({
      time,
      label: timeLabel(time),
      available: true,
    });
  }

  return slots;
}

function intervalOverlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

function computeDiscount(promotions: Promotion[], code: string | undefined, subtotalCents: number): { discountCents: number; promoCode: string } {
  if (!code) return { discountCents: 0, promoCode: "" };
  const promo = (promotions ?? []).find((item) => item.active && item.code.toUpperCase() === code.trim().toUpperCase());
  if (!promo) return { discountCents: 0, promoCode: "" };
  const raw = promo.kind === "percent" ? Math.round((subtotalCents * promo.value) / 100) : promo.value;
  return { discountCents: Math.max(0, Math.min(raw, subtotalCents)), promoCode: promo.code };
}

function slotTouchesBlockedTime(slotStart: number, durationMinutes: number, blockedTimes: Set<string>, step = SLOT_STEP_MINUTES) {
  for (let minutes = slotStart; minutes < slotStart + durationMinutes; minutes += step) {
    if (blockedTimes.has(minutesToTime(minutes))) {
      return true;
    }
  }

  return false;
}

export async function listServices(): Promise<Service[]> {
  const rows = await queryRows<ServiceRow>(`
    select
      id,
      name,
      description,
      duration_minutes as "durationMinutes",
      price_cents as "priceCents",
      category,
      coalesce(image_url, '') as "imageUrl",
      is_popular as popular,
      coalesce(is_addon, false) as addon
    from services
    where active = true
    order by sort_order, name
  `);

  if (rows) {
    return rows;
  }

  return (await readStore()).services;
}

export async function listUpcomingAppointments(limit = 8): Promise<Appointment[]> {
  const rows = await queryRows<AppointmentRow>(`
    select
      appointments.id,
      clients.name as "clientName",
      coalesce(
        (
          select string_agg(selected_services.name, ' + ' order by selected_services.sort_order, selected_services.name)
          from services selected_services
          where selected_services.id = any(appointments.service_ids)
        ),
        services.name
      ) as "serviceName",
      appointments.appointment_at as "startAt",
      coalesce(appointments.duration_minutes, services.duration_minutes) as "durationMinutes",
      appointments.status,
      coalesce(appointments.price_cents, services.price_cents) as "priceCents"
    from appointments
    join clients on clients.id = appointments.client_id
    join services on services.id = appointments.service_id
    where appointments.appointment_at >= now()
    order by appointments.appointment_at asc
    limit $1
  `, [limit]);

  if (rows) {
    return rows.map((row) => ({
      ...row,
      startAt: row.startAt.toISOString(),
    }));
  }

  {
    const store = await readStore();
    const storeAppointments: Appointment[] = store.appointments
      .filter((appointment) => appointment.status !== "cancelled")
      .map((appointment) => ({
        id: appointment.id,
        clientName: appointment.clientName,
        serviceName: appointment.serviceName,
        startAt: appointment.appointmentAt,
        durationMinutes: appointment.durationMinutes,
        status: appointment.status ?? "confirmed",
        priceCents: appointment.priceCents,
      }));

    return [...storeAppointments, ...demoAppointments]
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, limit);
  }
}

export async function listAdminAppointments(options: { limit?: number; date?: string; month?: string; upcomingOnly?: boolean } = {}): Promise<AdminAppointment[]> {
  const limit = options.limit ?? (options.month ? 500 : 80);
  const filters = ["appointments.status <> 'cancelled'"];
  const params: unknown[] = [];

  if (options.date) {
    params.push(options.date);
    filters.push(`appointments.appointment_at::date = $${params.length}`);
  } else if (options.month) {
    const [year, monthNum] = options.month.split("-").map(Number);
    const start = `${options.month}-01`;
    const next = monthNum === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;
    params.push(start);
    params.push(next);
    filters.push(`appointments.appointment_at >= $${params.length - 1} and appointments.appointment_at < $${params.length}`);
  } else if (options.upcomingOnly !== false) {
    filters.push("appointments.appointment_at >= now()");
  }

  params.push(limit);

  const rows = await queryRows<AdminAppointmentRow>(`
    select
      appointments.id,
      clients.name as "clientName",
      clients.email as "clientEmail",
      clients.phone as "clientPhone",
      coalesce(
        (
          select string_agg(selected_services.name, ' + ' order by selected_services.sort_order, selected_services.name)
          from services selected_services
          where selected_services.id = any(appointments.service_ids)
        ),
        services.name
      ) as "serviceName",
      case
        when array_length(appointments.service_ids, 1) is null then array[appointments.service_id]
        else appointments.service_ids
      end as "serviceIds",
      appointments.appointment_at as "startAt",
      coalesce(appointments.duration_minutes, services.duration_minutes) as "durationMinutes",
      appointments.status,
      coalesce(appointments.price_cents, services.price_cents) as "priceCents",
      coalesce(appointments.tip_cents, 0) as "tipCents",
      coalesce(appointments.discount_cents, 0) as "discountCents",
      appointments.notes
    from appointments
    join clients on clients.id = appointments.client_id
    join services on services.id = appointments.service_id
    where ${filters.join(" and ")}
    order by appointments.appointment_at asc
    limit $${params.length}
  `, params);

  if (rows) {
    return rows.map((row) => rowToAdminAppointment(row, "postgres"));
  }

  const store = await readStore();
  const now = Date.now();
  const storeAppointments = store.appointments
    .filter((appointment) => appointment.status !== "cancelled")
    .filter((appointment) => {
      if (options.date) return appointment.appointmentAt.startsWith(options.date);
      if (options.month) return appointment.appointmentAt.startsWith(options.month);
      if (options.upcomingOnly === false) return true;

      return new Date(appointment.appointmentAt).getTime() >= now;
    })
    .map<AdminAppointment>((appointment) => ({
      id: appointment.id,
      clientName: appointment.clientName,
      clientEmail: appointment.clientEmail ?? "",
      clientPhone: appointment.clientPhone,
      serviceIds: appointment.serviceIds,
      serviceName: appointment.serviceName,
      startAt: appointment.appointmentAt,
      endAt: endAt(appointment.appointmentAt, appointment.durationMinutes),
      durationMinutes: appointment.durationMinutes,
      status: appointment.status ?? "confirmed",
      priceCents: appointment.priceCents,
      tipCents: appointment.tipCents ?? 0,
      discountCents: appointment.discountCents ?? 0,
      notes: appointment.notes,
      source: "store",
    }));

  const demoAdminAppointments = options.date || options.month
    ? []
    : demoAppointments.map<AdminAppointment>((appointment) => ({
        ...appointment,
        clientEmail: "",
        clientPhone: "",
        serviceIds: [],
        endAt: endAt(appointment.startAt, appointment.durationMinutes),
        notes: "Sample appointment for layout preview.",
        source: "demo",
      }));

  return [...storeAppointments, ...demoAdminAppointments]
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, limit);
}

export async function listAdminNotifications(limit = 6): Promise<AdminNotification[]> {
  const rows = await queryRows<AdminNotificationRow>(`
    select
      id,
      type,
      title,
      body,
      created_at as "createdAt",
      read,
      appointment_id::text as "appointmentId"
    from admin_notifications
    order by created_at desc
    limit $1
  `, [limit]);

  if (rows) {
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  const store = await readStore();

  return store.notifications.slice(0, limit);
}

export async function listClientProfiles(): Promise<ClientProfile[]> {
  const rows = await queryRows<ClientProfileRow>(`
    select
      clients.id::text as id,
      clients.name,
      clients.phone,
      clients.email,
      (count(appointments.id) filter (where appointments.status <> 'cancelled'))::int as visits,
      coalesce(
        sum(coalesce(appointments.price_cents, services.price_cents))
          filter (where appointments.status <> 'cancelled'),
        0
      )::int as "totalSpentCents",
      max(appointments.appointment_at)
        filter (where appointments.appointment_at < now() and appointments.status <> 'cancelled') as "lastVisit",
      min(appointments.appointment_at)
        filter (where appointments.appointment_at >= now() and appointments.status <> 'cancelled') as "nextVisit",
      case
        when clients.loyalty_visits > 0 then clients.loyalty_visits
        else ((count(appointments.id) filter (where appointments.status <> 'cancelled'))::int % 10)
      end as "loyaltyVisits",
      clients.notes,
      clients.created_at as "createdAt"
    from clients
    left join appointments on appointments.client_id = clients.id
    left join services on services.id = appointments.service_id
    group by clients.id
    order by
      max(appointments.appointment_at) desc nulls last,
      clients.created_at desc
  `);

  if (rows) {
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      visits: row.visits,
      totalSpentCents: row.totalSpentCents,
      lastVisit: dateLabel(row.lastVisit, "No visits yet"),
      nextVisit: dateLabel(row.nextVisit),
      loyaltyVisits: Math.min(row.loyaltyVisits, 10),
      notes: row.notes || "No notes yet.",
      createdAt: row.createdAt.toISOString(),
    }));
  }

  const store = await readStore();
  const grouped = new Map<string, ClientProfile & { rawLastVisit?: string; rawNextVisit?: string }>();
  const now = Date.now();

  for (const appointment of store.appointments.filter((item) => item.status !== "cancelled")) {
    const email = appointment.clientEmail?.trim().toLowerCase();
    const key = email || appointment.clientPhone || appointment.clientName;
    const existing = grouped.get(key);
    const appointmentTime = new Date(appointment.appointmentAt).getTime();

    if (!existing) {
      grouped.set(key, {
        id: `store-client-${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
        name: appointment.clientName,
        phone: appointment.clientPhone ?? "",
        email: appointment.clientEmail ?? "",
        visits: 1,
        totalSpentCents: appointment.priceCents,
        lastVisit: "No visits yet",
        nextVisit: "Not booked",
        loyaltyVisits: 1,
        notes: appointment.notes || "No notes yet.",
        createdAt: appointment.appointmentAt,
        rawLastVisit: appointmentTime < now ? appointment.appointmentAt : undefined,
        rawNextVisit: appointmentTime >= now ? appointment.appointmentAt : undefined,
      });
      continue;
    }

    existing.visits += 1;
    existing.totalSpentCents += appointment.priceCents;
    existing.loyaltyVisits = existing.visits % 10;
    existing.phone = existing.phone || appointment.clientPhone || "";
    existing.email = existing.email || appointment.clientEmail || "";

    if (appointment.notes) {
      existing.notes = appointment.notes;
    }

    if (appointmentTime < now && (!existing.rawLastVisit || appointmentTime > new Date(existing.rawLastVisit).getTime())) {
      existing.rawLastVisit = appointment.appointmentAt;
    }

    if (appointmentTime >= now && (!existing.rawNextVisit || appointmentTime < new Date(existing.rawNextVisit).getTime())) {
      existing.rawNextVisit = appointment.appointmentAt;
    }
  }

  const storeClients = Array.from(grouped.values()).map(({ rawLastVisit, rawNextVisit, ...client }) => ({
    ...client,
    lastVisit: dateLabel(rawLastVisit, "No visits yet"),
    nextVisit: dateLabel(rawNextVisit),
    loyaltyVisits: Math.min(client.loyaltyVisits || (client.visits ? 10 : 0), 10),
  }));

  return mergeClients([...storeClients, ...demoClients]);
}

export async function createAdminNotification(input: Omit<AdminNotification, "id" | "createdAt" | "read">) {
  const activePool = await getReadyPool();

  if (!activePool) {
    const store = await readStore();
    const notification: AdminNotification = {
      id: `notification-${Date.now()}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...input,
    };

    store.notifications = [notification, ...store.notifications].slice(0, 30);
    await writeStore(store);

    return notification;
  }

  const rows = await queryRows<AdminNotificationRow>(`
    insert into admin_notifications (type, title, body, appointment_id)
    values ($1, $2, $3, $4)
    returning
      id,
      type,
      title,
      body,
      created_at as "createdAt",
      read,
      appointment_id::text as "appointmentId"
  `, [input.type, input.title, input.body, input.appointmentId ?? null]);

  if (!rows?.[0]) {
    return {
      id: `notification-${Date.now()}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...input,
    };
  }

  return {
    ...rows[0],
    createdAt: rows[0].createdAt.toISOString(),
  };
}

export async function getAvailability(date: string, durationMinutes = SLOT_STEP_MINUTES): Promise<TimeSlot[]> {
  const { hours } = await getSettings();
  const step = hours.slotStepMinutes || SLOT_STEP_MINUTES;
  const slots = baseSlots(date, durationMinutes, hours);
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59`);

  const rows = await queryRows<AppointmentBlockRow>(`
    select
      appointments.appointment_at as "appointmentTime",
      coalesce(appointments.duration_minutes, services.duration_minutes) as "durationMinutes"
    from appointments
    join services on services.id = appointments.service_id
    where appointment_at between $1 and $2
      and status in ('confirmed', 'checked_in')
  `, [start, end]);

  const overrides = await queryRows<AvailabilityOverrideRow>(`
    select time, available
    from availability_overrides
    where date = $1
  `, [date]);

  if (rows || overrides) {
    const blockedTimes = new Set(
      (overrides ?? [])
        .filter((override) => !override.available)
        .map((override) => override.time),
    );

    return slots.map((slot) => {
      const slotStart = timeToMinutes(slot.time);
      const slotEnd = slotStart + durationMinutes;
      const overlapsAppointment = (rows ?? []).some((row) => {
        const appointmentStart = row.appointmentTime.getHours() * 60 + row.appointmentTime.getMinutes();
        const appointmentEnd = appointmentStart + row.durationMinutes;

        return intervalOverlaps(slotStart, slotEnd, appointmentStart, appointmentEnd);
      });

      return {
        ...slot,
        available: slot.available && !overlapsAppointment && !slotTouchesBlockedTime(slotStart, durationMinutes, blockedTimes, step),
      };
    });
  }

  const store = await readStore();
  const blockedTimes = new Set(
    Object.entries({
      ...(store.availabilityOverrides.default ?? {}),
      ...(store.availabilityOverrides[date] ?? {}),
    })
      .filter(([, available]) => !available)
      .map(([time]) => time),
  );
  const bookedAppointments = store.appointments.filter((appointment) => appointment.status !== "cancelled" && appointment.appointmentAt.startsWith(date));

  return slots.map((slot) => {
    const slotStart = timeToMinutes(slot.time);
    const slotEnd = slotStart + durationMinutes;
    const overlapsAppointment = bookedAppointments.some((appointment) => {
      const appointmentStart = timeToMinutes(appointment.appointmentAt.slice(11, 16));
      const appointmentEnd = appointmentStart + appointment.durationMinutes;

      return intervalOverlaps(slotStart, slotEnd, appointmentStart, appointmentEnd);
    });

    return {
      ...slot,
      available: slot.available && !overlapsAppointment && !slotTouchesBlockedTime(slotStart, durationMinutes, blockedTimes, step),
    };
  });
}

export async function createBooking(payload: BookingRequest): Promise<BookingConfirmation> {
  const activePool = await getReadyPool();
  const studio = await getStudioConfig();
  const serviceIds = payload.serviceIds?.length ? payload.serviceIds : payload.serviceId ? [payload.serviceId] : [];
  const selectedServices = (await listServices()).filter((service) => serviceIds.includes(service.id));

  if (!selectedServices.length || selectedServices.length !== serviceIds.length) {
    throw new Error("Unknown service.");
  }

  const totalDuration = selectedServices.reduce((sum, service) => sum + service.durationMinutes, 0);
  const totalPrice = selectedServices.reduce((sum, service) => sum + service.priceCents, 0);
  const serviceName = selectedServices.map((service) => service.name).join(" + ");
  const { discountCents, promoCode } = computeDiscount((await getSettings()).promotions, payload.promoCode, totalPrice);
  const matchingSlot = (await getAvailability(payload.date, totalDuration)).find((slot) => slot.time === payload.time);

  if (!matchingSlot?.available) {
    throw new Error("That time is no longer available for the selected services.");
  }

  if (!activePool) {
    const store = await readStore();
    const appointmentAt = `${payload.date}T${payload.time}:00`;
    const appointment = {
      id: `demo-${Date.now()}`,
      serviceIds,
      serviceName,
      clientName: payload.name,
      clientEmail: payload.email,
      clientPhone: payload.phone,
      appointmentAt,
      durationMinutes: totalDuration,
      priceCents: totalPrice,
      discountCents,
      promoCode,
      status: "confirmed" as const,
      notes: payload.notes,
    };

    store.appointments = [...store.appointments, appointment];
    await writeStore(store);
    await createAdminNotification({
      type: "booking",
      title: "New appointment booked",
      body: `${payload.name} booked ${serviceName} for ${timeLabel(payload.time)}.`,
      appointmentId: appointment.id,
    });

    return {
      id: appointment.id,
      serviceName,
      startAt: appointmentAt,
      durationMinutes: totalDuration,
      priceCents: totalPrice,
      discountCents,
      promoCode,
      clientName: payload.name,
      clientEmail: payload.email,
      clientPhone: payload.phone,
      notes: payload.notes,
      locationName: studio.locationName,
      locationAddress: studio.address,
      mapsUrl: studio.mapsUrl,
    };
  }

  const client = await activePool.connect();

  try {
    await client.query("begin");

    const clientResult = await client.query<{ id: string }>(`
      insert into clients (name, email, phone)
      values ($1, $2, $3)
      on conflict (email) do update
        set name = excluded.name,
            phone = excluded.phone,
            updated_at = now()
      returning id
    `, [payload.name, payload.email, payload.phone ?? ""]);

    const appointmentAt = new Date(`${payload.date}T${payload.time}:00`);
    const appointmentResult = await client.query<{ id: string }>(`
      insert into appointments (client_id, service_id, service_ids, appointment_at, duration_minutes, price_cents, discount_cents, promo_code, notes, status)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed')
      returning id
    `, [clientResult.rows[0].id, selectedServices[0].id, serviceIds, appointmentAt, totalDuration, totalPrice, discountCents, promoCode || null, payload.notes ?? ""]);

    await client.query("commit");
    await createAdminNotification({
      type: "booking",
      title: "New appointment booked",
      body: `${payload.name} booked ${serviceName} for ${timeLabel(payload.time)}.`,
      appointmentId: appointmentResult.rows[0].id,
    });

    return {
      id: appointmentResult.rows[0].id,
      serviceName,
      startAt: appointmentAt.toISOString(),
      durationMinutes: totalDuration,
      priceCents: totalPrice,
      discountCents,
      promoCode,
      clientName: payload.name,
      clientEmail: payload.email,
      clientPhone: payload.phone,
      notes: payload.notes,
      locationName: studio.locationName,
      locationAddress: studio.address,
      mapsUrl: studio.mapsUrl,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getBookingConfirmation(id: string): Promise<BookingConfirmation | null> {
  const studio = await getStudioConfig();
  const rows = await queryRows<BookingConfirmationRow>(`
    select
      appointments.id,
      clients.name as "clientName",
      clients.email as "clientEmail",
      clients.phone as "clientPhone",
      coalesce(
        (
          select string_agg(selected_services.name, ' + ' order by selected_services.sort_order, selected_services.name)
          from services selected_services
          where selected_services.id = any(appointments.service_ids)
        ),
        services.name
      ) as "serviceName",
      appointments.appointment_at as "startAt",
      coalesce(appointments.duration_minutes, services.duration_minutes) as "durationMinutes",
      coalesce(appointments.price_cents, services.price_cents) as "priceCents",
      coalesce(appointments.discount_cents, 0) as "discountCents",
      appointments.promo_code as "promoCode",
      appointments.notes
    from appointments
    join clients on clients.id = appointments.client_id
    join services on services.id = appointments.service_id
    where appointments.id = $1
    limit 1
  `, [id]);

  if (rows) {
    const row = rows[0];

    if (!row) return null;

    return {
      id: row.id,
      serviceName: row.serviceName,
      startAt: row.startAt.toISOString(),
      durationMinutes: row.durationMinutes,
      priceCents: row.priceCents,
      discountCents: row.discountCents ?? 0,
      promoCode: row.promoCode ?? undefined,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      clientPhone: row.clientPhone,
      notes: row.notes,
      locationName: studio.locationName,
      locationAddress: studio.address,
      mapsUrl: studio.mapsUrl,
    };
  }

  const store = await readStore();
  const appointment = store.appointments.find((item) => item.id === id);

  if (!appointment) return null;

  return {
    id: appointment.id,
    serviceName: appointment.serviceName,
    startAt: appointment.appointmentAt,
    durationMinutes: appointment.durationMinutes,
    priceCents: appointment.priceCents,
    discountCents: appointment.discountCents ?? 0,
    promoCode: appointment.promoCode,
    clientName: appointment.clientName,
    clientEmail: appointment.clientEmail ?? "",
    clientPhone: appointment.clientPhone,
    notes: appointment.notes,
    locationName: studio.locationName,
    locationAddress: studio.address,
    mapsUrl: studio.mapsUrl,
  };
}

export async function getAdminAppointment(id: string): Promise<AdminAppointment | null> {
  const rows = await queryRows<AdminAppointmentRow>(`
    select
      appointments.id,
      clients.name as "clientName",
      clients.email as "clientEmail",
      clients.phone as "clientPhone",
      coalesce(
        (
          select string_agg(selected_services.name, ' + ' order by selected_services.sort_order, selected_services.name)
          from services selected_services
          where selected_services.id = any(appointments.service_ids)
        ),
        services.name
      ) as "serviceName",
      case
        when array_length(appointments.service_ids, 1) is null then array[appointments.service_id]
        else appointments.service_ids
      end as "serviceIds",
      appointments.appointment_at as "startAt",
      coalesce(appointments.duration_minutes, services.duration_minutes) as "durationMinutes",
      appointments.status,
      coalesce(appointments.price_cents, services.price_cents) as "priceCents",
      coalesce(appointments.tip_cents, 0) as "tipCents",
      coalesce(appointments.discount_cents, 0) as "discountCents",
      appointments.notes
    from appointments
    join clients on clients.id = appointments.client_id
    join services on services.id = appointments.service_id
    where appointments.id = $1
    limit 1
  `, [id]);

  if (rows) {
    return rows[0] ? rowToAdminAppointment(rows[0], "postgres") : null;
  }

  const store = await readStore();
  const appointment = store.appointments.find((item) => item.id === id);

  if (!appointment) return null;

  return {
    id: appointment.id,
    clientName: appointment.clientName,
    clientEmail: appointment.clientEmail ?? "",
    clientPhone: appointment.clientPhone,
    serviceIds: appointment.serviceIds,
    serviceName: appointment.serviceName,
    startAt: appointment.appointmentAt,
    endAt: endAt(appointment.appointmentAt, appointment.durationMinutes),
    durationMinutes: appointment.durationMinutes,
    status: appointment.status ?? "confirmed",
    priceCents: appointment.priceCents,
    tipCents: appointment.tipCents ?? 0,
    discountCents: appointment.discountCents ?? 0,
    notes: appointment.notes,
    source: "store",
  };
}

async function appointmentWindowIsOpen(date: string, time: string, durationMinutes: number, ignoreAppointmentId?: string) {
  const { hours } = await getSettings();
  const step = hours.slotStepMinutes || SLOT_STEP_MINUTES;
  const dayHours = dayHoursFor(date, hours);
  const slotStart = timeToMinutes(time);
  const slotEnd = slotStart + durationMinutes;

  if (!dayHours.open || slotStart < dayHours.openMinutes || slotEnd > dayHours.closeMinutes) {
    return false;
  }

  const rows = await queryRows<AppointmentBlockRow>(`
    select
      appointments.id::text as id,
      appointments.appointment_at as "appointmentTime",
      coalesce(appointments.duration_minutes, services.duration_minutes) as "durationMinutes"
    from appointments
    join services on services.id = appointments.service_id
    where appointment_at::date = $1
      and status in ('confirmed', 'checked_in')
      and appointments.id::text <> $2
  `, [date, ignoreAppointmentId ?? ""]);

  const overrides = await queryRows<AvailabilityOverrideRow>(`
    select time, available
    from availability_overrides
    where date = $1
  `, [date]);

  if (rows || overrides) {
    const blockedTimes = new Set((overrides ?? []).filter((override) => !override.available).map((override) => override.time));
    const overlapsAppointment = (rows ?? []).some((row) => {
      const appointmentStart = row.appointmentTime.getHours() * 60 + row.appointmentTime.getMinutes();
      const appointmentEnd = appointmentStart + row.durationMinutes;

      return intervalOverlaps(slotStart, slotEnd, appointmentStart, appointmentEnd);
    });

    return !overlapsAppointment && !slotTouchesBlockedTime(slotStart, durationMinutes, blockedTimes, step);
  }

  const store = await readStore();
  const blockedTimes = new Set(
    Object.entries({
      ...(store.availabilityOverrides.default ?? {}),
      ...(store.availabilityOverrides[date] ?? {}),
    })
      .filter(([, available]) => !available)
      .map(([blockedTime]) => blockedTime),
  );
  const overlapsAppointment = store.appointments
    .filter((appointment) => appointment.status !== "cancelled")
    .filter((appointment) => appointment.id !== ignoreAppointmentId)
    .filter((appointment) => appointment.appointmentAt.startsWith(date))
    .some((appointment) => {
      const appointmentStart = timeToMinutes(appointment.appointmentAt.slice(11, 16));
      const appointmentEnd = appointmentStart + appointment.durationMinutes;

      return intervalOverlaps(slotStart, slotEnd, appointmentStart, appointmentEnd);
    });

  return !overlapsAppointment && !slotTouchesBlockedTime(slotStart, durationMinutes, blockedTimes, step);
}

export async function rescheduleAdminAppointment(id: string, date: string, time: string): Promise<AdminAppointment> {
  const appointment = await getAdminAppointment(id);

  if (!appointment || appointment.source === "demo") {
    throw new Error("Appointment not found.");
  }

  const open = await appointmentWindowIsOpen(date, time, appointment.durationMinutes, id);

  if (!open) {
    throw new Error("That time is blocked or already booked.");
  }

  const appointmentAt = new Date(`${date}T${time}:00`);
  const rows = await queryRows<{ id: string }>(`
    update appointments
    set appointment_at = $2,
        updated_at = now()
    where id = $1
      and status <> 'cancelled'
    returning id
  `, [id, appointmentAt]);

  if (rows) {
    if (!rows[0]) throw new Error("Appointment not found.");

    await createAdminNotification({
      type: "booking",
      title: "Appointment rescheduled",
      body: `${appointment.clientName} moved to ${dateLabel(appointmentAt)} at ${timeLabel(time)}.`,
      appointmentId: id,
    });

    const updated = await getAdminAppointment(id);
    if (!updated) throw new Error("Appointment not found.");

    return updated;
  }

  const store = await readStore();
  const index = store.appointments.findIndex((item) => item.id === id && item.status !== "cancelled");

  if (index === -1) {
    throw new Error("Appointment not found.");
  }

  store.appointments[index] = {
    ...store.appointments[index],
    appointmentAt: `${date}T${time}:00`,
  };
  await writeStore(store);
  await createAdminNotification({
    type: "booking",
    title: "Appointment rescheduled",
    body: `${appointment.clientName} moved to ${dateLabel(appointmentAt)} at ${timeLabel(time)}.`,
    appointmentId: id,
  });

  const updated = await getAdminAppointment(id);
  if (!updated) throw new Error("Appointment not found.");

  return updated;
}

export async function cancelAdminAppointment(id: string) {
  const appointment = await getAdminAppointment(id);

  if (!appointment || appointment.source === "demo") {
    throw new Error("Appointment not found.");
  }

  const rows = await queryRows<{ id: string }>(`
    update appointments
    set status = 'cancelled',
        updated_at = now()
    where id = $1
      and status <> 'cancelled'
    returning id
  `, [id]);

  if (rows) {
    if (!rows[0]) throw new Error("Appointment not found.");
    await createAdminNotification({
      type: "booking",
      title: "Appointment removed",
      body: `${appointment.clientName}'s ${appointment.serviceName} appointment was removed.`,
      appointmentId: id,
    });

    return { id };
  }

  const store = await readStore();
  const index = store.appointments.findIndex((item) => item.id === id && item.status !== "cancelled");

  if (index === -1) {
    throw new Error("Appointment not found.");
  }

  store.appointments[index] = {
    ...store.appointments[index],
    status: "cancelled",
  };
  await writeStore(store);
  await createAdminNotification({
    type: "booking",
    title: "Appointment removed",
    body: `${appointment.clientName}'s ${appointment.serviceName} appointment was removed.`,
    appointmentId: id,
  });

  return { id };
}

export async function createService(input: ServiceInput): Promise<Service> {
  const activePool = await getReadyPool();
  const id = slugifyServiceName(input.name);

  if (!activePool) {
    const store = await readStore();
    const uniqueId = store.services.some((service) => service.id === id) ? `${id}-${Date.now()}` : id;
    const service = { id: uniqueId, ...input };
    store.services = [...store.services, service];
    await writeStore(store);

    return service;
  }

  const rows = await queryRows<ServiceRow>(`
    insert into services (id, name, description, duration_minutes, price_cents, category, image_url, is_popular, is_addon)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    on conflict (id) do update
    set
      name = excluded.name,
      description = excluded.description,
      duration_minutes = excluded.duration_minutes,
      price_cents = excluded.price_cents,
      category = excluded.category,
      image_url = excluded.image_url,
      is_popular = excluded.is_popular,
      is_addon = excluded.is_addon,
      active = true,
      updated_at = now()
    returning
      id,
      name,
      description,
      duration_minutes as "durationMinutes",
      price_cents as "priceCents",
      category,
      coalesce(image_url, '') as "imageUrl",
      is_popular as popular,
      coalesce(is_addon, false) as addon
  `, [id, input.name, input.description, input.durationMinutes, input.priceCents, input.category, input.imageUrl, input.popular ?? false, input.addon ?? false]);

  if (!rows?.[0]) {
    throw new Error("Unable to create service.");
  }

  return rows[0];
}

export async function deleteService(id: string) {
  const activePool = await getReadyPool();

  if (!activePool) {
    const store = await readStore();
    const existingLength = store.services.length;
    store.services = store.services.filter((service) => service.id !== id);

    if (store.services.length === existingLength) {
      throw new Error("Service not found.");
    }

    await writeStore(store);
    return { id };
  }

  const rows = await queryRows<{ id: string }>(`
    update services
    set active = false,
        updated_at = now()
    where id = $1
      and active = true
    returning id
  `, [id]);

  if (!rows?.[0]) {
    throw new Error("Service not found.");
  }

  return rows[0];
}

export async function updateService(id: string, input: ServiceInput): Promise<Service> {
  const activePool = await getReadyPool();

  if (!activePool) {
    const store = await readStore();
    const index = store.services.findIndex((service) => service.id === id);

    if (index === -1) {
      throw new Error("Service not found.");
    }

    const service = { ...store.services[index], ...input, id };
    store.services[index] = service;
    await writeStore(store);

    return service;
  }

  const rows = await queryRows<ServiceRow>(`
    update services
    set
      name = $2,
      description = $3,
      duration_minutes = $4,
      price_cents = $5,
      category = $6,
      image_url = $7,
      is_popular = $8,
      is_addon = $9,
      updated_at = now()
    where id = $1
    returning
      id,
      name,
      description,
      duration_minutes as "durationMinutes",
      price_cents as "priceCents",
      category,
      coalesce(image_url, '') as "imageUrl",
      is_popular as popular,
      coalesce(is_addon, false) as addon
  `, [id, input.name, input.description, input.durationMinutes, input.priceCents, input.category, input.imageUrl, input.popular ?? false, input.addon ?? false]);

  if (!rows?.[0]) {
    throw new Error("Service not found.");
  }

  return rows[0];
}

export async function setAvailability(date: string, time: string, available: boolean) {
  const activePool = await getReadyPool();

  if (!activePool) {
    const store = await readStore();
    store.availabilityOverrides[date] = {
      ...(store.availabilityOverrides[date] ?? {}),
      [time]: available,
    };
    await writeStore(store);

    return { date, time, available };
  }

  const rows = await queryRows<AvailabilityOverrideRow>(`
    insert into availability_overrides (date, time, available)
    values ($1, $2, $3)
    on conflict (date, time) do update
      set available = excluded.available,
          updated_at = now()
    returning time, available
  `, [date, time, available]);

  if (!rows?.[0]) {
    throw new Error("Unable to update availability.");
  }

  return { date, time: rows[0].time, available: rows[0].available };
}

export async function listClientAppointments(email: string): Promise<AdminAppointment[]> {
  const normalized = email.trim().toLowerCase();

  const rows = await queryRows<AdminAppointmentRow>(`
    select
      appointments.id,
      clients.name as "clientName",
      clients.email as "clientEmail",
      clients.phone as "clientPhone",
      coalesce(
        (
          select string_agg(selected_services.name, ' + ' order by selected_services.sort_order, selected_services.name)
          from services selected_services
          where selected_services.id = any(appointments.service_ids)
        ),
        services.name
      ) as "serviceName",
      case
        when array_length(appointments.service_ids, 1) is null then array[appointments.service_id]
        else appointments.service_ids
      end as "serviceIds",
      appointments.appointment_at as "startAt",
      coalesce(appointments.duration_minutes, services.duration_minutes) as "durationMinutes",
      appointments.status,
      coalesce(appointments.price_cents, services.price_cents) as "priceCents",
      coalesce(appointments.tip_cents, 0) as "tipCents",
      coalesce(appointments.discount_cents, 0) as "discountCents",
      appointments.notes
    from appointments
    join clients on clients.id = appointments.client_id
    join services on services.id = appointments.service_id
    where lower(clients.email) = $1
      and appointments.status <> 'cancelled'
    order by appointments.appointment_at desc
  `, [normalized]);

  if (rows) {
    return rows.map((row) => rowToAdminAppointment(row, "postgres"));
  }

  const store = await readStore();

  return store.appointments
    .filter((appointment) => appointment.status !== "cancelled")
    .filter((appointment) => (appointment.clientEmail ?? "").trim().toLowerCase() === normalized)
    .map<AdminAppointment>((appointment) => ({
      id: appointment.id,
      clientName: appointment.clientName,
      clientEmail: appointment.clientEmail ?? "",
      clientPhone: appointment.clientPhone,
      serviceIds: appointment.serviceIds,
      serviceName: appointment.serviceName,
      startAt: appointment.appointmentAt,
      endAt: endAt(appointment.appointmentAt, appointment.durationMinutes),
      durationMinutes: appointment.durationMinutes,
      status: appointment.status ?? "confirmed",
      priceCents: appointment.priceCents,
      tipCents: appointment.tipCents ?? 0,
      discountCents: appointment.discountCents ?? 0,
      notes: appointment.notes,
      source: "store",
    }))
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
}

export async function listClientEmails(audience: "all" | "winback" = "all"): Promise<string[]> {
  const clients = await listClientProfiles();
  const filtered = clients.filter((client) => client.email && (audience === "all" || client.nextVisit === "Not booked"));
  return Array.from(new Set(filtered.map((client) => client.email.trim().toLowerCase()).filter(Boolean)));
}

export async function createClientReview(input: { name: string; email: string; rating: number; text: string; appointmentId?: string }): Promise<ClientReview> {
  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
  const pool = await getReadyPool();

  if (pool) {
    const rows = await queryRows<{ id: string; name: string; rating: number; text: string; createdAt: Date }>(
      `insert into client_reviews (name, email, rating, text, appointment_id)
       values ($1, $2, $3, $4, $5)
       returning id::text, name, rating, text, created_at as "createdAt"`,
      [input.name, input.email, rating, input.text, input.appointmentId ?? null],
    );
    if (rows?.[0]) {
      return { id: rows[0].id, name: rows[0].name, rating: rows[0].rating, text: rows[0].text, createdAt: rows[0].createdAt.toISOString() };
    }
  }

  const store = await readStore();
  const review = {
    id: randomUUID(),
    name: input.name,
    email: input.email,
    rating,
    text: input.text,
    appointmentId: input.appointmentId,
    createdAt: new Date().toISOString(),
  };
  store.clientReviews = [review, ...(store.clientReviews ?? [])].slice(0, 200);
  await writeStore(store);
  return { id: review.id, name: review.name, rating: review.rating, text: review.text, createdAt: review.createdAt };
}

export async function listClientReviews(limit = 24): Promise<ClientReview[]> {
  const rows = await queryRows<{ id: string; name: string; rating: number; text: string; createdAt: Date }>(
    `select id::text, name, rating, text, created_at as "createdAt" from client_reviews order by created_at desc limit $1`,
    [limit],
  );

  if (rows) {
    return rows.map((row) => ({ id: row.id, name: row.name, rating: row.rating, text: row.text, createdAt: row.createdAt.toISOString() }));
  }

  const store = await readStore();
  return (store.clientReviews ?? [])
    .slice(0, limit)
    .map((review) => ({ id: review.id, name: review.name, rating: review.rating, text: review.text, createdAt: review.createdAt }));
}

export async function cancelClientAppointment(email: string, id: string) {
  const appointment = await getAdminAppointment(id);
  const normalized = email.trim().toLowerCase();

  if (!appointment || (appointment.clientEmail ?? "").trim().toLowerCase() !== normalized) {
    throw new Error("Appointment not found.");
  }

  return cancelAdminAppointment(id);
}

export async function setAppointmentAttendance(id: string, status: AppointmentStatus, tipCents = 0): Promise<AdminAppointment> {
  const appointment = await getAdminAppointment(id);

  if (!appointment || appointment.source === "demo") {
    throw new Error("Appointment not found.");
  }

  const tip = Math.max(0, Math.round(tipCents));
  const rows = await queryRows<{ id: string }>(
    `update appointments set status = $2, tip_cents = $3, updated_at = now() where id = $1 returning id`,
    [id, status, tip],
  );

  if (rows) {
    if (!rows[0]) throw new Error("Appointment not found.");
  } else {
    const store = await readStore();
    const index = store.appointments.findIndex((item) => item.id === id);
    if (index === -1) throw new Error("Appointment not found.");
    store.appointments[index] = { ...store.appointments[index], status, tipCents: tip };
    await writeStore(store);
  }

  const updated = await getAdminAppointment(id);
  if (!updated) throw new Error("Appointment not found.");
  return updated;
}

export async function createManualAppointment(input: {
  name: string;
  phone?: string;
  email?: string;
  serviceIds: string[];
  date: string;
  time: string;
  notes?: string;
}): Promise<AdminAppointment> {
  const selected = (await listServices()).filter((service) => input.serviceIds.includes(service.id));
  if (!selected.length) throw new Error("Pick at least one service.");

  const totalDuration = selected.reduce((sum, service) => sum + service.durationMinutes, 0);
  const totalPrice = selected.reduce((sum, service) => sum + service.priceCents, 0);
  const serviceName = selected.map((service) => service.name).join(" + ");

  if (!(await appointmentWindowIsOpen(input.date, input.time, totalDuration))) {
    throw new Error("That time is blocked or already booked.");
  }

  const activePool = await getReadyPool();

  if (!activePool) {
    const store = await readStore();
    const appointment = {
      id: `manual-${Date.now()}`,
      serviceIds: input.serviceIds,
      serviceName,
      clientName: input.name,
      clientEmail: input.email ?? "",
      clientPhone: input.phone ?? "",
      appointmentAt: `${input.date}T${input.time}:00`,
      durationMinutes: totalDuration,
      priceCents: totalPrice,
      status: "confirmed" as const,
      notes: input.notes ?? "",
    };
    store.appointments = [...store.appointments, appointment];
    await writeStore(store);
    await createAdminNotification({
      type: "booking",
      title: "Appointment added",
      body: `${input.name} was added for ${serviceName} at ${timeLabel(input.time)}.`,
      appointmentId: appointment.id,
    });
    const created = await getAdminAppointment(appointment.id);
    if (!created) throw new Error("Unable to add appointment.");
    return created;
  }

  const client = await activePool.connect();
  try {
    await client.query("begin");
    const email = input.email?.trim() || `walkin-${Date.now()}@studio.local`;
    const clientResult = await client.query<{ id: string }>(
      `insert into clients (name, email, phone) values ($1, $2, $3)
       on conflict (email) do update set name = excluded.name, phone = excluded.phone, updated_at = now()
       returning id`,
      [input.name, email, input.phone ?? ""],
    );
    const appointmentAt = new Date(`${input.date}T${input.time}:00`);
    const appointmentResult = await client.query<{ id: string }>(
      `insert into appointments (client_id, service_id, service_ids, appointment_at, duration_minutes, price_cents, notes, status)
       values ($1, $2, $3, $4, $5, $6, $7, 'confirmed') returning id`,
      [clientResult.rows[0].id, selected[0].id, input.serviceIds, appointmentAt, totalDuration, totalPrice, input.notes ?? ""],
    );
    await client.query("commit");
    await createAdminNotification({
      type: "booking",
      title: "Appointment added",
      body: `${input.name} was added for ${serviceName} at ${timeLabel(input.time)}.`,
      appointmentId: appointmentResult.rows[0].id,
    });
    const created = await getAdminAppointment(appointmentResult.rows[0].id);
    if (!created) throw new Error("Unable to add appointment.");
    return created;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

type ExpenseRow = {
  id: string;
  date: Date;
  description: string;
  category: string;
  amountCents: number;
  receiptUrl: string | null;
  createdAt: Date;
};

const EXPENSE_SELECT = `
  id::text,
  expense_date as date,
  description,
  category,
  amount_cents as "amountCents",
  receipt_url as "receiptUrl",
  created_at as "createdAt"
`;

function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: dateKey(row.date),
    description: row.description,
    category: row.category,
    amountCents: row.amountCents,
    receiptUrl: row.receiptUrl ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listExpenses(date?: string): Promise<Expense[]> {
  const rows = await queryRows<ExpenseRow>(
    `select ${EXPENSE_SELECT} from expenses ${date ? "where expense_date = $1" : ""} order by created_at desc`,
    date ? [date] : [],
  );

  if (rows) {
    return rows.map(rowToExpense);
  }

  const store = await readStore();
  return (store.expenses ?? [])
    .filter((expense) => !date || expense.date === date)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createExpense(input: {
  date: string;
  description: string;
  category: string;
  amountCents: number;
  receiptUrl?: string;
}): Promise<Expense> {
  const amount = Math.max(0, Math.round(input.amountCents));
  const pool = await getReadyPool();

  if (pool) {
    const rows = await queryRows<ExpenseRow>(
      `insert into expenses (expense_date, description, category, amount_cents, receipt_url)
       values ($1, $2, $3, $4, $5) returning ${EXPENSE_SELECT}`,
      [input.date, input.description, input.category, amount, input.receiptUrl ?? null],
    );
    if (rows?.[0]) return rowToExpense(rows[0]);
  }

  const store = await readStore();
  const expense: Expense = {
    id: randomUUID(),
    date: input.date,
    description: input.description,
    category: input.category,
    amountCents: amount,
    receiptUrl: input.receiptUrl,
    createdAt: new Date().toISOString(),
  };
  store.expenses = [expense, ...(store.expenses ?? [])];
  await writeStore(store);
  return expense;
}

export async function deleteExpense(id: string) {
  const rows = await queryRows<{ id: string }>(`delete from expenses where id = $1 returning id::text`, [id]);

  if (rows) {
    if (!rows[0]) throw new Error("Expense not found.");
    return { id };
  }

  const store = await readStore();
  const before = (store.expenses ?? []).length;
  store.expenses = (store.expenses ?? []).filter((expense) => expense.id !== id);
  if (store.expenses.length === before) throw new Error("Expense not found.");
  await writeStore(store);
  return { id };
}

export async function getRevenueSummary(date: string): Promise<RevenueSummary> {
  const appointments = await listAdminAppointments({ date, limit: 200, upcomingOnly: false });
  let serviceRevenueCents = 0;
  let tipsCents = 0;
  let showed = 0;
  let noShow = 0;
  let scheduled = 0;

  for (const appointment of appointments) {
    if (appointment.status === "no_show") {
      noShow += 1;
    } else if (appointment.status === "completed" || appointment.status === "checked_in") {
      showed += 1;
      serviceRevenueCents += Math.max(0, appointment.priceCents - (appointment.discountCents ?? 0));
      tipsCents += appointment.tipCents ?? 0;
    } else {
      scheduled += 1;
    }
  }

  const expenses = await listExpenses(date);
  const expensesCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const grossCents = serviceRevenueCents + tipsCents;

  return {
    date,
    serviceRevenueCents,
    tipsCents,
    grossCents,
    expensesCents,
    netCents: grossCents - expensesCents,
    showed,
    noShow,
    scheduled,
    totalAppointments: appointments.length,
  };
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const today = dateKey(new Date());
  const [appointments, notifications, clients, revenue] = await Promise.all([
    listUpcomingAppointments(8),
    listAdminNotifications(6),
    listClientProfiles(),
    getRevenueSummary(today),
  ]);

  return {
    ...demoOverview,
    revenue,
    revenueTodayCents: revenue.grossCents,
    appointmentsToday: revenue.totalAppointments,
    appointments,
    notifications,
    clients,
  };
}
