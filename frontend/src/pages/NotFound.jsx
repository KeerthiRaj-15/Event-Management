import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="state-page">
      <span className="state-code" aria-hidden="true">404</span>
      <h1>We could not find that page</h1>
      <p>The link may be wrong or the page may have moved.</p>
      <Link className="ev-btn" to={user ? "/dashboard" : "/login"}>{user ? "Back to dashboard" : "Go to log in"}</Link>
    </div>
  );
}
