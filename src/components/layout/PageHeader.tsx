import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-field-white p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-court-grass-light px-3 py-1 text-label-sm text-court-green-deep">
            {eyebrow}
          </span>
        )}
        <h1 className="text-headline-lg text-on-surface sm:text-display-mobile">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-body-md leading-5 text-slate-whisper">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function SectionKicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-label-sm uppercase tracking-[0.16em] text-slate-whisper">{children}</p>
  );
}
