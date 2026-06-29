import type { AdminOverview, Appointment, ClientProfile, Service, TimeSlot } from "@/types";

export const demoServices: Service[] = [
  {
    id: "structured-gel-fill",
    name: "Structured Gel Fill",
    description: "Balance, reshape, cuticle care, and a flawless gel refresh.",
    durationMinutes: 75,
    priceCents: 6500,
    category: "manicure",
    imageUrl: "https://images.unsplash.com/photo-1612887390768-fb02affea7a6?auto=format&fit=crop&w=900&q=85",
    popular: true,
  },
  {
    id: "gel-x-full-set",
    name: "Gel-X Full Set",
    description: "Lightweight extensions with custom length, shape, and polish.",
    durationMinutes: 105,
    priceCents: 8500,
    category: "manicure",
    imageUrl: "https://images.unsplash.com/photo-1571290274554-6a2eaa771e5f?auto=format&fit=crop&w=900&q=85",
    popular: true,
  },
  {
    id: "builder-manicure",
    name: "Builder Manicure",
    description: "Strengthening overlay for natural nails with long-wear color.",
    durationMinutes: 90,
    priceCents: 7800,
    category: "manicure",
    imageUrl: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "nail-art-upgrade",
    name: "Nail Art Upgrade",
    description: "Chrome, French, gems, charms, or hand-painted details.",
    durationMinutes: 30,
    priceCents: 2500,
    category: "manicure",
    imageUrl: "https://images.unsplash.com/photo-1588359953494-0c215e3cedc6?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "luxury-pedicure",
    name: "Luxury Pedicure",
    description: "Detailed foot care, scrub, massage, and gel polish.",
    durationMinutes: 60,
    priceCents: 5800,
    category: "pedicure",
    imageUrl: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=900&q=85",
  },
];

export const demoAppointments: Appointment[] = [
  {
    id: "apt-1001",
    clientName: "Maria Silva",
    serviceName: "Structured Gel Fill",
    startAt: new Date().toISOString(),
    durationMinutes: 75,
    status: "confirmed",
    priceCents: 6500,
  },
  {
    id: "apt-1002",
    clientName: "Jessica Smith",
    serviceName: "Gel-X Full Set",
    startAt: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
    durationMinutes: 105,
    status: "confirmed",
    priceCents: 8500,
  },
  {
    id: "apt-1003",
    clientName: "Ana Costa",
    serviceName: "Luxury Pedicure",
    startAt: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
    durationMinutes: 60,
    status: "confirmed",
    priceCents: 5800,
  },
];

export const demoClients: ClientProfile[] = [
  {
    id: "client-1",
    name: "Jessica Smith",
    phone: "(555) 123-4567",
    email: "jessica@email.com",
    visits: 14,
    totalSpentCents: 134000,
    loyaltyVisits: 8,
    lastVisit: "June 5, 2026",
    nextVisit: "June 30, 2026",
    notes: "Loves short almond shape and soft nude colors.",
    createdAt: "2024-03-12T12:00:00.000Z",
  },
  {
    id: "client-2",
    name: "Maria Silva",
    phone: "(555) 231-4567",
    email: "maria@email.com",
    visits: 9,
    totalSpentCents: 72000,
    loyaltyVisits: 5,
    lastVisit: "June 14, 2026",
    nextVisit: "July 12, 2026",
    notes: "Prefers structured gel fills and Friday afternoons.",
    createdAt: "2024-11-03T12:00:00.000Z",
  },
];

export const demoOverview: AdminOverview = {
  revenueTodayCents: 48500,
  appointmentsToday: 6,
  rebookRate: 72,
  instagramReach: 21900,
  revenue: {
    date: "",
    serviceRevenueCents: 0,
    tipsCents: 0,
    grossCents: 0,
    expensesCents: 0,
    netCents: 0,
    showed: 0,
    noShow: 0,
    scheduled: 0,
    totalAppointments: 0,
  },
  appointments: demoAppointments,
  notifications: [],
  clients: demoClients,
  campaigns: [
    {
      id: "campaign-birthday",
      title: "Birthday Discount",
      audience: "Birthdays this month",
      clients: 12,
      status: "Ready",
    },
    {
      id: "campaign-winback",
      title: "We Miss You",
      audience: "Inactive over 45 days",
      clients: 18,
      status: "Draft",
    },
  ],
};

export function buildDemoSlots(date: string): TimeSlot[] {
  const busyTimes = new Set(["10:30", "12:00", "15:30"]);
  const day = new Date(`${date}T12:00:00`);
  const isSunday = day.getDay() === 0;

  return ["09:00", "10:30", "11:00", "12:00", "13:30", "15:30", "16:00", "17:30"].map((time) => {
    const [hours, minutes] = time.split(":").map(Number);
    const label = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(2026, 0, 1, hours, minutes));

    return {
      time,
      label,
      available: !isSunday && !busyTimes.has(time),
    };
  });
}
