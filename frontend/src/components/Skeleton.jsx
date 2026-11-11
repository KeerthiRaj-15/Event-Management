import React from "react";

// Placeholder shown while a page loads. variant: "page" (title, stat tiles, rows) or "cards" (event grid).
export default function Skeleton({ variant = "page", rows = 4 }) {
  if (variant === "cards") {
    return (
      <div role="status" aria-label="Loading events">
        <div className="sk-line sk-title" />
        <div className="sk-line sk-sub" />
        <div className="sk-grid">{Array.from({ length: 6 }, (_, i) => <div className="sk-card" key={i} />)}</div>
      </div>
    );
  }
  return (
    <div role="status" aria-label="Loading">
      <div className="sk-line sk-title" />
      <div className="sk-line sk-sub" />
      <div className="sk-stats">{Array.from({ length: 4 }, (_, i) => <div className="sk-block" key={i} />)}</div>
      <div className="sk-panel">{Array.from({ length: rows }, (_, i) => <div className="sk-line sk-row" key={i} />)}</div>
    </div>
  );
}
