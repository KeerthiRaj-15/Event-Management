import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { login } from "../../api";
import { useAuth } from "../../auth/AuthContext.jsx";
import "./Registration.css";
import AuthStage from "../../components/AuthStage.jsx";

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      signIn(data);
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (err) {
      if (err.code === "NOT_VERIFIED") {
        return navigate("/verify-otp", { state: { email: form.email.trim().toLowerCase(), devOtp: err.devOtp } });
      }
      setError(err.message || "Unable to connect to the server.");
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
          <p>Bring people together.</p>
        </div>
        <div className="register-heading">
          <h2>Welcome back</h2>
          <p>Log in to manage and book events.</p>
        </div>

        {location.state?.message && <div className="register-ok">{location.state.message}</div>}
        {error && <div className="register-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="register-field">
            <label htmlFor="email">Email Address</label>
            <input id="email" type="email" name="email" value={form.email} onChange={handleChange}
              placeholder="example@email.com" required autoComplete="email" />
          </div>
          <div className="register-field">
            <label htmlFor="password">Password</label>
            <div className="register-password">
              <input id="password" type={showPassword ? "text" : "password"} name="password"
                value={form.password} onChange={handleChange} placeholder="Your password"
                required autoComplete="current-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div style={{ textAlign: "right", margin: "-4px 0 12px" }}><Link to="/forgot-password">Forgot password?</Link></div>
          <button type="submit" className="register-submit" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <div className="register-login">
          New to Gather? <Link to="/register">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
