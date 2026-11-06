"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CheckIcon, ChevronIcon, CrossIcon } from "./icons";

// iOS-style building blocks: large titles, inset grouped sections, rows with colour icon squares,
// sheets with checkmark lists.

export function Page({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 pb-24 pt-24">
      <h1 className="text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 max-w-xl text-[15px] text-secondary">{subtitle}</p>}
      <div className="mt-6 flex flex-col gap-8">{children}</div>
    </main>
  );
}

export function Section({
  header,
  footer,
  action,
  children,
}: {
  header?: string;
  footer?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      {(header || action) && (
        <div className="mb-1.5 flex items-end justify-between px-4">
          <h2 className="text-[13px] uppercase tracking-wide text-secondary">{header}</h2>
          {action}
        </div>
      )}
      <div className="overflow-hidden rounded-xl bg-card [&>*+*]:border-t [&>*+*]:border-separator">{children}</div>
      {footer && <div className="mt-1.5 px-4 text-[13px] text-secondary">{footer}</div>}
    </section>
  );
}

const tones = {
  blue: "bg-[#007aff]",
  green: "bg-[#34c759]",
  orange: "bg-[#ff9500]",
  red: "bg-[#ff3b30]",
  purple: "bg-[#af52de]",
  indigo: "bg-[#5856d6]",
  teal: "bg-[#30b0c7]",
  gray: "bg-[#8e8e93]",
  yellow: "bg-[#ffcc00]",
} as const;
export type Tone = keyof typeof tones;

export function IconSquare({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`grid size-[30px] shrink-0 place-items-center rounded-[7px] text-white ${tones[tone]}`}>{children}</span>
  );
}

const gradeTones: Tone[] = ["green", "teal", "yellow", "orange", "red"];
export function Grade({ grade }: { grade: number }) {
  return (
    <IconSquare tone={gradeTones[grade - 1] ?? "gray"}>
      <span className="text-[14px] font-semibold">{"ABCDE"[grade - 1]}</span>
    </IconSquare>
  );
}

export function Row({
  icon,
  title,
  subtitle,
  detail,
  onClick,
  href,
  chevron,
  children,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  detail?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  chevron?: boolean;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex min-h-[44px] items-center gap-3 px-4 py-2.5">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] leading-snug">{title}</div>
          {subtitle && <div className="text-[13px] leading-snug text-secondary">{subtitle}</div>}
        </div>
        {detail && <div className="shrink-0 text-right text-[15px] text-secondary">{detail}</div>}
        {chevron && <ChevronIcon className="size-4 shrink-0 text-tertiary" />}
      </div>
      {children}
    </>
  );
  if (href?.startsWith("/")) {
    return (
      <Link href={href} className="block active:bg-fill">
        {body}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block active:bg-fill">
        {body}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left active:bg-fill">
        {body}
      </button>
    );
  }
  return <div>{body}</div>;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  loading,
  type = "button",
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "plain" | "destructive";
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  small?: boolean;
}) {
  const styles = {
    primary: "bg-tint text-white",
    secondary: "bg-fill text-tint",
    plain: "text-tint",
    destructive: "bg-fill text-[#ff3b30]",
  }[variant];
  const size = small ? "h-8 px-3.5 text-[15px] rounded-full" : "h-[50px] px-5 text-[17px] rounded-xl";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-opacity disabled:opacity-40 active:opacity-70 ${size} ${styles}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill">
      <div className="h-full rounded-full bg-tint transition-all" style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bg pb-8 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-bg/90 px-4 py-3 backdrop-blur">
          <span className="w-16" />
          <h3 className="text-[17px] font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="w-16 text-right text-[17px] text-tint">
            Done
          </button>
        </div>
        <div className="flex flex-col gap-6 px-4 pt-2">{children}</div>
      </div>
    </div>
  );
}

/** A list of choices with a checkmark on the selected one. */
export function Choices<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; detail?: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <>
      {options.map((o) => (
        <button key={String(o.value)} type="button" onClick={() => onChange(o.value)} className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill">
          <div className="min-w-0 flex-1">
            <div className="text-[17px]">{o.label}</div>
            {o.detail && <div className="text-[13px] text-secondary">{o.detail}</div>}
          </div>
          {value === o.value && <CheckIcon className="size-5 text-tint" />}
        </button>
      ))}
    </>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-[44px] items-center gap-3 px-4">
      <span className="w-28 shrink-0 text-[17px]">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = "min-w-0 flex-1 bg-transparent py-2.5 text-[17px] outline-none placeholder:text-tertiary";

export function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-white ${ok ? "bg-[#34c759]" : "bg-[#ff3b30]"}`}>
        {ok ? <CheckIcon className="size-3" /> : <CrossIcon className="size-3" />}
      </span>
      <div className="min-w-0">
        <div className="text-[15px]">{label}</div>
        {detail && <div className="text-[13px] text-secondary">{detail}</div>}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-center text-[15px] text-secondary">{children}</div>;
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="px-4 text-[13px] text-[#ff3b30]">{error}</p>;
}
