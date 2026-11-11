import React from "react";

// 9x9 pseudo-QR: three solid corner squares plus a fixed scatter, so it renders the same every time.
const CELLS = (() => {
  const cells = [];
  let s = 7;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      s = (s * 37 + 11) % 101;
      const finder = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
      cells.push(finder || s % 3 !== 0);
    }
  }
  return cells;
})();

// Decorative panel shown beside the auth forms. The ticket prints once, then gets "scanned" in a loop.
export default function AuthStage() {
  return (
    <aside className="auth-stage" aria-hidden="true">
      <div className="auth-marquee">
        {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--n": i }} />)}
      </div>

      <div className="auth-copy">
        <p className="auth-brand"><span className="auth-mark">G</span>gather.</p>
        <h2>Plan it. Sell it. Scan them in.</h2>
        <p>Create events, take bookings and check guests in at the gate with a QR code.</p>
      </div>

      <div className="auth-ticket-slot">
        <div className="auth-ticket">
          <div className="auth-ticket-main">
            <small>Admit one</small>
            <strong>Product Summit 2026</strong>
            <span>Sat, 14 Dec at 6:30 PM</span>
            <span>Main hall</span>
          </div>
          <div className="auth-ticket-stub">
            <div className="auth-qr">
              {CELLS.map((on, i) => <b key={i} className={on ? "on" : ""} />)}
              <span className="auth-scan" />
            </div>
            <em className="auth-ok">Checked in</em>
          </div>
        </div>
      </div>
    </aside>
  );
}
