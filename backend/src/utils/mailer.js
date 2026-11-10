import nodemailer from "nodemailer";
import { config } from "../config.js";
import { AppError } from "./http.js";

let transport;
const getTransport = () => {
  if (!config.smtp.host) return null;
  transport ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transport;
};

export async function sendMail({ to, subject, text }) {
  const t = getTransport();
  if (!t) {
    // Development: no SMTP configured, so show the message here instead.
    console.log(`\n[mail to ${to}] ${subject}\n${text}\n`);
    return;
  }
  try {
    await t.sendMail({ from: config.smtp.from, to, subject, text });
  } catch (err) {
    console.error("Email failed:", err.message);
    throw new AppError(502, "We could not send the email. Please try again in a moment.", "MAIL_FAILED");
  }
}

export const sendOtpMail = (to, otp, purpose) =>
  sendMail({
    to,
    subject: purpose === "reset" ? "Your Gather password reset code" : "Your Gather verification code",
    text: `Your code is ${otp}. It expires in 10 minutes. If you did not request it, you can ignore this email.`,
  });
