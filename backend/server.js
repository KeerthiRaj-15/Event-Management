import mongoose from "mongoose";
import { config, assertConfig } from "./src/config.js";
import app from "./src/app.js";
import { User } from "./src/models/User.js";
import { Event } from "./src/models/Event.js";
import { Booking } from "./src/models/Booking.js";
import { CheckIn } from "./src/models/CheckIn.js";

assertConfig();

await mongoose.connect(config.mongoUri);
// Build the indexes BEFORE accepting traffic: the unique ones (email, ticket code, check-in code) are what make
// duplicate sign-ups and double check-ins impossible.
await Promise.all([User.init(), Event.init(), Booking.init(), CheckIn.init()]);

const server = app.listen(config.port, () => {
  console.log(`Gather API listening on http://localhost:${config.port}  (payments: ${config.paymentMode}, dev OTP in responses: ${config.exposeDevOtp})`);
});

const stop = () => server.close(() => mongoose.disconnect().then(() => process.exit(0)));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
