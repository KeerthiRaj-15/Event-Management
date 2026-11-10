# Gather backend (Node + Express + MongoDB)

REST API for the Gather React frontend. Every route, request body, response shape and error `code` follows
the "Backend API contract" in the frontend README, so switching the frontend from demo mode to this API needs no UI changes.

## 1. Run it

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env   then edit it
npm run seed                # creates admin@gather.com / Admin@123 and 4 sample events (change ADMIN_* in .env first for anything real)
npm run dev                 # http://localhost:5000/api/health
```

You need a MongoDB: install it locally, or create a free cluster on MongoDB Atlas and paste its connection string into `MONGO_URI`.

## 2. Connect the frontend

In `Frontend/.env`:

```
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:5000/api
```

Restart `npm run dev` in the frontend. Backend `CLIENT_URL` must equal the frontend address (default `http://localhost:5173`), otherwise the browser blocks the calls (CORS).

## 3. Development behaviour (default `.env`)

| Setting | Effect |
|---|---|
| `SMTP_HOST` empty | No email is sent. OTP codes print in this console **and** come back as `devOtp`, which the frontend shows on screen. |
| `PAYMENT_MODE=mock` | Checkout buttons confirm instantly, no money. "Cancel" and "Declined" buttons behave as labelled. |

Both are **refused at startup when `NODE_ENV=production`**, so they cannot leak into a live site by accident.

## 4. Real payments (PayPal)

1. Create a sandbox app at developer.paypal.com and copy its Client ID and Secret.
2. `.env`: `PAYMENT_MODE=paypal`, `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID=...`, `PAYPAL_CLIENT_SECRET=...`, `API_PUBLIC_URL=` (the public address of this API).
3. Flow: the frontend calls `POST /payments/orders` -> gets `approvalUrl` -> sends the buyer to PayPal -> PayPal returns the buyer to `GET /api/payments/paypal/return`, where the server **captures the payment, checks the amount matches, issues the tickets** and redirects to the frontend `/tickets` page.
4. `PAYPAL_CURRENCY` defaults to `INR`. Some PayPal accounts cannot take INR; if the sandbox rejects it, use a currency your account supports (prices are not converted).

## 5. Real email

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (Gmail app password, Brevo, SendGrid SMTP, Resend SMTP, etc.).

## 6. Endpoints

| Area | Routes |
|---|---|
| Auth (public) | `POST /auth/register`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` |
| Profile | `PUT /users/me`, `PUT /users/me/password` |
| Events | `GET /events`, `GET /events?mine=true`, `GET /events/:id`, `POST /events`, `PUT /events/:id`, `PATCH /events/:id/status`, `DELETE /events/:id`, `POST /events/:id/cancel`, `GET /events/:id/checkins` |
| Bookings | `POST /bookings`, `GET /bookings/mine`, `GET /bookings`, `GET /bookings/:id`, `POST /bookings/:id/cancel` |
| Payments | `POST /payments/orders`, `POST /payments/capture`, `GET /payments/paypal/return`, `GET /payments/paypal/cancel` |
| Check-in | `POST /checkins` |
| Admin | `GET /admin/users`, `PATCH /admin/users/:email` |
| Health | `GET /api/health` |

Everything except auth, health and the PayPal redirects needs `Authorization: Bearer <token>`.
Errors are always `{ "message": "...", "code": "..." }`; a 401 makes the frontend log the user out.

## 7. What the server enforces (the browser cannot be trusted)

- Passwords hashed with bcrypt (cost 12); OTP codes stored as HMACs, expire in 10 min, 5 tries, 30 s resend gap.
- Admin role cannot be self-registered; only an Admin can change roles or deactivate users. Role/active status is re-read from the database on every request.
- Event rules (date not in the past in the event time zone, price, capacity, category), identical to the frontend and checked against it in testing.
- Owners/Admins only for edit, delete, cancel, publish, attendee lists and check-in.
- Seats are claimed with one atomic update that cannot exceed capacity, so two people cannot take the last seat.
- Payment is confirmed only after the provider reports it completed **and** the amount matches; paying twice never charges or issues tickets twice; if the last seats vanish during payment the buyer is refunded automatically.
- A ticket code can be checked in once (unique index, safe even if two gates scan at the same instant).
- Cancellation: 24 h cutoff and "ticket already used" re-checked on the server; refund via the provider, seats released; a failed refund leaves the booking untouched.
- Rate limiting on every route, stricter on auth; Helmet headers; CORS limited to `CLIENT_URL`.

## 8. Known limits

- No database transactions (works on a plain local MongoDB). A server crash in the middle of confirming a booking could leave seats taken with the booking still pending; use an Atlas / replica-set deployment and wrap `confirmBooking` in a transaction if you need that guarantee.
- Refunds are always full (no partial refunds), as in the frontend.
- No automatic expiry of unpaid bookings (they do not hold seats; a user may have at most 10 unpaid).
- Tokens are stateless JWTs (7 days). "Log out" removes the token in the browser only.

## 9. Changelog (review fixes)

- Project folder flattened: one `backend/` folder (the zip had `Backend/backend/backend/...` copies and a stale root `package.json` with unused packages).
- Payments: a buyer who paid while the booking/event was being cancelled is now refunded automatically (previously the money was kept). The PayPal return redirect now re-checks that the booking is still payable.
- Events: an empty price is rejected instead of silently creating a free event; editing an event without sending `status` no longer unpublishes it.
- Admin: `PATCH /admin/users/:email` no longer double-decodes the email (a `%` caused a 500).
- Errors: Mongoose validation errors return 400 `VALIDATION` instead of 500.
- Config: trailing `/` in `CLIENT_URL` is stripped (it broke CORS matching and redirects).
- CORS: in development any `localhost` / `127.0.0.1` port is accepted (Vite moving to 5174, or opening the site via 127.0.0.1, no longer breaks the app). Production still allows only `CLIENT_URL`.
- Login of an unverified account now returns the dev code (`devOtp`, development only) so the verify page can show it.
