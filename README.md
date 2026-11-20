# Gather — Event Management & Ticketing Platform

Gather is a full-stack event management platform that connects **attendees, organizers, and administrators**. Users can discover events, book tickets, make payments, and check in using QR-code tickets. Organizers can manage events and track bookings, while admins manage platform activity.

## Key Features

- **Event management:** Create, publish, update, browse, and cancel events.
- **Ticket booking:** Book 1–5 tickets, enforce event capacity, and hold seats temporarily during checkout.
- **Payments:** Razorpay checkout with server-side payment verification; mock mode for development.
- **QR ticketing:** Generate unique ticket codes and validate check-ins, preventing duplicate entry.
- **Role-based access:** Separate permissions for Attendees, Organizers, and Admins.
- **Dashboards:** View event bookings, attendees, check-ins, and platform reports.
- **Additional integrations:** OTP/email notifications, AI assistance, and Ticketmaster event discovery (configuration required).

## Tech Stack

| Area | Technologies |
|---|---|
| Frontend | React 18, Vite, React Router |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcryptjs, OTP verification |
| Payments | Razorpay |
| Other | QR codes, Nodemailer, OpenAI API, Ticketmaster API |

## System Architecture

Gather uses a **modular monolithic architecture**: a React frontend communicates with a single Express REST API, which contains separate modules for authentication, events, bookings, payments, check-ins, administration, and integrations.

```text
                  Attendee / Organizer / Admin
                              |
                              v
                    React + Vite Frontend
                              |
                       REST API + JWT
                              |
                              v
                       Node.js + Express
                  /           |            \
             Auth & Events  Bookings &     Integrations
                           Payments        Razorpay / SMTP
                              |            OpenAI / Ticketmaster
                              v
                         MongoDB
                 Users | Events | Bookings
                       Check-ins
```

### Important Design Highlights

- **Security:** Password hashing, JWT authentication, backend role/ownership checks, CORS configuration, and API rate limiting.
- **Booking reliability:** Backend capacity checks, temporary unpaid booking holds, and guarded booking confirmation to reduce overbooking and duplicate processing.
- **Payment integrity:** Payment signatures and provider payment status are verified on the backend; Razorpay webhooks are signature-verified and deduplicated.
- **Ticket validation:** Unique QR ticket codes and database uniqueness checks prevent the same ticket from being checked in twice.

## Project Structure

```text
gather/
├── frontend/          # React application
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── auth/
│       └── api.js
├── backend/           # Express REST API
│   └── src/
│       ├── routes/
│       ├── models/
│       ├── services/
│       ├── middleware/
│       └── utils/
└── README.md
```

## Run Locally

**Requirements:** Node.js 18+, npm, and MongoDB.

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env` and configure the required values:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/gather
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES=7d
CLIENT_URL=http://localhost:5173
API_PUBLIC_URL=http://localhost:5000
EVENT_UTC_OFFSET=+05:30
PAYMENT_MODE=mock
```

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the backend environment if you want to create an initial admin account, then run:

```bash
npm run seed
npm run dev
```

Backend API: `http://localhost:5000/api`  
Health check: `http://localhost:5000/api/health`

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

## User Roles

| Role | Main capabilities |
|---|---|
| Attendee | Browse events, book tickets, view tickets, and manage bookings |
| Organizer | Create and manage own events, view attendees, and check in tickets |
| Admin | Manage users, events, bookings, and reports |

## Integrations

- **Razorpay:** Set `PAYMENT_MODE=razorpay` and configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in the backend environment.
- **Email:** Configure SMTP variables to send OTP and ticket emails.
- **OpenAI:** Configure `OPENAI_API_KEY` to enable supported AI features.
- **Ticketmaster:** Configure `TICKETMASTER_API_KEY` for third-party event discovery. External listings are not Gather bookings.

Use mock payments for local development only. Keep all private credentials in the backend environment; never expose them through frontend `VITE_` variables.

## Important Notes

- The project is a modular monolith, not a microservices system.
- Booking confirmation currently does not use a MongoDB multi-document transaction; transaction-based consistency is a potential production improvement.
- Optional integrations require valid provider credentials and configuration.
- Do not commit `.env` files. If credentials were included in a shared archive or repository, rotate them before publishing.

## License

No license is currently included. Add a `LICENSE` file before publishing the repository if you want to define how others may use, modify, and distribute the project.
