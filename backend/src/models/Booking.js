import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    // copied from the event so a booking still reads correctly later (kept in sync when the event is edited)
    eventTitle: String, eventDate: String, eventTime: String, location: String,
    userEmail: { type: String, required: true, lowercase: true, index: true },
    userName: String,
    quantity: { type: Number, required: true, min: 1, max: 5 },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["PENDING_PAYMENT", "CONFIRMED", "CANCELLED"], default: "PENDING_PAYMENT", index: true },
    tickets: { type: [String], default: [] },
    paymentId: String,        // Razorpay payment id pay_xxx (or PAY-xxxx in mock mode); used for refunds
    razorpayOrderId: String,
    processing: { type: Boolean, default: false }, // true while one request is confirming the booking (prevents double confirm)
    cancelledAt: Date, cancelledBy: String, cancelReason: String,
    refundAmount: Number, refundId: String,
  },
  { timestamps: true }
);

// A ticket code can exist only once in the whole system.
schema.index({ tickets: 1 }, { unique: true, partialFilterExpression: { "tickets.0": { $exists: true } } });

schema.set("toJSON", {
  transform: (_doc, r) => {
    r.id = String(r._id);
    r.eventId = String(r.eventId);
    delete r._id; delete r.__v; delete r.razorpayOrderId; delete r.processing; delete r.updatedAt;
    return r;
  },
});

export const Booking = mongoose.model("Booking", schema);
