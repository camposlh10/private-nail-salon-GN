export type Service = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  category: string;
  imageUrl: string;
  popular?: boolean;
  addon?: boolean;
};

export type Promotion = {
  id: string;
  code: string;
  label: string;
  kind: "percent" | "amount";
  value: number;
  active: boolean;
};

export type ClientReview = {
  id: string;
  name: string;
  rating: number;
  text: string;
  createdAt: string;
};

export type TimeSlot = {
  time: string;
  label: string;
  available: boolean;
};

export type BookingRequest = {
  serviceId?: string;
  serviceIds: string[];
  date: string;
  time: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  promoCode?: string;
};

export type AppointmentStatus = "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show";

export type Appointment = {
  id: string;
  clientName: string;
  serviceName: string;
  startAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  priceCents: number;
  tipCents?: number;
  discountCents?: number;
};

export type AdminAppointment = Appointment & {
  clientEmail: string;
  clientPhone?: string;
  notes?: string;
  serviceIds: string[];
  endAt: string;
  source: "postgres" | "store" | "demo";
};

export type Expense = {
  id: string;
  date: string;
  description: string;
  category: string;
  amountCents: number;
  receiptUrl?: string;
  createdAt: string;
};

export type RevenueSummary = {
  date: string;
  serviceRevenueCents: number;
  tipsCents: number;
  grossCents: number;
  expensesCents: number;
  netCents: number;
  showed: number;
  noShow: number;
  scheduled: number;
  totalAppointments: number;
};

export type EmailDelivery = {
  mode: "smtp" | "resend" | "mailtrap" | "outbox";
  customer: boolean;
  owner: boolean;
  errors?: string[];
};

export type BookingConfirmation = {
  id: string;
  serviceName: string;
  startAt: string;
  durationMinutes: number;
  priceCents: number;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  notes?: string;
  discountCents?: number;
  promoCode?: string;
  locationName: string;
  locationAddress: string;
  mapsUrl: string;
  emailDelivery?: EmailDelivery;
};

export type AdminNotification = {
  id: string;
  type: "booking" | "email" | "system";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  appointmentId?: string;
};

export type ClientProfile = {
  id: string;
  name: string;
  phone: string;
  email: string;
  visits: number;
  totalSpentCents: number;
  lastVisit: string;
  nextVisit: string;
  loyaltyVisits: number;
  notes: string;
  createdAt: string;
};

export type AdminOverview = {
  revenueTodayCents: number;
  appointmentsToday: number;
  rebookRate: number;
  instagramReach: number;
  revenue: RevenueSummary;
  appointments: Appointment[];
  notifications: AdminNotification[];
  clients: ClientProfile[];
  campaigns: {
    id: string;
    title: string;
    audience: string;
    clients: number;
    status: string;
  }[];
};

export type InstagramPost = {
  id: string;
  caption: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS" | string;
  mediaUrl: string;
  thumbnailUrl?: string;
  permalink: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  plays?: number;
  reach?: number;
};

export type InstagramData = {
  source: "instagram" | "demo";
  handle: string;
  profileUrl: string;
  followersCount: number;
  mediaCount: number;
  profilePictureUrl?: string;
  posts: InstagramPost[];
  totals: {
    likes: number;
    comments: number;
    plays: number;
    reach: number;
  };
  statusNote?: string;
};

export type PinterestPin = {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  link?: string;
  boardName?: string;
  savedAt?: string;
};

export type PinterestData = {
  source: "pinterest" | "demo";
  profileName: string;
  profileUrl: string;
  pins: PinterestPin[];
  statusNote?: string;
};
