import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div style={{ padding: 60, textAlign: "center", fontFamily: "DM Sans, sans-serif" }}>
      <h1 style={{ fontSize: 56, margin: 0 }}>404</h1>
      <h2>We could not find that page</h2>
      <p style={{ color: "#6b708a" }}>The link may be wrong or the page may have moved.</p>
      <Link to={user ? "/dashboard" : "/login"}>{user ? "Back to dashboard" : "Go to log in"}</Link>
    </div>
  );
}
