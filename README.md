# Private Nail Studio Booking App

Mobile-first booking website and owner dashboard for a private nail studio, built with Next.js, TypeScript, Node route handlers, and PostgreSQL-ready data access.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Pages

- `/` - client-facing booking website
- `/account` - client portal (sign in / register, see and cancel appointments)
- `/admin` - owner dashboard (requires admin sign-in)
- `/admin/appointments` - schedule with drag-and-drop rescheduling
- `/admin/settings` - edit site text, branding, hours, reviews, and integrations
- `/admin/login` - admin sign-in
- `/booking-confirmed` - post-booking confirmation page

## Accounts and sign-in

- **Admin:** the first time you open `/admin/login`, an admin account is seeded from
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` (or the studio owner email + the default password
  `admin1234`). Change it under Admin -> Settings -> Admin password. All `/admin`
  pages and admin APIs require a signed-in admin.
- **Clients:** customers can register/sign in at `/account` to view and cancel their
  appointments. Bookings are matched to an account by email.
- Sessions are signed with `AUTH_SECRET` (or a generated secret saved in
  `.data/auth-secret`). Set `AUTH_SECRET` in production for stable sessions.

## Settings (no-code admin panel)

Admin -> Settings is the single source of truth for site configuration. From there
the owner can edit, without touching code:

- Branding (studio name, colors, logo, tagline)
- Homepage text (hero + footer)
- Location and contact details
- Business hours per weekday + time-slot size (drives real booking availability)
- Reviews (manual testimonials, or live Google reviews)
- Integration credentials (SMTP, Stripe, Google, Twilio)
- Data storage (create/repair Postgres tables)

Anything set in the admin panel overrides the matching environment variable.

## PostgreSQL

On a normal Node server, the app can use a local JSON file store when
`DATABASE_URL` is unset or unreachable. Serverless hosts such as Vercel must use
PostgreSQL because their filesystem is temporary and is not shared between
requests. The admin login shows a configuration error instead of creating an
unreliable temporary account when a Vercel database is missing or unreachable.
To use PostgreSQL:

1. Create a database and role, e.g.

   ```sql
   create database private_nail_studio;
   create role nail with login password 'choose-a-password';
   grant all privileges on database private_nail_studio to nail;
   ```

2. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to match the role and
   password above.
3. Start the app and open `/admin/login`. On Vercel, the required tables are
   created automatically before the first admin login. On a normal Node server,
   you can also use Admin -> Settings -> Data storage -> **Create / update tables**
   or run `src/server/schema.sql` manually.

**"password authentication failed for user ..."** means `DATABASE_URL` does not match
your Postgres credentials. Either update the URL to the correct user/password, or
reset the role's password to match. A normal Node server can fall back to its local
file store; Vercel blocks admin login and writes until the remote database is
reachable so changes cannot appear to save and then disappear.

API routes:

- `GET /api/services`
- `POST /api/services` (admin)
- `PATCH /api/services/:id` (admin)
- `DELETE /api/services/:id` (admin)
- `GET /api/availability?date=YYYY-MM-DD[&duration=120]`
- `POST /api/availability` (admin)
- `GET /api/bookings`
- `POST /api/bookings`
- `GET /api/admin/overview` (admin)
- `GET|PUT /api/admin/settings` (admin)
- `POST /api/admin/settings/test-smtp` (admin)
- `POST /api/admin/password` (admin)
- `GET|POST /api/admin/db` (admin: status / create tables)
- `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`, `GET /api/auth/session`
- `GET /api/account/appointments`, `DELETE /api/account/appointments/:id` (client)
- `POST /api/payments/checkout`, `POST /api/payments/webhook` (Stripe)
- `GET /api/reviews` (manual or live Google reviews)
- `GET /api/instagram`
- `GET /api/pinterest`

## Admin features

- Edit service name, category, price, duration, description, and image URL.
- Add new manicure or pedicure services.
- Delete services from the admin panel. PostgreSQL uses a soft delete so past appointments keep their service reference.
- Toggle calendar slots available or blocked.
- Client booking supports multiple services and only shows start times with enough open space for the combined duration.
- The booking API also validates availability server-side before creating an appointment.
- Booking confirmation emails are sent to the client and nail tech when SMTP is configured. Without SMTP, emails are saved to the local outbox for preview.
- New bookings create admin dashboard notifications.
- Pull Instagram posts and metrics into the public gallery and admin insights when `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN` are set.
- Pull saved Pinterest board pins into the Nail Inspo section when `PINTEREST_ACCESS_TOKEN` and `PINTEREST_BOARD_ID` are set.

Without `DATABASE_URL`, edits persist in `.data/demo-store.json` for local preview.

## Email and Location

Set these in `.env.local` to send real confirmation emails and show accurate studio details:

```bash
STUDIO_NAME="Nunez Nails"
STUDIO_OWNER_NAME="Gisela"
STUDIO_EMAIL="hello@nuneznails.com"
STUDIO_OWNER_EMAIL="gisela@example.com"
STUDIO_PHONE="(555) 123-4567"
STUDIO_LOCATION_NAME="Nunez Nails Private Studio"
STUDIO_ADDRESS="123 Beauty Lane, Houston, TX 77001"
STUDIO_TIMEZONE="America/Chicago"
EMAIL_FROM="Nunez Nails <hello@nuneznails.com>"

SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="smtp-user"
SMTP_PASS="smtp-password"
```

The email includes a clickable map card that opens Google Maps. Add `GOOGLE_MAPS_STATIC_API_KEY` if you want the email to include a real static map image; otherwise it uses a styled map card that still opens Maps.

## Instagram API

The app uses the Instagram Graph API through `/api/instagram`. For live data, the Instagram account must be a Professional account connected to a Facebook Page, and the token must include access to that Instagram business account.

Set these in `.env.local`:

```bash
INSTAGRAM_USER_ID="178..."
INSTAGRAM_ACCESS_TOKEN="EA..."
INSTAGRAM_GRAPH_VERSION="v23.0"
```

When those values are missing or the API rejects a request, the site keeps rendering demo posts so the layout is still previewable.

## Pinterest API

The Nail Inspo section uses `/api/pinterest`. For live saved pins, create a Pinterest developer app and generate an OAuth token with read scopes for boards and pins.

Set these in `.env.local`:

```bash
PINTEREST_ACCESS_TOKEN="pina_..."
PINTEREST_BOARD_ID="123..."
PINTEREST_BOARD_NAME="Nail Inspo"
PINTEREST_PROFILE_NAME="Nunez Nails"
PINTEREST_PROFILE_URL="https://www.pinterest.com/your-profile/"
```

When those values are missing or Pinterest rejects a request, the section keeps rendering demo inspo pins.

## Payments and deposits (Stripe)

Enable deposits or full payment at booking under Admin -> Settings -> Payments
(or via `STRIPE_*` env vars). When the mode is "deposit" or "full" and a secret key
is present, a successful booking redirects the client to Stripe Checkout; otherwise
booking stays free and goes straight to the confirmation page.

- Set the secret + publishable keys and the deposit amount.
- Point a Stripe webhook at `POST /api/payments/webhook` and paste the signing
  secret so paid deposits are recorded.

No Stripe SDK is required - the integration uses the Stripe REST API over `fetch`.

## Reviews (Google or manual)

Under Admin -> Settings -> Reviews choose:

- **Manual** - type testimonials, a headline rating, and a total count.
- **Google** - paste a Google **Place ID** and a **Places API key** (Settings ->
  Google). The site then pulls live rating, review count, and recent reviews via
  `GET /api/reviews`, falling back to your manual reviews if the API is unavailable.

## SMS and WhatsApp (Twilio)

Under Admin -> Settings -> SMS & WhatsApp, enable texting and add your Twilio
Account SID, Auth Token, and a from-number. Booking confirmations and the admin's
reminder/cancellation/custom messages are then also sent by text (SMS or WhatsApp).
Uses the Twilio REST API over `fetch`; disabled by default so email still works
on its own.
