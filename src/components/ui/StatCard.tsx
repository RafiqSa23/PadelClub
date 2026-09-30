import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  accent?: "court" | "blue" | "amber" | "grey" | "red";
  onClick?: () => void;
}

const accents = {
  court: "text-primary-container bg-court-grass-light",
  blue: "text-confirmed bg-confirmed-light",
  amber: "text-pending-ink bg-pending-light",
  grey: "text-slate-whisper bg-closure-light",
  red: "text-error bg-error-container/40",
};

export function StatCard({ label, value, sub, icon, accent = "court", onClick }: StatCardProps) {
  const content = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-label-sm uppercase tracking-[0.08em] text-slate-whisper">
          {label}
        </span>
        <span className="mt-1.5 block text-headline-lg tabular-nums text-on-surface">{value}</span>
        {sub && <span className="mt-1 block text-body-sm text-slate-whisper">{sub}</span>}
      </span>
      <span
        className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", accents[accent])}
      >
        {icon}
      </span>
    </>
  );
  const className = cn(
    "flex w-full items-center justify-between gap-3 rounded-2xl bg-field-white p-5 text-left shadow-sm",
    onClick && "cursor-pointer transition-colors hover:bg-court-grass-light/40",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
