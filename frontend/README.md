# Gather — Event Management Frontend (React + Vite)

```bash
npm install
npm run dev        # http://localhost:5173
```

Runs fully in the browser (data in localStorage) until the backend is ready.
Set `VITE_USE_MOCK=false` and `VITE_API_URL=http://localhost:5000/api` in `.env` to call the real API.

**Demo admin:** `admin@gather.com` / `Admin@123`. Register other users on `/register` (the OTP is shown on screen in demo mode).

## Module status

| # | Module | Status | Where |
|---|--------|--------|-------|
| 1 | Registration | Done | `/register` |
| 2 | Login / Logout | Done (logout now clears redirect state) | `/login`, sidebar |
| 3 | OTP verification | Done | `/verify-otp` |
| 4 | Role-based access | Done: Attendee / Organizer / Admin routes + role-based sidebar | `AppRouter.jsx`, `PageLayout.jsx` |
| 5 | User dashboard | Done: separate Attendee, Organizer, Admin dashboards | `/dashboard`, `/admin` |
| 6 | Event listing | Done + upcoming/past/price filters | `/events` |
| 7 | Event details | Done | `/events/:id` |
| 8 | Create / edit event | Done + full validation (see below) | `/events/new`, `/events/:id/edit` |
| 9 | Event booking | Done (blocked for ended events) | event details |
| 10 | Payment | Done (mock PayPal sandbox) | `/checkout/:id` |
| 11 | Ticket generation | Done (QR per seat) | `/tickets` |
| 12 | QR check-in | Done: **camera scanning** (BarcodeDetector, no extra package) plus typed code / USB scanner; one use per ticket | `/checkin`, `components/QrScanner.jsx` |
| 13 | Admin dashboard | Done: users (role, deactivate), events, bookings | `/admin` |
| 14 | Reports and analytics | Done: 7 / 30 / 90 day / all-time range, revenue and ticket trend (daily, weekly or monthly), average booking, attendance rate, per-event table, CSV export, print | `/reports` |
| + | Discover online | Done: events from other websites (via your backend), search/city/date filters, links open on the source site | `/discover` |
| + | Write with AI | Done: organizer button on the event form, result is editable and never saved automatically | `/events/new` |
| + | AI assistant memory | Done: follow-up questions use the last 6 chat turns | chat widget |
| + | Forgot / reset password | Done: email -> 6-digit code (10 min, 5 tries) -> new password | `/forgot-password` |
| + | Booking cancellation + refund | Done: attendee, free until 24h before the event, full refund, seats released, ticket stops working | `/tickets` |
| + | Event cancellation | Done: organizer cancels with a reason, every booking is refunded | `/events/:id/manage` |
| + | Profile update | Done: name, phone, change password | `/profile` |
| + | Event workspace | Done: per-event attendees, revenue, check-in, publish, delete, CSV | `/events/:id/manage` |

## Validation rules (`src/validation.js`)
- **Date/time:** required; real calendar date; not in the past (uses *local* time, not UTC); if today, start time must be later than now; max 3 years ahead. Editing a past event is allowed unless you move it to another past moment.
- **Price:** required whole rupees, 0 = free, no negatives/decimals, max ₹1,00,000.
- **Capacity:** whole number 1 to 1,00,000, never below seats already booked.
- Events that already have bookings cannot be deleted (unpublish instead). Booking is closed once an event has started.

## Backend API contract (when `VITE_USE_MOCK=false`)
All except auth need `Authorization: Bearer <token>`. **The backend must enforce roles and repeat every validation.**

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/register`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/login` | login returns `{ token, user: { name, email, phone, role } }` |
| PUT | `/users/me` `{ name, phone }` | returns updated user |
| PUT | `/users/me/password` `{ currentPassword, newPassword }` | |
| GET | `/events`, `/events?mine=true`, `/events/:id` | `mine` = own events (Admin: all) |
| POST / PUT / DELETE | `/events`, `/events/:id` | Organizer/Admin; 409 `HAS_BOOKINGS` on delete |
| PATCH | `/events/:id/status` `{ status }` | `Published` or `Draft` |
| POST | `/bookings` `{ eventId, quantity }` | 1-5 tickets; free events return CONFIRMED |
| GET | `/bookings/mine`, `/bookings/:id`, `/bookings` | `/bookings` = bookings for events the user manages |
| POST | `/payments/orders` `{ bookingId }`, `/payments/capture` | PayPal; order returns `approvalUrl` |
| POST | `/auth/forgot-password` `{ email }`, `/auth/reset-password` `{ email, otp, newPassword }` | forgot always returns 200 (do not reveal whether the email exists); OTP expires in 10 min, max 5 tries |
| POST | `/bookings/:id/cancel` | owner only; server re-checks the 24h cutoff and refunds through PayPal; sets `status: "CANCELLED"`, `refundAmount`, `refundId` |
| POST | `/events/:id/cancel` `{ reason }` | Organizer/Admin; sets event `status: "Cancelled"`, cancels and refunds all bookings |
| GET | `/external/events?q=&city=&from=&page=` | `{ events: [{ id, source, title, category, date, time, location, city, url, image, priceText }], hasMore }`; 503 `NOT_CONFIGURED` when no provider key |
| POST | `/ai/describe` `{ title, category, date, time, location }` | `{ text, ai }` (Organizer/Admin) |
| POST | `/ai/chat` `{ message, history }` | `{ reply, events, onlineEvents }` |
| GET | `/events/:id/checkins` | `[{ code, at, by, eventId }]` |
| POST | `/checkins` `{ eventId, code, override? }` | error codes `INVALID`, `WRONG_EVENT`, `USED`, `CANCELLED`, `NOT_TODAY` |
| GET | `/admin/users` | Admin only |
| PATCH | `/admin/users/:email` `{ role?, active? }` | Admin only |

Event shape: `{ id, title, category, date: "YYYY-MM-DD", time: "HH:mm", location, description, price, capacity, booked, status, organizerEmail }`.
Booking shape: `{ id, eventId, eventTitle, eventDate, eventTime, location, userEmail, userName, quantity, amount, status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED", tickets: [code], paymentId?, createdAt, usedTickets: [code] (tickets already scanned), cancelledAt?, cancelReason?, refundAmount?, refundId? }`. Event `status` is `Draft` | `Published` | `Cancelled`.

## Notes
- The old standalone sidebar dashboard (`App.jsx`) kept its own event data (`attendees`, no price) in the same storage key as the API, so events made there broke booking. It is replaced by the role-based workspace; old stored data is rebuilt automatically.
- Mock mode stores passwords in plain text in localStorage. This is for demo only. The real backend must hash them (bcrypt).
- Cancellation rules live in `src/validation.js` (`CANCEL_CUTOFF_HOURS`). Change it there and on the server.
- Camera scanning uses the browser's `BarcodeDetector` API: Chrome / Edge / Android Chrome, on https or localhost. Safari and Firefox do not have it yet, so there the page shows the type-the-code box and a USB/Bluetooth scanner still works. A QR held steady in front of the camera counts as one scan.
- Real-API mode (`VITE_USE_MOCK=false`): an HTTP 401 clears the session and returns to `/login`; a down server shows "Cannot reach the server"; 403 shows a permission message (`request()` in `src/api.js`).
- `src/App.jsx` is the old standalone dashboard. Nothing imports it any more and it can be deleted.
- Not included yet: real emails, partial refunds, waitlist.


## Gather AI assistant

A floating **Ask Gather AI** panel is available throughout authenticated pages. It needs the real backend:
- Set `VITE_USE_MOCK=false` and `VITE_API_URL=http://localhost:5000/api` in `.env`.
- Configure `OPENAI_API_KEY` (and optionally `TICKETMASTER_API_KEY`) in the backend `.env`.
- Restart Vite and the backend, then sign in with a backend account.
