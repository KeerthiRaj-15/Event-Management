import mongoose from "mongoose";

// One document per ticket that has been scanned. The unique index on `code` is what makes
// "each ticket works once" safe even if two gates scan the same QR at the same moment.
const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
  by: { type: String, required: true },
  at: { type: Date, default: Date.now },
});

schema.set("toJSON", {
  transform: (_doc, r) => ({ code: r.code, at: r.at, by: r.by, eventId: String(r.eventId) }),
});

export const CheckIn = mongoose.model("CheckIn", schema);
