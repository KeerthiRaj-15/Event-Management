export const CATEGORIES = ["Conference", "Workshop", "Entertainment", "Networking", "Sports"];

export const money = (n) => (Number(n) === 0 ? "Free" : "\u20B9" + Number(n).toLocaleString("en-IN"));

// Plain rupees (₹0 stays ₹0). Use for revenue totals; money() shows "Free" for ticket prices.
export const inr = (n) => "\u20B9" + Number(n || 0).toLocaleString("en-IN");

export const fmtDate = (d) =>
  new Date(d + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export const canManage = (user, event) =>
  user.role === "Admin" || (user.role === "Organizer" && event.organizerEmail === user.email);

export const isStaff = (user) => user.role === "Admin" || user.role === "Organizer";

export const seatsLeft = (e) => Math.max(0, e.capacity - e.booked);

export const initials = (name = "") =>
  name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

// Download rows (array of arrays) as a CSV file.
export function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const eventChip = (status) => (status === "Published" ? "ok" : status === "Cancelled" ? "bad" : "warn");
export const bookingChip = (status) =>
  ({ CONFIRMED: ["ok", "Confirmed"], PENDING_PAYMENT: ["warn", "Pending payment"], CANCELLED: ["bad", "Cancelled"] }[status] || ["mute", status]);
