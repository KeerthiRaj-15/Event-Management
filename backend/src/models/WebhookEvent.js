import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    event: { type: String, required: true },
    status: { type: String, enum: ["PROCESSING", "PROCESSED"], default: "PROCESSING", index: true },
    processedAt: Date,
  },
  { timestamps: true }
);

export const WebhookEvent = mongoose.model("WebhookEvent", schema);
