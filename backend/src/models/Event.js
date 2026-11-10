import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD" (event time zone)
    time: { type: String, required: true }, // "HH:mm"
    location: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: "", maxlength: 500 },
    price: { type: Number, required: true, min: 0 }, // whole rupees, 0 = free
    capacity: { type: Number, required: true, min: 1 },
    booked: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["Draft", "Published", "Cancelled"], default: "Draft" },
    organizerEmail: { type: String, required: true, lowercase: true, index: true },
    cancelReason: String,
  },
  { timestamps: true }
);
schema.index({ status: 1, date: 1 });

schema.set("toJSON", {
  transform: (_doc, r) => { r.id = String(r._id); delete r._id; delete r.__v; return r; },
});

export const Event = mongoose.model("Event", schema);
