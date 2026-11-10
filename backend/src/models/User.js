import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["Attendee", "Organizer", "Admin"], default: "Attendee" },
    verified: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    // email verification code
    otpHash: String, otpExpires: Date, otpTries: { type: Number, default: 0 }, otpSentAt: Date,
    // password reset code
    resetHash: String, resetExpires: Date, resetTries: { type: Number, default: 0 }, resetSentAt: Date,
  },
  { timestamps: true }
);

export const User = mongoose.model("User", schema);

// The only user shape the frontend ever sees (never the hash or codes).
export const publicUser = (u) => ({ name: u.name, email: u.email, phone: u.phone || "", role: u.role });
export const adminUser = (u) => ({ ...publicUser(u), verified: u.verified, active: u.active, createdAt: u.createdAt });
