"use client";

import { cn } from "@/lib/cn";
import { MIcon } from "./MIcon";

interface ToastProps {
  open: boolean;
  message: string;
  onClose: () => void;
  tone?: "default" | "success" | "error";
}

const tones = {
  default: "bg-inverse-surface text-field-white",
  success: "bg-primary-container text-field-white",
  error: "bg-error-red text-white",
};

const icons = {
  default: "info",
  success: "check_circle",
  error: "error",
};

export function Toast({ open, message, onClose, tone = "default" }: ToastProps) {
  if (!open) return null;

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-6 right-6 z-[60] flex max-w-sm items-start gap-3 rounded-xl px-4 py-3 shadow-float",
        tones[tone],
      )}
    >
      <MIcon name={icons[tone]} className="mt-0.5 text-[18px]" />
      <p className="flex-1 text-body-md">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="cursor-pointer opacity-70 transition-opacity hover:opacity-100"
        aria-label="Tutup notifikasi"
      >
        <MIcon name="close" className="text-[18px]" />
      </button>
    </div>
  );
}
