import React, { useEffect, useRef, useState } from "react";

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fades a block in when it first scrolls into view (desktop and mobile). */
export default function Reveal({ as: Tag = "div", className = "", children, delay = 0, ...props }) {
  const ref = useRef(null);
  const [on, setOn] = useState(() => reduced());

  useEffect(() => {
    if (on) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [on]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${on ? "is-in" : ""} ${className}`.trim()}
      style={{ "--reveal-delay": `${delay}ms` }}
      {...props}
    >
      {children}
    </Tag>
  );
}
