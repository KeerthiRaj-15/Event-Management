// npm run seed  -> creates the first Admin (and a few sample events). Safe to run more than once.
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config } from "./config.js";
import { User } from "./models/User.js";
import { Event } from "./models/Event.js";
import { localDate, nowLocal } from "./utils/time.js";
import { validatePassword } from "./utils/validation.js";

if (!config.mongoUri) { console.error("MONGO_URI is not set."); process.exit(1); }
const email = (process.env.ADMIN_EMAIL || "admin@gather.com").toLowerCase();
const password = process.env.ADMIN_PASSWORD || "Admin@123";
if (config.production && password === "Admin@123") { console.error("Set a real ADMIN_PASSWORD before seeding production."); process.exit(1); }
const pwError = validatePassword(password);
if (pwError) { console.error("ADMIN_PASSWORD: " + pwError); process.exit(1); }

await mongoose.connect(config.mongoUri);
await User.init();

if (await User.exists({ email })) console.log(`Admin ${email} already exists (left unchanged).`);
else {
  await User.create({ name: "Admin", email, passwordHash: await bcrypt.hash(password, 12), role: "Admin", verified: true, active: true });
  console.log(`Created admin ${email}`);
}

if (!process.argv.includes("--no-samples") && (await Event.countDocuments()) === 0) {
  const day = (n) => { const d = nowLocal(); d.setUTCDate(d.getUTCDate() + n); return localDate(d); };
  const base = { organizerEmail: email, status: "Published", booked: 0 };
  await Event.insertMany([
    { ...base, title: "Design Futures Summit", category: "Conference", date: day(8), time: "09:30", location: "Bengaluru International Centre", description: "A one-day summit on product design, research and the future of interfaces.", price: 499, capacity: 300 },
    { ...base, title: "Build with AI Workshop", category: "Workshop", date: day(11), time: "10:00", location: "WeWork Galaxy, Bengaluru", description: "Hands-on session building small apps with language model APIs.", price: 0, capacity: 100 },
    { ...base, title: "Indie Music Evening", category: "Entertainment", date: day(15), time: "18:30", location: "The Courtyard, Bengaluru", description: "Live sets from five independent bands.", price: 250, capacity: 250 },
    { ...base, title: "Startup Connect", category: "Networking", date: day(22), time: "14:00", location: "The Lalit Ashok, Bengaluru", description: "Meet founders and investors. Draft until the venue is confirmed.", price: 150, capacity: 180, status: "Draft" },
  ]);
  console.log("Created 4 sample events.");
}
await mongoose.disconnect();
