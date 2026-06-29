"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  AtSign,
  Bookmark,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock,
  Camera,
  Footprints,
  Grid3X3,
  Heart,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  UserRound,
} from "lucide-react";
import studioPortrait from "@/imports/e338c250-0380-48d5-9c4c-4546449cc0c3.png";
import studioLogo from "@/imports/619881548_18040197425757574_337123536721265869_n.jpg";
import type { BookingConfirmation, InstagramData, InstagramPost, PinterestData, PinterestPin, Promotion, Service, TimeSlot } from "@/types";
import type { PublicSettings } from "@/server/settings";
import { SHOW_PAYMENTS, SHOW_SOCIAL } from "./feature-flags";

const fallbackServices: Service[] = [
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

const fallbackSlots: TimeSlot[] = [
  { time: "09:00", label: "9:00 AM", available: true },
  { time: "10:30", label: "10:30 AM", available: false },
  { time: "11:00", label: "11:00 AM", available: true },
  { time: "13:30", label: "1:30 PM", available: true },
  { time: "15:30", label: "3:30 PM", available: false },
  { time: "16:00", label: "4:00 PM", available: true },
];

const galleryPosts = [
  {
    src: "https://images.unsplash.com/photo-1612887390768-fb02affea7a6?auto=format&fit=crop&w=800&q=85",
    label: "Soft pink gel set",
    likes: "287",
    comments: "18",
  },
  {
    src: "https://images.unsplash.com/photo-1571290274554-6a2eaa771e5f?auto=format&fit=crop&w=800&q=85",
    label: "Glossy red extensions",
    likes: "391",
    comments: "22",
  },
  {
    src: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=85",
    label: "Minimal French details",
    likes: "442",
    comments: "37",
  },
  {
    src: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=85",
    label: "Chrome accent manicure",
    likes: "318",
    comments: "16",
  },
  {
    src: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=800&q=85",
    label: "Burgundy French tips",
    likes: "275",
    comments: "11",
  },
];

const reelPosts = [
  {
    src: "https://images.unsplash.com/photo-1604902396830-aca29e19b067?auto=format&fit=crop&w=1000&q=85",
    label: "Clean gel fill transformation",
    views: "12.4K",
  },
  {
    src: "https://images.unsplash.com/photo-1599948128020-9a44505b0d1b?auto=format&fit=crop&w=1000&q=85",
    label: "Gloss application close-up",
    views: "9.8K",
  },
  {
    src: "https://images.unsplash.com/photo-1588359953494-0c215e3cedc6?auto=format&fit=crop&w=1000&q=85",
    label: "Gold detail nail art",
    views: "15.7K",
  },
];

const reviewAvatars = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80",
];

const fallbackPinterestPins: PinterestPin[] = [
  {
    id: "fallback-pin-1",
    title: "Milky chrome almond set",
    imageUrl: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=85",
    link: "https://www.pinterest.com/",
    boardName: "Nail Inspo",
  },
  {
    id: "fallback-pin-2",
    title: "Minimal French tips",
    imageUrl: "https://images.unsplash.com/photo-1612887390768-fb02affea7a6?auto=format&fit=crop&w=900&q=85",
    link: "https://www.pinterest.com/",
    boardName: "Nail Inspo",
  },
  {
    id: "fallback-pin-3",
    title: "Gold accent detail",
    imageUrl: "https://images.unsplash.com/photo-1588359953494-0c215e3cedc6?auto=format&fit=crop&w=900&q=85",
    link: "https://www.pinterest.com/",
    boardName: "Nail Inspo",
  },
  {
    id: "fallback-pin-4",
    title: "Glossy burgundy set",
    imageUrl: "https://images.unsplash.com/photo-1571290274554-6a2eaa771e5f?auto=format&fit=crop&w=900&q=85",
    link: "https://www.pinterest.com/",
    boardName: "Nail Inspo",
  },
  {
    id: "fallback-pin-5",
    title: "Soft pink manicure",
    imageUrl: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=900&q=85",
    link: "https://www.pinterest.com/",
    boardName: "Nail Inspo",
  },
  {
    id: "fallback-pin-6",
    title: "Clean pedicure palette",
    imageUrl: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=900&q=85",
    link: "https://www.pinterest.com/",
    boardName: "Nail Inspo",
  },
];

function cents(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function compactNumber(value?: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

function fallbackInstagramPosts(): InstagramPost[] {
  return [
    ...galleryPosts.map((post, index) => ({
      id: `fallback-post-${index}`,
      caption: post.label,
      mediaType: "IMAGE",
      mediaUrl: post.src,
      permalink: "https://www.instagram.com/nuneznails_/",
      timestamp: new Date().toISOString(),
      likeCount: Number(post.likes),
      commentsCount: Number(post.comments),
    })),
    ...reelPosts.map((post, index) => ({
      id: `fallback-reel-${index}`,
      caption: post.label,
      mediaType: "REELS",
      mediaUrl: post.src,
      permalink: "https://www.instagram.com/nuneznails_/",
      timestamp: new Date().toISOString(),
      likeCount: 0,
      commentsCount: 0,
      plays: Number(post.views.replace(/[^\d.]/g, "")) * (post.views.includes("K") ? 1000 : 1),
    })),
  ];
}

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateLabel(date: Date) {
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
    day: new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date),
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date),
  };
}

function buildDateOptions() {
  const today = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index + 1);

    return {
      value: dateValue(date),
      ...dateLabel(date),
    };
  });
}

const scheduleHours = Array.from({ length: 10 }, (_, index) => 9 + index);

function hourLabel(hour: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
  }).format(new Date(2026, 0, 1, hour));
}

function slotHour(slot: TimeSlot) {
  return Number(slot.time.split(":")[0]);
}

function selectedDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function PublicSite({ settings }: { settings?: PublicSettings }) {
  const router = useRouter();
  const dateOptions = useMemo(buildDateOptions, []);

  const brandName = settings?.branding.studioName ?? "Nunez Nails";
  const brandTagline = settings?.branding.tagline ?? "Private Studio";
  const heroEyebrow = settings?.content.heroEyebrow ?? "Private nail appointments in a calm studio";
  const heroTitle = settings?.content.heroTitle ?? "Book nails that feel personal from the first tap.";
  const heroCopy =
    settings?.content.heroSubtitle ??
    "A Booksy-style experience for clients who want quick scheduling, clear prices, real availability, and a nail tech who remembers every detail.";
  const footerNote = settings?.content.footerNote;
  const reviewRating = settings?.reviews.headlineRating ?? 4.9;
  const reviewCount = settings?.reviews.totalCount ?? 0;
  const manualReviews = settings?.reviews.manual ?? [];
  const addressCity = settings?.location.address?.split(",")[1]?.trim() ?? "";
  const cityLabel = addressCity ? `${addressCity} studio` : "Houston studio";
  const depositOn = SHOW_PAYMENTS && Boolean(settings?.payments.mode && settings.payments.mode !== "off");
  const footerPhone = settings?.location.phone ?? "(555) 123-4567";
  const footerEmail = settings?.location.email ?? "hello@nuneznails.com";
  const dayAbbr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const clock = (min: number) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
      new Date(2026, 0, 1, Math.floor(min / 60), min % 60),
    );
  const hourLines = (settings?.hours.days ?? [])
    .map((day, index) => (day.open ? `${dayAbbr[index]}: ${clock(day.openMinutes)} - ${clock(day.closeMinutes)}` : null))
    .filter((line): line is string => Boolean(line));
  const [services, setServices] = useState<Service[]>(fallbackServices);
  const [slots, setSlots] = useState<TimeSlot[]>(fallbackSlots);
  const [instagram, setInstagram] = useState<InstagramData | null>(null);
  const [pinterest, setPinterest] = useState<PinterestData | null>(null);
  const [liveReviews, setLiveReviews] = useState<{
    source: string;
    rating: number;
    total: number;
    reviews: { author: string; rating: number; text: string; relativeTime?: string }[];
  } | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([fallbackServices[0].id]);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "manicure" | "pedicure">("all");
  const [selectedDate, setSelectedDate] = useState(dateOptions[0]?.value ?? dateValue(new Date()));
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [bookingStatus, setBookingStatus] = useState<"idle" | "submitting" | "booked" | "error">("idle");
  const [bookingError, setBookingError] = useState("");
  const [bookingStep, setBookingStep] = useState(1);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [promoMessage, setPromoMessage] = useState("");
  const rebookHandled = useRef(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const mainServices = services.filter((service) => !service.addon && (categoryFilter === "all" || service.category === categoryFilter));
  const addonServices = services.filter((service) => service.addon);
  const selectedServices = services.filter((service) => selectedServiceIds.includes(service.id));
  const totalDuration = selectedServices.reduce((sum, service) => sum + service.durationMinutes, 0);
  const totalPrice = selectedServices.reduce((sum, service) => sum + service.priceCents, 0);
  const summaryName = selectedServices.length ? selectedServices.map((service) => service.name).join(" + ") : "Choose services";
  const discountCents = appliedPromo
    ? appliedPromo.kind === "percent"
      ? Math.round((totalPrice * appliedPromo.value) / 100)
      : Math.min(appliedPromo.value, totalPrice)
    : 0;
  const instagramPosts = instagram?.posts.length ? instagram.posts : fallbackInstagramPosts();
  const photoPosts = instagramPosts.slice(0, 5);
  const instagramHandle = instagram?.handle ?? "nuneznails_";
  const instagramProfileUrl = instagram?.profileUrl ?? "https://www.instagram.com/nuneznails_/";
  const instagramAvatar = instagram?.profilePictureUrl ?? photoPosts[0]?.mediaUrl ?? galleryPosts[0].src;
  const pinterestPins = pinterest?.pins.length ? pinterest.pins : fallbackPinterestPins;
  const pinterestProfileUrl = pinterest?.profileUrl ?? "https://www.pinterest.com/";

  const effectiveRating = liveReviews?.rating ?? reviewRating;
  const effectiveCount = liveReviews?.total ?? reviewCount;
  const liveBadge = liveReviews?.source === "google" ? "Google review" : "Verified review";
  const displayReviews =
    liveReviews?.reviews?.length
      ? liveReviews.reviews.map((review) => ({ name: review.author || "Client", service: review.relativeTime ?? "", quote: review.text, badge: liveBadge, rating: review.rating }))
      : manualReviews.length
        ? manualReviews.map((review) => ({ name: review.author || "Client", service: "", quote: review.text, badge: "Verified review", rating: review.rating }))
        : [
            { name: "Jessica M.", service: "Structured Gel Fill", quote: "The booking was so easy, and she already knew my shape and color preferences when I arrived.", badge: "Verified booking", rating: 5 },
            { name: "Amanda L.", service: "Gel-X Full Set", quote: "Clean studio, no rushed appointment, and my set lasted longer than any one I have had.", badge: "Repeat client", rating: 5 },
            { name: "Rachel G.", service: "Pedicure", quote: "I love the reminders and the loyalty rewards. It feels private but still super organized.", badge: "Google review", rating: 5 },
          ];

  useEffect(() => {
    let active = true;

    fetch("/api/instagram")
      .then((response) => response.json())
      .then((payload: { instagram?: InstagramData }) => {
        if (active && payload.instagram) {
          setInstagram(payload.instagram);
        }
      })
      .catch(() => undefined);

    fetch("/api/pinterest")
      .then((response) => response.json())
      .then((payload: { pinterest?: PinterestData }) => {
        if (active && payload.pinterest) {
          setPinterest(payload.pinterest);
        }
      })
      .catch(() => undefined);

    fetch("/api/reviews")
      .then((response) => response.json())
      .then((payload) => {
        if (active && payload?.reviews) {
          setLiveReviews(payload);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/services")
      .then((response) => response.json())
      .then((payload: { services?: Service[] }) => {
        if (active && payload.services) {
          setServices(payload.services);
          setSelectedServiceIds((current) => {
            const validSelected = current.filter((id) => payload.services!.some((service) => service.id === id));

            return validSelected.length ? validSelected : payload.services![0] ? [payload.services![0].id] : [];
          });
        }
      })
      .catch(() => {
        if (active) {
          setServices(fallbackServices);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (rebookHandled.current || !services.length) return;
    rebookHandled.current = true;
    const rebook = new URLSearchParams(window.location.search).get("rebook");
    if (!rebook) return;
    const ids = rebook.split(",").filter((id) => services.some((service) => service.id === id));
    if (ids.length) {
      setSelectedServiceIds(ids);
      setBookingStep(2);
      setTimeout(() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" }), 150);
    }
  }, [services]);

  useEffect(() => {
    let active = true;

    fetch(`/api/availability?date=${selectedDate}&duration=${Math.max(totalDuration, 30)}`)
      .then((response) => response.json())
      .then((payload: { slots?: TimeSlot[] }) => {
        if (active && payload.slots?.length) {
          setSlots(payload.slots);
          const firstAvailable = payload.slots.find((slot) => slot.available);
          setSelectedTime((current) => payload.slots!.some((slot) => slot.time === current && slot.available) ? current : firstAvailable?.time ?? "");
        }
      })
      .catch(() => {
        if (active) {
          setSlots(fallbackSlots);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedDate, totalDuration]);

  async function submitBooking() {
    if (!selectedServices.length || !selectedDate || !selectedTime || !form.name || !form.email) {
      return;
    }

    setBookingStatus("submitting");
    setBookingError("");

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        serviceIds: selectedServiceIds,
        date: selectedDate,
        time: selectedTime,
        promoCode: appliedPromo?.code,
        ...form,
      }),
    });

    const payload = (await response.json()) as { booking?: BookingConfirmation; error?: string };

    if (!response.ok || !payload.booking) {
      setBookingStatus("error");
      setBookingError(payload.error ?? "Unable to book this appointment. Please choose another time.");
      return;
    }

    sessionStorage.setItem(`booking-confirmation:${payload.booking.id}`, JSON.stringify(payload.booking));
    setBookingStatus("booked");

    // If the studio collects a deposit / payment, send the client to Stripe Checkout.
    // Falls back to the normal confirmation when Stripe isn't configured.
    if (depositOn) {
      try {
        const checkout = await fetch("/api/payments/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: payload.booking.id }),
        });
        if (checkout.ok) {
          const data = (await checkout.json()) as { url?: string };
          if (data.url) {
            window.location.href = data.url;
            return;
          }
        }
      } catch {
        // ignore and fall through to the confirmation page
      }
    }

    router.push(`/booking-confirmed?booking=${encodeURIComponent(payload.booking.id)}`);
  }

  function applyPromo() {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setAppliedPromo(null);
      setPromoMessage("");
      return;
    }
    const promo = (settings?.promotions ?? []).find((item) => item.code.toUpperCase() === code);
    if (!promo) {
      setAppliedPromo(null);
      setPromoMessage("That promo code isn't valid.");
      return;
    }
    setAppliedPromo(promo);
    setPromoMessage(`Applied: ${promo.label}`);
  }

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) => {
      if (current.includes(serviceId)) {
        return current.filter((id) => id !== serviceId);
      }

      return [...current, serviceId];
    });
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label={`${brandName} home`}>
          <Image className="brand-logo" src={studioLogo} alt={brandName} width={44} height={44} priority />
          <span>
            <strong>{brandName}</strong>
            <small>{brandTagline}</small>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <a href="#services">Services</a>
          {SHOW_SOCIAL ? <a href="#work">Gallery</a> : null}
          <a href="#reviews">Reviews</a>
          <Link href="/account">My account</Link>
          <Link href="/admin">Admin</Link>
        </nav>
        <a className="header-cta" href="#booking">
          Book now
        </a>
      </header>

      <section id="top" className="hero hero-split">
        <div className="hero-text">
          <p className="eyebrow">{heroEyebrow}</p>
          <h1>{heroTitle}</h1>
          <p className="hero-copy">{heroCopy}</p>
          <div className="hero-actions">
            <a href="#booking" className="primary-button">
              Book appointment
              <ChevronRight aria-hidden="true" size={18} />
            </a>
          </div>
          <div className="hero-proof" aria-label="Studio highlights">
            <div className="review-proof-card">
              <div className="avatar-stack" aria-hidden="true">
                {reviewAvatars.map((avatar) => (
                  <img src={avatar} alt="" key={avatar} />
                ))}
              </div>
              <span className="google-review-copy">
                <strong>{effectiveRating.toFixed(1)}</strong>
                <span>
                  <Star aria-hidden="true" size={13} fill="currentColor" />
                  <Star aria-hidden="true" size={13} fill="currentColor" />
                  <Star aria-hidden="true" size={13} fill="currentColor" />
                  <Star aria-hidden="true" size={13} fill="currentColor" />
                  <Star aria-hidden="true" size={13} fill="currentColor" />
                </span>
                <small>{effectiveCount ? `${effectiveCount} reviews` : "Google reviews"}</small>
              </span>
            </div>
            <span>
              <MapPin aria-hidden="true" size={16} />
              {cityLabel}
            </span>
          </div>
        </div>
        <div className="hero-photo">
          <Image
            src={studioPortrait}
            alt="Beautiful manicured nails at the studio"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 45vw"
            className="hero-photo-img"
          />
        </div>
      </section>

      <section id="services" className="services-showcase" aria-label="Services">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Services</p>
          <h2>What we offer</h2>
        </div>
        <div className="showcase-grid">
          {mainServices.slice(0, 4).map((service) => (
            <a
              className="showcase-card"
              key={service.id}
              href="#booking"
              onClick={() => { setSelectedServiceIds([service.id]); setBookingStep(1); }}
            >
              <span className="showcase-icon">
                {service.category === "pedicure" ? <Footprints aria-hidden="true" size={22} /> : <Sparkles aria-hidden="true" size={22} />}
              </span>
              <strong>{service.name}</strong>
              <small>{service.durationMinutes} min</small>
              <b>{cents(service.priceCents)}</b>
            </a>
          ))}
        </div>
        <div className="showcase-cta">
          <a href="#booking" className="ghost-pill">View all services &amp; book</a>
        </div>
      </section>

      {settings?.promotions?.length ? (
        <section className="deals-section" aria-label="Current deals">
          <div className="deals-list">
            {settings.promotions.map((promo) => (
              <div className="deal-card" key={promo.id}>
                <span className="deal-icon"><Tag aria-hidden="true" size={18} /></span>
                <div className="deal-copy">
                  <strong>{promo.label || `${promo.kind === "percent" ? `${promo.value}%` : cents(promo.value)} off`}</strong>
                  <span>Use code <b>{promo.code}</b> at checkout</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section id="booking" className="booking-section">
        <div className="section-heading">
          <p className="eyebrow">Fast mobile booking</p>
          <h2>Book in four quick steps.</h2>
          <p>Pick your services, choose a time, add your details, and confirm — with your total updating as you go.</p>
        </div>

        <div className="booking-stepper">
          <ol className="stepper-progress" aria-label="Booking steps">
            {[
              [1, "Services"],
              [2, "Date & time"],
              [3, "Your details"],
              [4, "Confirm"],
            ].map(([num, label]) => (
              <li key={num as number}>
                <button
                  type="button"
                  className={`stepper-dot ${bookingStep === num ? "is-active" : ""} ${bookingStep > (num as number) ? "is-done" : ""}`}
                  onClick={() => { if ((num as number) < bookingStep) setBookingStep(num as number); }}
                  aria-current={bookingStep === num ? "step" : undefined}
                >
                  <span>{bookingStep > (num as number) ? <Check aria-hidden="true" size={15} /> : (num as number)}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>

          <div className="stepper-body">
            {/* STEP 1 — services */}
            {bookingStep === 1 ? (
              <div id="services" className="stepper-step">
                <div className="service-filters" aria-label="Filter services">
                  {[
                    ["all", "All"],
                    ["manicure", "Manicure"],
                    ["pedicure", "Pedicure"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={categoryFilter === value ? "is-selected" : ""}
                      onClick={() => setCategoryFilter(value as "all" | "manicure" | "pedicure")}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="service-list" aria-label="Available nail services">
                  {mainServices.length ? mainServices.map((service) => {
                    const selected = selectedServiceIds.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        className={`service-option ${selected ? "is-selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => toggleService(service.id)}
                      >
                        <img className="service-thumb" src={service.imageUrl} alt="" loading="lazy" />
                        <span className="service-copy">
                          <span className="service-title">
                            {service.name}
                            {service.popular ? <small>Popular</small> : null}
                          </span>
                          <span>{service.description}</span>
                          <span className="service-category">{service.category}</span>
                        </span>
                        <span className="service-meta">
                          <strong>{cents(service.priceCents)}</strong>
                          <small>{service.durationMinutes} min</small>
                          <span className="service-pick-dot">{selected ? <Check aria-hidden="true" size={14} /> : "+"}</span>
                        </span>
                      </button>
                    );
                  }) : (
                    <div className="empty-service-state">
                      <strong>No services available right now.</strong>
                      <p>Check back soon or message the studio for a custom appointment.</p>
                    </div>
                  )}
                </div>

                {addonServices.length ? (
                  <div className="addons-block">
                    <h3>Add extras</h3>
                    <div className="addons-list">
                      {addonServices.map((service) => {
                        const selected = selectedServiceIds.includes(service.id);
                        return (
                          <button
                            key={service.id}
                            type="button"
                            className={`addon-option ${selected ? "is-selected" : ""}`}
                            aria-pressed={selected}
                            onClick={() => toggleService(service.id)}
                          >
                            <span className="addon-check">{selected ? <Check aria-hidden="true" size={14} /> : "+"}</span>
                            <span className="addon-copy">
                              <strong>{service.name}</strong>
                              <small>{service.description}</small>
                            </span>
                            <span className="addon-meta">
                              <strong>{cents(service.priceCents)}</strong>
                              <small>{service.durationMinutes} min</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* STEP 2 — date & time */}
            {bookingStep === 2 ? (
              <div className="stepper-step">
                <div className="date-row" aria-label="Choose appointment date">
                  {dateOptions.map((date) => (
                    <button
                      key={date.value}
                      type="button"
                      className={`date-chip ${selectedDate === date.value ? "is-selected" : ""}`}
                      onClick={() => setSelectedDate(date.value)}
                    >
                      <span>{date.weekday}</span>
                      <strong>{date.day}</strong>
                      <small>{date.month}</small>
                    </button>
                  ))}
                </div>

                <div className="calendar-card" aria-label="Choose appointment time">
                  <div className="calendar-card-header">
                    <span>Available times</span>
                    <strong>{selectedDateLabel(selectedDate)}</strong>
                    <small>{summaryName} - {totalDuration || 30} min</small>
                  </div>

                  <div className="calendar-timeline">
                    {scheduleHours.map((hour) => {
                      const hourSlots = slots.filter((slot) => slotHour(slot) === hour);
                      return (
                        <div className="calendar-hour" key={hour}>
                          <time>{hourLabel(hour)}</time>
                          <div className="calendar-lane">
                            {hourSlots.length ? (
                              hourSlots.map((slot) => (
                                <button
                                  key={slot.time}
                                  type="button"
                                  disabled={!slot.available}
                                  className={`calendar-slot ${selectedTime === slot.time ? "is-selected" : ""} ${slot.available ? "" : "is-booked"}`}
                                  onClick={() => setSelectedTime(slot.time)}
                                >
                                  <span>{slot.label}</span>
                                  <small>{slot.available ? "Available" : "Booked"}</small>
                                </button>
                              ))
                            ) : (
                              <span className="calendar-empty">Closed</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {/* STEP 3 — details */}
            {bookingStep === 3 ? (
              <div className="stepper-step">
                <div className="booking-fields">
                  <label>
                    <span>Name</span>
                    <input required autoComplete="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Your name" />
                  </label>
                  <label>
                    <span>Email</span>
                    <input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="you@example.com" />
                  </label>
                  <label>
                    <span>Phone</span>
                    <input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="(555) 123-4567" />
                  </label>
                  <label className="wide-field">
                    <span>Notes</span>
                    <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Shape, color, nail art ideas" />
                  </label>
                </div>
              </div>
            ) : null}

            {/* STEP 4 — review & confirm */}
            {bookingStep === 4 ? (
              <div className="stepper-step">
                <div className="review-card">
                  <h3>Review your appointment</h3>
                  <ul className="review-services">
                    {selectedServices.map((service) => (
                      <li key={service.id}>
                        <span>{service.name}</span>
                        <em>{service.durationMinutes} min</em>
                        <strong>{cents(service.priceCents)}</strong>
                      </li>
                    ))}
                  </ul>
                  <div className="review-when">
                    <span>{selectedDateLabel(selectedDate)}</span>
                    <strong>{slots.find((slot) => slot.time === selectedTime)?.label ?? selectedTime}</strong>
                  </div>

                  {promoMessage ? <p className={`promo-result ${appliedPromo ? "ok" : "bad"}`}>{promoMessage}</p> : null}
                  <div className="promo-row">
                    <input value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} placeholder="Promo code" />
                    <button type="button" onClick={applyPromo}>Apply</button>
                  </div>

                  <dl className="review-totals">
                    <div><dt>Services</dt><dd>{cents(totalPrice)}</dd></div>
                    {discountCents > 0 ? <div className="is-discount"><dt>Discount{appliedPromo ? ` (${appliedPromo.code})` : ""}</dt><dd>- {cents(discountCents)}</dd></div> : null}
                    <div className="review-grand"><dt>Total</dt><dd>{cents(Math.max(0, totalPrice - discountCents))}</dd></div>
                  </dl>
                  {depositOn ? <p className="review-deposit">A deposit is collected at checkout to confirm your booking.</p> : null}
                </div>

                {bookingStatus === "booked" ? (
                  <div className="success-message" role="status">
                    <CalendarCheck aria-hidden="true" size={18} />
                    Your appointment is confirmed. Opening your confirmation page...
                  </div>
                ) : null}
                {bookingStatus === "error" ? (
                  <div className="error-message" role="alert">{bookingError}</div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Sticky summary + nav */}
          <div className="stepper-footer">
            <div className="stepper-summary">
              <strong>{cents(Math.max(0, totalPrice - discountCents))}</strong>
              <small>{selectedServices.length} service{selectedServices.length === 1 ? "" : "s"} · {totalDuration || 0} min</small>
            </div>
            <div className="stepper-nav">
              {bookingStep > 1 ? (
                <button type="button" className="stepper-back" onClick={() => setBookingStep((s) => s - 1)}>Back</button>
              ) : null}
              {bookingStep < 4 ? (
                <button
                  type="button"
                  className="stepper-next"
                  disabled={(bookingStep === 1 && !selectedServices.length) || (bookingStep === 2 && !selectedTime)}
                  onClick={() => setBookingStep((s) => s + 1)}
                >
                  {bookingStep === 1 && !selectedServices.length ? "Pick a service" : bookingStep === 2 && !selectedTime ? "Pick a time" : "Next"}
                  <ChevronRight aria-hidden="true" size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  className="stepper-next"
                  disabled={bookingStatus === "submitting" || !selectedServices.length || !selectedTime || !form.name || !form.email}
                  onClick={submitBooking}
                >
                  {bookingStatus === "submitting" ? "Booking…" : "Confirm appointment"}
                  <ChevronRight aria-hidden="true" size={18} />
                </button>
              )}
            </div>
          </div>

          <p className="secure-note">
            <ShieldCheck aria-hidden="true" size={15} />
            Your information is only used for appointment communication.
          </p>
        </div>
      </section>

      {SHOW_SOCIAL ? (
      <section id="work" className="instagram-section">
        <div className="instagram-profile-card">
          <div className="instagram-profile-main">
            <a className="instagram-avatar-ring" href={instagramProfileUrl} target="_blank" rel="noreferrer" aria-label={`Open @${instagramHandle} on Instagram`}>
              <img src={instagramAvatar} alt={`@${instagramHandle} profile`} />
            </a>
            <div className="instagram-profile-copy">
              <div className="instagram-username-row">
                <h2>{instagramHandle}</h2>
                <BadgeCheck aria-label="Verified profile" size={22} color="white" fill="#1d9bf0" />
              </div>
              <p>Private nail studio - structured gel, Gel-X, nail art, and saved inspo for your next set.</p>
              <dl className="instagram-profile-stats">
                <div>
                  <dt>Posts</dt>
                  <dd>{compactNumber(instagram?.mediaCount ?? photoPosts.length)}</dd>
                </div>
                <div>
                  <dt>Followers</dt>
                  <dd>{compactNumber(instagram?.followersCount ?? 3842)}</dd>
                </div>
                <div>
                  <dt>Likes</dt>
                  <dd>{compactNumber(instagram?.totals.likes ?? 1713)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="instagram-profile-actions">
            <a className="instagram-follow" href={instagramProfileUrl} target="_blank" rel="noreferrer">
              <AtSign aria-hidden="true" size={18} />
              Follow
            </a>
            <a className="instagram-profile-ghost" href={instagramProfileUrl} target="_blank" rel="noreferrer">
              <Grid3X3 aria-hidden="true" size={18} />
              View profile
            </a>
          </div>
        </div>

        <div className="instagram-tabs" aria-label="Instagram profile tabs">
          <span>
            <Grid3X3 aria-hidden="true" size={16} />
            Posts
          </span>
          <span>
            <Bookmark aria-hidden="true" size={16} />
            Saved Inspo
          </span>
        </div>

        <div className="instagram-post-row">
          {photoPosts.map((post) => (
            <a className="instagram-post" key={post.id} href={post.permalink} target="_blank" rel="noreferrer">
              <img src={post.thumbnailUrl ?? post.mediaUrl} alt={post.caption || "Instagram nail post"} loading="lazy" />
              <div className="instagram-stats">
                <span>
                  <Heart aria-hidden="true" size={15} />
                  {compactNumber(post.likeCount)}
                </span>
                <span>
                  <MessageCircle aria-hidden="true" size={15} />
                  {compactNumber(post.commentsCount)}
                </span>
              </div>
            </a>
          ))}
        </div>

        <div className="reels-header">
          <div>
            <h3>Nail Inspo</h3>
            <p>Saved from her Pinterest boards</p>
          </div>
          <a href={pinterestProfileUrl} target="_blank" rel="noreferrer">
            View Pinterest
            <Bookmark aria-hidden="true" size={17} />
          </a>
        </div>

        <div className="pinterest-pin-grid">
          {pinterestPins.map((pin) => (
            <a className="pinterest-pin-card" key={pin.id} href={pin.link ?? pinterestProfileUrl} target="_blank" rel="noreferrer">
              <img src={pin.imageUrl} alt={pin.title} loading="lazy" />
              <span>
                <Bookmark aria-hidden="true" size={14} fill="currentColor" />
                {pin.boardName ?? "Nail Inspo"}
              </span>
              <strong>{pin.title}</strong>
            </a>
          ))}
        </div>
      </section>
      ) : null}

      <section id="reviews" className="reviews-section">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Reviews</p>
          <h2>Proof that feels closer to Google Reviews.</h2>
          <p>Clear rating signals, real appointment context, and the studio details clients look for before they book.</p>
        </div>
        <div className="reviews-proof-layout">
          <aside className="review-summary-card" aria-label="Review summary">
            <div className="review-score-row">
              <strong>{effectiveRating.toFixed(1)}</strong>
              <span>
                {[0, 1, 2, 3, 4].map((item) => (
                  <Star key={item} size={17} fill="currentColor" />
                ))}
              </span>
              <small>{effectiveCount ? `${effectiveCount} reviews` : "200+ Google-style reviews"}</small>
            </div>
            <div className="avatar-stack review-avatar-stack" aria-hidden="true">
              {reviewAvatars.map((avatar) => (
                <img src={avatar} alt="" key={avatar} />
              ))}
            </div>
            <div className="rating-bars" aria-label="Review distribution">
              {[
                ["5", "92%"],
                ["4", "6%"],
                ["3", "2%"],
              ].map(([rating, width]) => (
                <div key={rating}>
                  <span>{rating}</span>
                  <i>
                    <b style={{ width }} />
                  </i>
                </div>
              ))}
            </div>
            <dl className="credibility-grid">
              <div>
                <dt>82%</dt>
                <dd>repeat clients</dd>
              </div>
              <div>
                <dt>24h</dt>
                <dd>reminders</dd>
              </div>
              <div>
                <dt>Private</dt>
                <dd>one-on-one studio</dd>
              </div>
              <div>
                <dt>Photos</dt>
                <dd>saved per client</dd>
              </div>
            </dl>
          </aside>

          <div className="review-grid">
          {displayReviews.map((review, index) => (
            <article className="review-card" key={`${review.name}-${index}`}>
              <div aria-hidden="true">
                {Array.from({ length: Math.max(1, Math.min(5, Math.round(review.rating))) }).map((_, starIndex) => (
                  <Star key={starIndex} size={16} />
                ))}
              </div>
              <span className="review-badge">
                <BadgeCheck size={14} />
                {review.badge}
              </span>
              <p>&quot;{review.quote}&quot;</p>
              <strong>{review.name}</strong>
              {review.service ? <small>{review.service}</small> : null}
            </article>
          ))}
          </div>
        </div>
      </section>

      <section className="owner-section">
        <div className="owner-copy">
          <p className="eyebrow">Owner dashboard</p>
          <h2>Admin tools for the part clients never see.</h2>
          <p>
            The dashboard keeps today&apos;s appointments, client notes, loyalty progress, marketing campaigns, and Instagram insights in one mobile-friendly place.
          </p>
          <Link className="primary-button owner-button" href="/admin">
            Open admin preview
            <BarChart3 aria-hidden="true" size={18} />
          </Link>
        </div>
        <div className="phone-preview" aria-label="Admin dashboard preview">
          <div className="phone-status">
            <span>9:41</span>
            <span>Dashboard</span>
          </div>
          <div className="mini-metrics">
            <span>
              <CalendarCheck size={17} />
              <strong>6</strong>
              Today
            </span>
            <span>
              <Clock size={17} />
              <strong>$485</strong>
              Revenue
            </span>
            <span>
              <UserRound size={17} />
              <strong>42</strong>
              IG clients
            </span>
          </div>
          <article className="mini-appointment">
            <p>Next appointment</p>
            <strong>Maria Silva</strong>
            <span>Structured Gel Fill - 10:00 AM</span>
            <button type="button">Check in</button>
          </article>
          <article className="mini-campaign">
            <Camera size={18} />
            <span>Birthday Discount</span>
            <strong>12 clients</strong>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <a className="brand footer-brand" href="#top">
            <Image className="brand-logo" src={studioLogo} alt={brandName} width={44} height={44} />
            <span>
              <strong>{brandName}</strong>
              <small>{brandTagline}</small>
            </span>
          </a>
          <p>{footerNote ?? "Private nail care with simple booking, personalized notes, and modern client follow-up."}</p>
        </div>
        <div>
          <strong>Contact</strong>
          <a href={`tel:${footerPhone.replace(/[^0-9+]/g, "")}`}>{footerPhone}</a>
          <a href={`mailto:${footerEmail}`}>{footerEmail}</a>
        </div>
        <div>
          <strong>Hours</strong>
          {hourLines.length ? (
            hourLines.map((line) => <span key={line}>{line}</span>)
          ) : (
            <>
              <span>Mon - Fri: 10:00 AM - 7:00 PM</span>
              <span>Saturday: 9:00 AM - 6:00 PM</span>
            </>
          )}
        </div>
      </footer>

      <div className="mobile-booking-bar">
        <span>
          <strong>{cents(totalPrice)}</strong>
          <small>{summaryName}</small>
        </span>
        <a href="#booking">Book</a>
      </div>
    </main>
  );
}
