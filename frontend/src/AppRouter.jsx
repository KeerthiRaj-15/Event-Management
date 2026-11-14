import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import Registration from "./pages/auth/Registration.jsx";
import Login from "./pages/auth/Login.jsx";
import VerifyOtp from "./pages/auth/VerifyOtp.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import NotFound from "./pages/NotFound.jsx";
import Dashboard from "./pages/dashboard/Dashboard.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import Reports from "./pages/reports/Reports.jsx";
import CheckIn from "./pages/checkin/CheckIn.jsx";
import Discover from "./pages/discover/Discover.jsx";
import Profile from "./pages/profile/Profile.jsx";
import EventList from "./pages/events/EventList.jsx";
import EventDetails from "./pages/events/EventDetails.jsx";
import EventForm from "./pages/events/EventForm.jsx";
import EventManage from "./pages/events/EventManage.jsx";
import MyEvents from "./pages/events/MyEvents.jsx";
import Checkout from "./pages/events/Checkout.jsx";
import MyTickets from "./pages/events/MyTickets.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import LandingPage from "./pages/LandingPage.jsx";

const STAFF = ["Organizer", "Admin"];

function Unauthorized() {
  return (
    <div className="state-page">
      <span className="state-code" aria-hidden="true">403</span>
      <h1>Access denied</h1>
      <p>Your account does not have permission to view this page.</p>
      <Link className="ev-btn" to="/dashboard">Back to dashboard</Link>
    </div>
  );
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<Registration />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute roles={["Admin"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

      <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><EventList /></ProtectedRoute>} />
      <Route path="/events/new" element={<ProtectedRoute roles={STAFF}><EventForm /></ProtectedRoute>} />
      <Route path="/events/:id" element={<ProtectedRoute><EventDetails /></ProtectedRoute>} />
      <Route path="/events/:id/edit" element={<ProtectedRoute roles={STAFF}><EventForm /></ProtectedRoute>} />
      <Route path="/events/:id/manage" element={<ProtectedRoute roles={STAFF}><EventManage /></ProtectedRoute>} />
      <Route path="/my-events" element={<ProtectedRoute roles={STAFF}><MyEvents /></ProtectedRoute>} />

      <Route path="/checkout/:bookingId" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute><MyTickets /></ProtectedRoute>} />
      <Route path="/checkin" element={<ProtectedRoute roles={STAFF}><CheckIn /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute roles={STAFF}><Reports /></ProtectedRoute>} />

      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
