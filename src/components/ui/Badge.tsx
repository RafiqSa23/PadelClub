import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "green" | "blue" | "amber" | "grey" | "red" | "neutral";

const tones: Record<Tone, string> = {
  green: "bg-court-light text-court-deep",
  blue: "bg-confirmed-light text-confirmed",
  amber: "bg-pending-light text-pending-ink",
  grey: "bg-closure-light text-slate-whisper",
  red: "bg-danger-light text-danger",
  neutral: "bg-mist text-slate-whisper",
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm", tones[tone], className)}>
      {children}
    </span>
  );
}

const statusToTone: Record<string, Tone> = {
  kosong: "green",
  terkonfirmasi: "blue",
  menunggu_pembayaran: "amber",
  dibatalkan: "red",
  tutup: "grey",
  pending: "amber",
  paid: "green",
  failed: "red",
  expired: "grey",
  tunai: "green",
};

export function StatusBadge({ status, children }: { status: string; children: ReactNode }) {
  return <Badge tone={statusToTone[status] ?? "neutral"}>{children}</Badge>;
}
