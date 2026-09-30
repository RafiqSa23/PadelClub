import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<Option<T>>;
  ariaLabel: string;
  variant?: "light" | "solid";
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  variant = "light",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex flex-wrap items-center gap-1 rounded-xl bg-mist-shadow p-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-label-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-container",
              active
                ? variant === "solid"
                  ? "bg-primary-container text-field-white shadow-sm"
                  : "bg-field-white text-primary-container shadow-sm"
                : "text-slate-whisper hover:text-on-surface",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
