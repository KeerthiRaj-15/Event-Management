# Gather – Architecture

Gather is an event platform: people discover events, book and pay for tickets, and organizers check guests in with a QR code.

## 1. Big picture

```
┌────────────────┐        ┌────────────────┐        ┌────────────────┐
│    FRONTEND    │  API   │    BACKEND     │        │    DATABASE    │
│                │ ─────► │                │ ─────► │                │
│ React + Vite   │ ◄───── │ Node + Express │ ◄───── │    MongoDB     │
│ (what users    │  JSON  │ (rules, login, │        │ (stores data)  │
│  see)          │        │  payments)     │        │                │
└────────────────┘        └───────┬────────┘        └────────────────┘
                                  │
                  ┌───────────────┼────────────────┐
                  ▼               ▼                ▼
           ┌────────────┐  ┌────────────┐  ┌──────────────┐
           │  Razorpay  │  │   OpenAI   │  │ Ticketmaster │
           │ (payments) │  │ (AI chat)  │  │ SerpApi      │
           │            │  │            │  │ (other events)│
           └────────────┘  └────────────┘  └──────────────┘
```

**In one line:** the frontend shows pages, the backend enforces the rules, MongoDB stores the data, and outside services handle payments, AI, and extra events.

## 2. Who can do what

```
┌───────────────┐   ┌─────────────────┐   ┌──────────────┐
│   ATTENDEE    │   │    ORGANIZER    │   │    ADMIN     │
├───────────────┤   ├─────────────────┤   ├──────────────┤
│ Browse events │   │ Everything an   │   │ Everything   │
│ Book + pay    │   │ attendee can    │   │ an organizer │
│ View tickets  │   │ plus:           │   │ can, for     │
│ Use AI chat   │   │ Create events   │   │ all events,  │
│               │   │ Scan QR tickets │   │ plus:        │
│               │   │ See reports     │   │ Manage users │
└───────────────┘   └─────────────────┘   └──────────────┘
```

## 3. Backend inside (one request)

```
 Request ──► Security checks ──► Login check ──► Route ──► Service ──► Database
             (helmet, CORS,      (JWT token,     (e.g.     (business   (MongoDB
              rate limit)         role)          bookings)  rules)      models)
```

## 4. Data stored (4 main things)

```
  USER ──creates──► EVENT ──has──► BOOKING ──each ticket──► CHECK-IN
 (name, email,     (title, date,   (who, how many,          (scanned once,
  role)             price, seats)   paid or not,             by whom, when)
                                    ticket codes)
```

## 5. Booking and payment (simple version)

```
  1. User picks an event
        │
        ▼
  2. Backend creates a booking  ──► status: PENDING
        │
        ▼
  3. User pays on Razorpay
        │
        ▼
  4. Backend checks the payment is real
        │
        ▼
  5. Seats reduced, ticket codes created  ──► status: CONFIRMED
        │
        ▼
  6. User sees QR tickets
```

If the browser closes after paying, Razorpay tells the backend directly (webhook), so the ticket is still issued.

## 6. Entry at the gate

```
  Organizer scans QR
        │
        ▼
  Is the ticket valid and paid? ──── no ──► Reject
        │ yes
        ▼
  Already used? ──────────────────── yes ─► Reject ("already used")
        │ no
        ▼
  Let the guest in, and record it
```










