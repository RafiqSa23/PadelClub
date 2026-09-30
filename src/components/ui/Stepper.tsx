import { cn } from "@/lib/cn";
import type { WizardStep } from "@/lib/types";
import { IconCheck } from "./icons";

const STEP_ORDER: WizardStep[] = ["tanggal", "slot", "review", "identitas", "pembayaran", "selesai"];

const STEP_LABEL: Record<WizardStep, string> = {
  tanggal: "Tanggal",
  slot: "Jam",
  review: "Review",
  identitas: "Identitas",
  pembayaran: "Bayar",
  selesai: "Selesai",
};

export function bookingStepIndex(step: WizardStep): number {
  return STEP_ORDER.indexOf(step);
}

export function Stepper({ current }: { current: WizardStep }) {
  const idx = bookingStepIndex(current);
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-label-sm uppercase tracking-[0.12em] text-slate-whisper">
        Langkah {Math.max(idx + 1, 1)} dari {STEP_ORDER.length} · {STEP_LABEL[current]}
      </p>
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Progres wizard booking">
        {STEP_ORDER.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={s} className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label-sm transition-colors",
                  done && "bg-primary-container text-field-white",
                  active && "bg-court-grass-light text-court-green-deep ring-2 ring-primary-container",
                  !done && !active && "bg-mist-shadow text-slate-whisper",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <IconCheck size={14} /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden truncate text-label-md sm:block",
                  active ? "text-court-green-deep" : done ? "text-on-surface" : "text-slate-whisper",
                )}
              >
                {STEP_LABEL[s]}
              </span>
              {i < STEP_ORDER.length - 1 && (
                <span
                  className={cn(
                    "h-0.5 min-w-3 flex-1 rounded-full transition-colors",
                    i < idx ? "bg-primary-container" : "bg-line",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
