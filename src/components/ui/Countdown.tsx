"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function useCountdown(startSeconds: number) {
  const [remaining, setRemaining] = useState(startSeconds);
  useEffect(() => {
    if (startSeconds <= 0) return;
    const t = setInterval(() => setRemaining((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [startSeconds]);
  return remaining;
}

export function Countdown({
  seconds,
  className,
}: {
  seconds: number;
  className?: string;
}) {
  const s = useCountdown(seconds);
  const m = Math.floor(s / 60);
  const rest = s % 60;
  const urgent = s < 60;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg bg-pending-light px-2.5 py-1 font-mono text-sm font-bold tabular-nums",
        urgent ? "text-danger" : "text-pending-ink",
        className,
      )}
      aria-live="off"
    >
      {String(m).padStart(2, "0")}:{String(rest).padStart(2, "0")}
    </span>
  );
}