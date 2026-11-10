import React, { useEffect, useRef, useState } from "react";

// Camera QR scanner built on the browser's BarcodeDetector API (Chrome / Edge / Android Chrome / Samsung Internet).
// No extra npm package is needed. Where the API or a camera is missing, the parent keeps the type-the-code box.
// Needs HTTPS (or localhost) because browsers only allow camera access on secure origins.
//
//   <QrScanner onDetect={(text) => ...} />   onDetect may return a promise; scanning pauses until it settles.

export const scannerSupported = () =>
  typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

// A QR that stays in front of the camera counts as ONE scan. It can be submitted again only after it has been
// out of view for this long (so holding a ticket steady never flips "accepted" into "already used").
const GONE_AFTER_MS = 1500;
const SCAN_EVERY_MS = 250;

export default function QrScanner({ onDetect, onClose }) {
  const video = useRef(null);
  const handler = useRef(onDetect);
  handler.current = onDetect;
  const [status, setStatus] = useState("starting"); // starting | live | error
  const [error, setError] = useState("");

  useEffect(() => {
    let stream, timer, stopped = false, busy = false;
    let last = { text: "", seen: 0 };

    (async () => {
      try {
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const el = video.current;
        el.srcObject = stream;
        await el.play();
        setStatus("live");

        timer = setInterval(async () => {
          if (busy || el.readyState < 2) return;
          busy = true;
          try {
            const found = await detector.detect(el);
            const text = found[0]?.rawValue?.trim();
            const now = Date.now();
            if (text) {
              const stillInView = text === last.text && now - last.seen < GONE_AFTER_MS;
              last = { text, seen: now };
              if (!stillInView) {
                await handler.current(text);
                last.seen = Date.now();
              }
            }
          } catch { /* a bad frame is not fatal; try again on the next tick */ }
          busy = false;
        }, SCAN_EVERY_MS);
      } catch (e) {
        if (stopped) return;
        setStatus("error");
        setError(
          e?.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access in the browser, or type the ticket code instead."
          : e?.name === "NotFoundError" ? "No camera was found on this device. Type the ticket code instead."
          : "The camera could not be started. Type the ticket code instead."
        );
      }
    })();

    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop()); // switch the camera light off
    };
  }, []);

  return (
    <div className="qr-scanner">
      {status === "error" ? (
        <p className="ev-error" role="alert">{error}</p>
      ) : (
        <div className="qr-frame">
          <video ref={video} muted playsInline aria-label="Camera preview for scanning ticket QR codes" />
          <span className="qr-aim" aria-hidden="true" />
          {status === "starting" && <p className="qr-note">Starting camera...</p>}
        </div>
      )}
      <button className="ev-btn ghost" type="button" onClick={onClose}>Stop camera</button>
    </div>
  );
}
