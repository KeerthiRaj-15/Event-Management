import React, { useEffect, useState } from "react";

const NUM = /\d[\d,]*(?:\.\d+)?/;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Animates the first number inside a formatted string ("₹1,20,000", "82%", "14"). Keeps prefix/suffix as-is.
export default function CountUp({ children, duration = 800 }) {
  const text = React.Children.toArray(children).join("");
  const m = text.match(NUM);
  const target = m ? parseFloat(m[0].replace(/,/g, "")) : 0;
  const decimals = m && m[0].includes(".") ? m[0].split(".")[1].length : 0;
  const animate = !!m && target > 0 && !reduced();
  const fmt = (n) => n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const [shown, setShown] = useState(animate ? fmt(0) : null);

  useEffect(() => {
    if (!animate) { setShown(null); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(fmt(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick); else setShown(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  if (!m || shown === null) return <>{text}</>;
  return <>{text.slice(0, m.index)}{shown}{text.slice(m.index + m[0].length)}</>;
}
