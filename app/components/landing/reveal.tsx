"use client";

import { useEffect, useRef } from "react";

/** Fades content up out of a blur the first time it scrolls into view. */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.shown = "true";
        io.disconnect();
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`translate-y-16 opacity-0 blur-md transition-all duration-1000 ease-[cubic-bezier(0.32,0.72,0,1)] data-[shown=true]:translate-y-0 data-[shown=true]:opacity-100 data-[shown=true]:blur-none motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-none motion-reduce:transition-none ${className}`}
    >
      {children}
    </div>
  );
}
