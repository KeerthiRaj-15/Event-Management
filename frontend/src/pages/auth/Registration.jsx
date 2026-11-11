
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../../api";
import { validateProfile, validatePasswordChange } from "../../validation.js";
import "./Registration.css";
import AuthStage from "../../components/AuthStage.jsx";

export default function Registration() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "Attendee",
    terms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const prof = validateProfile({ name: form.name, phone: form.phone });
    if (prof.name || prof.phone) return setError(prof.name || prof.phone);

    const pwErr = validatePasswordChange({ current: "x", next: form.password, confirm: form.password });
    if (pwErr.next) return setError(pwErr.next);

    if (form.password !== form.confirmPassword) {
      return setError("Passwords do not match.");
    }

    if (!form.terms) {
      return setError("Please accept the terms and conditions.");
    }

    setLoading(true);

    try {
      const result = await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: form.role,
      });

      navigate("/verify-otp", {
        state: { email: form.email.trim().toLowerCase(), devOtp: result.devOtp },
      });
    } catch (err) {
      setError(
        err.message || "Unable to connect to the server."
      );
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
          <h2>Create your account</h2>
          <p>Join Gather and start exploring events.</p>
        </div>

        {error && (
          <div className="register-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          <div className="register-field">
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              placeholder="Enter your full name"
              value={form.name}
              onChange={handleChange}
              required
              autoComplete="name"
            />
          </div>

          <div className="register-field">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="example@email.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="register-field">
            <label>Phone Number</label>
            <input
              type="tel"
              name="phone"
              placeholder="Enter phone number"
              value={form.phone}
              onChange={handleChange}
              required
              autoComplete="tel"
            />
          </div>

          <div className="register-field">
            <label>Account Type</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
            >
              <option value="Attendee">Attendee</option>
              <option value="Organizer">Organizer</option>
            </select>
          </div>

          <div className="register-field">
            <label>Password</label>
            <div className="register-password">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="register-field">
            <label>Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm your password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>

          <label className="register-terms">
            <input
              type="checkbox"
              name="terms"
              checked={form.terms}
              onChange={handleChange}
            />
            <span>
              I agree to the Terms and Conditions and Privacy Policy.
            </span>
          </label>

          <button
            type="submit"
            className="register-submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

        </form>

        <div className="register-login">
          Already have an account?
          {" "}
          <Link to="/login">Login</Link>
        </div>

      </div>
    </div>
  );
}
