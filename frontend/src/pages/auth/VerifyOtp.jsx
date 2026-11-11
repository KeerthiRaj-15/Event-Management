import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { verifyOtp, resendOtp } from "../../api";
import "./Registration.css";
import AuthStage from "../../components/AuthStage.jsx";

export default function VerifyOtp() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const email = state?.email;
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState(state?.devOtp || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(30);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!email) return <Navigate to="/register" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code.");
    setLoading(true);
    try {
      await verifyOtp(email, otp);
      navigate("/login", { replace: true, state: { message: "Email verified. You can log in now." } });
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      const r = await resendOtp(email);
      if (r?.devOtp) setDevOtp(r.devOtp);
      setCooldown(30);
    } catch (err) {
      setError(err.message || "Could not resend the code.");
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
          <h2>Verify your email</h2>
          <p>We sent a 6-digit code to {email}.</p>
        </div>

        {devOtp && <div className="register-ok">Demo mode: no email is sent. Your code is <strong>{devOtp}</strong>.</div>}
        {error && <div className="register-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="register-field">
            <label htmlFor="otp">Verification code</label>
            <input id="otp" inputMode="numeric" maxLength={6} value={otp} autoComplete="one-time-code"
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" required />
          </div>
          <button type="submit" className="register-submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>

        <div className="register-login">
          Did not get a code?{" "}
          <button type="button" onClick={handleResend} disabled={cooldown > 0}
            style={{ background: "none", border: 0, color: "inherit", textDecoration: "underline", cursor: cooldown > 0 ? "default" : "pointer" }}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </div>
    </div>
  );
}
