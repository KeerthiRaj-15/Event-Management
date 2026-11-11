import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword, resetPassword } from "../../api";
import { validatePasswordChange, RESET_OTP_MINUTES } from "../../validation.js";
import "./Registration.css";
import AuthStage from "../../components/AuthStage.jsx";

// Step 1: enter email -> code is sent. Step 2: enter code + new password.
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async (e) => {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await forgotPassword(email);
      setDevOtp(r?.devOtp || "");
      setStep(2);
      setCooldown(30);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code.");
    const v = validatePasswordChange({ current: "x", next: pw.next, confirm: pw.confirm });
    if (v.next || v.confirm) return setError(v.next || v.confirm);
    setLoading(true);
    try {
      await resetPassword(email, otp, pw.next);
      navigate("/login", { replace: true, state: { message: "Password reset. Log in with your new password." } });
    } catch (err) {
      setError(err.message || "Could not reset the password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <AuthStage />
      <div className="register-card">
        <div className="register-brand">
          <div className="register-logo">G</div>
          <h1>Gather</h1>
        </div>
        <div className="register-heading">
          <h2>{step === 1 ? "Forgot your password?" : "Set a new password"}</h2>
          <p>{step === 1 ? "Enter your email and we will send you a 6-digit code." : `If ${email.trim()} has an account, a code was sent. It expires in ${RESET_OTP_MINUTES} minutes.`}</p>
        </div>

        {step === 2 && devOtp && <div className="register-ok">Demo mode: no email is sent. Your code is <strong>{devOtp}</strong>.</div>}
        {error && <div className="register-error" role="alert">{error}</div>}

        {step === 1 ? (
          <form onSubmit={sendCode}>
            <div className="register-field">
              <label htmlFor="fp-email">Email Address</label>
              <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" required autoComplete="email" autoFocus />
            </div>
            <button type="submit" className="register-submit" disabled={loading}>{loading ? "Sending..." : "Send code"}</button>
          </form>
        ) : (
          <form onSubmit={reset}>
            <div className="register-field">
              <label htmlFor="fp-otp">Verification code</label>
              <input id="fp-otp" inputMode="numeric" maxLength={6} value={otp} autoComplete="one-time-code"
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" required />
            </div>
            <div className="register-field">
              <label htmlFor="fp-new">New password</label>
              <div className="register-password">
                <input id="fp-new" type={show ? "text" : "password"} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })}
                  placeholder="At least 8 characters, a letter and a number" required autoComplete="new-password" />
                <button type="button" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
              </div>
            </div>
            <div className="register-field">
              <label htmlFor="fp-confirm">Confirm new password</label>
              <input id="fp-confirm" type={show ? "text" : "password"} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required autoComplete="new-password" />
            </div>
            <button type="submit" className="register-submit" disabled={loading}>{loading ? "Resetting..." : "Reset password"}</button>
          </form>
        )}

        <div className="register-login">
          {step === 2 && (
            <>
              <button type="button" onClick={sendCode} disabled={cooldown > 0 || loading}
                style={{ background: "none", border: 0, color: "inherit", textDecoration: "underline", cursor: cooldown > 0 ? "default" : "pointer" }}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
              {" · "}
            </>
          )}
          <Link to="/login">Back to log in</Link>
        </div>
      </div>
    </div>
  );
}
