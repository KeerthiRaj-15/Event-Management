import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, Ticket, Plus, Search, QrCode, BarChart3,
  ShieldCheck, UserCircle, LogOut, Menu, CalendarCheck, Moon, Sun, Globe,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import { initials } from "../pages/events/helpers.js";
import "../pages/events/events.css";
import "./workspace.css";
import EventAssistant from "./EventAssistant.jsx";

// Sidebar items per role. Pages stay reachable only if ProtectedRoute in AppRouter allows the role too.
function navFor(role) {
  const profile = { to: "/profile", label: "My profile", icon: UserCircle };
  const browse = { to: "/events", label: "Browse events", icon: Search, end: true };
  const tickets = { to: "/tickets", label: "My tickets", icon: Ticket };
  const discover = { to: "/discover", label: "Discover online", icon: Globe };
  if (role === "Admin")
    return [
      { to: "/admin", label: "Admin dashboard", icon: ShieldCheck },
      { to: "/my-events", label: "Manage events", icon: CalendarDays },
      browse, discover, tickets,
      { to: "/checkin", label: "QR check-in", icon: QrCode },
      { to: "/reports", label: "Reports", icon: BarChart3 },
      profile,
    ];
  if (role === "Organizer")
    return [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/my-events", label: "My events", icon: CalendarDays },
      { to: "/events/new", label: "Create event", icon: Plus },
      browse, discover, tickets,
      { to: "/checkin", label: "QR check-in", icon: QrCode },
      { to: "/reports", label: "Reports", icon: BarChart3 },
      profile,
    ];
  return [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, browse, discover, tickets, profile];
}

const CRUMBS = [
  [/^\/dashboard/, "Dashboard"], [/^\/admin/, "Admin dashboard"], [/^\/my-events/, "My events"],
  [/^\/events\/new/, "Create event"], [/^\/events\/[^/]+\/edit/, "Edit event"],
  [/^\/events\/[^/]+\/manage/, "Event workspace"], [/^\/events\/[^/]+/, "Event details"], [/^\/events/, "Browse events"],
  [/^\/discover/, "Discover online"], [/^\/checkout/, "Checkout"], [/^\/tickets/, "My tickets"], [/^\/checkin/, "QR check-in"],
  [/^\/reports/, "Reports"], [/^\/profile/, "My profile"],
];

export default function PageLayout({ children }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Go to /login first so the next person to sign in is not sent back to this (possibly forbidden) page.
  const signOut = () => { navigate("/login", { replace: true }); logout(); };
  const [open, setOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("gather.theme") === "dark");
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("gather.theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  useEffect(() => setOpen(false), [pathname]);
  const crumb = (CRUMBS.find(([re]) => re.test(pathname)) || [null, "Gather"])[1];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark"><CalendarCheck size={19} /></span>
          <span>gather<span className="brand-dot">.</span></span>
        </div>

        <nav aria-label="Main" className="ws-nav">
          {navFor(user.role).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <Link to="/profile" className="profile-avatar" aria-label="My profile">{initials(user.name)}</Link>
            <div className="ws-who">
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
            <button className="logout-btn" onClick={signOut} title="Log out" aria-label="Log out"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      {open && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{crumb}</strong></div>
          <div className="top-actions">
            <button type="button" className="theme-toggle" onClick={() => setDarkMode((value) => !value)}
              aria-label={darkMode ? "Switch to light mode" : "Switch to night mode"}
              title={darkMode ? "Switch to light mode" : "Switch to night mode"}>
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              <span>{darkMode ? "Light mode" : "Night mode"}</span>
            </button>
            <Link to="/profile" className="top-avatar" aria-label="My profile">{initials(user.name)}</Link>
          </div>
        </header>
        <div className="content">
          <div key={pathname} className="ev-main ws-body page-in">{children}</div>
        </div>
      </main>
      <EventAssistant />
    </div>
  );
}
