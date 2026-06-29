create extension if not exists pgcrypto;

create table if not exists services (
  id text primary key,
  name text not null,
  description text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  category text not null,
  image_url text not null default '',
  is_popular boolean not null default false,
  is_addon boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table services add column if not exists image_url text not null default '';
alter table services add column if not exists is_addon boolean not null default false;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text not null default '',
  instagram_handle text,
  notes text not null default '',
  loyalty_visits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_id text not null references services(id),
  service_ids text[] not null default '{}',
  appointment_at timestamptz not null,
  duration_minutes integer,
  price_cents integer,
  tip_cents integer not null default 0,
  discount_cents integer not null default 0,
  promo_code text,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table appointments add column if not exists service_ids text[] not null default '{}';
alter table appointments add column if not exists duration_minutes integer;
alter table appointments add column if not exists price_cents integer;
alter table appointments add column if not exists tip_cents integer not null default 0;
alter table appointments add column if not exists discount_cents integer not null default 0;
alter table appointments add column if not exists promo_code text;
-- Allow the no_show status on databases created before it existed.
alter table appointments drop constraint if exists appointments_status_check;
alter table appointments add constraint appointments_status_check
  check (status in ('confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'));

create table if not exists availability_overrides (
  date date not null,
  time text not null,
  available boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, time)
);

create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  audience text not null,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'sent')),
  scheduled_for timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'system'
    check (type in ('booking', 'email', 'system')),
  title text not null,
  body text not null,
  appointment_id uuid references appointments(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id) on delete set null,
  recipient text not null,
  subject text not null,
  html text not null,
  text text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create table if not exists client_reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  rating integer not null check (rating between 1 and 5),
  text text not null default '',
  appointment_id uuid references appointments(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_reviews_created_idx on client_reviews(created_at desc);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  phone text not null default '',
  role text not null default 'client' check (role in ('admin', 'client')),
  password_hash text not null,
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  description text not null default '',
  category text not null default 'supplies',
  amount_cents integer not null check (amount_cents >= 0),
  receipt_url text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on expenses(expense_date);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id) on delete set null,
  provider text not null default 'stripe',
  session_id text,
  payment_intent text,
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  kind text not null default 'deposit' check (kind in ('deposit', 'full')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_email_idx on accounts(lower(email));
create index if not exists payments_appointment_idx on payments(appointment_id);
create index if not exists appointments_at_idx on appointments(appointment_at);
create index if not exists appointments_client_idx on appointments(client_id);
create index if not exists admin_notifications_created_idx on admin_notifications(created_at desc);
create index if not exists email_outbox_appointment_idx on email_outbox(appointment_id);

insert into services (id, name, description, duration_minutes, price_cents, category, image_url, is_popular, sort_order)
values
  ('structured-gel-fill', 'Structured Gel Fill', 'Balance, reshape, cuticle care, and a flawless gel refresh.', 75, 6500, 'manicure', 'https://images.unsplash.com/photo-1612887390768-fb02affea7a6?auto=format&fit=crop&w=900&q=85', true, 10),
  ('gel-x-full-set', 'Gel-X Full Set', 'Lightweight extensions with custom length, shape, and polish.', 105, 8500, 'manicure', 'https://images.unsplash.com/photo-1571290274554-6a2eaa771e5f?auto=format&fit=crop&w=900&q=85', true, 20),
  ('builder-manicure', 'Builder Manicure', 'Strengthening overlay for natural nails with long-wear color.', 90, 7800, 'manicure', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=85', false, 30),
  ('nail-art-upgrade', 'Nail Art Upgrade', 'Chrome, French, gems, charms, or hand-painted details.', 30, 2500, 'manicure', 'https://images.unsplash.com/photo-1588359953494-0c215e3cedc6?auto=format&fit=crop&w=900&q=85', false, 40),
  ('luxury-pedicure', 'Luxury Pedicure', 'Detailed foot care, scrub, massage, and gel polish.', 60, 5800, 'pedicure', 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=900&q=85', false, 50)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  category = excluded.category,
  image_url = excluded.image_url,
  is_popular = excluded.is_popular,
  sort_order = excluded.sort_order,
  updated_at = now();
