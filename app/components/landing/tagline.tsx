"use client";

import { useEffect, useRef } from "react";

/**
 * A large statement whose words light up in reading order as each line crosses a trigger line
 * just above the middle of the screen.
 */
export function Tagline({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const words = ref.current?.querySelectorAll<HTMLElement>("[data-word]");
    if (!words?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.on = "true";
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -45% 0px", threshold: 1 },
    );
    words.forEach((w) => io.observe(w));
    return () => io.disconnect();
  }, []);

  return (
    <p ref={ref} className="mx-auto max-w-[680px] text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
      {lines.map((line, l) => (
        <span key={l} className="block">
          {line.split(" ").map((word, i) => (
            <span
              key={i}
              data-word
              style={{ transitionDelay: `${i * 60}ms` }}
              className="text-label opacity-30 transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] data-[on=true]:opacity-100 motion-reduce:opacity-100"
            >
              {word}{" "}
            </span>
          ))}
        </span>
      ))}
    </p>
  );
}
