
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../../api";
import { validateProfile, validatePasswordChange } from "../../validation.js";
import "./Registration.css";
import AuthStage from "../../components/AuthStage.jsx";

export default function Registration() {
  const navigate = useNavigate();
  const cardRef = useRef(null);

  useEffect(() => {
    const card = cardRef.current;
    const gsap = window.gsap;
    if (!card || !gsap || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    card.classList.add("gsap-auth-ready");
    const page = card.closest(".register-page");
    const context = gsap.context(() => {
      gsap.set(card, { transformPerspective: 1100, transformOrigin: "50% 45%" });
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      timeline.fromTo(card,
        { autoAlpha: 0, y: 42, rotateY: -9, rotateX: 4, scale: 0.97 },
        { autoAlpha: 1, y: 0, rotateY: 0, rotateX: 0, scale: 1, duration: 0.72 }
      );
      timeline.fromTo(
        card.querySelectorAll(".register-heading, .register-field, .register-terms, .register-submit, .register-login"),
        { autoAlpha: 0, y: 18, rotateX: -5 },
        { autoAlpha: 1, y: 0, rotateX: 0, duration: 0.42, stagger: 0.065 },
        "-=0.32"
      );
      gsap.fromTo(".auth-copy > *",
        { autoAlpha: 0, x: -24 },
        { autoAlpha: 1, x: 0, duration: 0.65, stagger: 0.12, ease: "power3.out", delay: 0.12 }
      );
      gsap.fromTo(".auth-ticket",
        { autoAlpha: 0, y: 38, rotateZ: -8, rotateY: 18 },
        { autoAlpha: 1, y: 0, rotateZ: -2, rotateY: 0, duration: 0.8, ease: "back.out(1.35)", delay: 0.25 }
      );
    }, page);

    const onPointerMove = (event) => {
      if (window.matchMedia?.("(hover: none)").matches) return;
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      gsap.to(card, { rotateY: px * 3.8, rotateX: py * -3.2, duration: 0.35, ease: "power2.out", overwrite: true });
    };
    const onPointerLeave = () => gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.55, ease: "elastic.out(1, 0.55)" });
    card.addEventListener("pointermove", onPointerMove, { passive: true });
    card.addEventListener("pointerleave", onPointerLeave);

    return () => {
      card.removeEventListener("pointermove", onPointerMove);
      card.removeEventListener("pointerleave", onPointerLeave);
      context.revert();
      card.classList.remove("gsap-auth-ready");
    };
  }, []);

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
      <div className="register-card" ref={cardRef}>

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
