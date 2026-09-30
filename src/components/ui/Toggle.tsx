"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  className?: string;
}

export function Toggle({ checked, onChange, label, description, className }: ToggleProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-4 text-left",
        className,
      )}
    >
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-label-md text-on-surface">{label}</span>}
          {description && (
            <span className="mt-0.5 block text-body-sm text-slate-whisper">{description}</span>
          )}
        </span>
      )}
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-closure-grey/40 transition-colors peer-checked:bg-primary-container peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-container after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-field-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:after:translate-x-5" />
    </label>
  );
}
