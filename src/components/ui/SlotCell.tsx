import { cn } from "@/lib/cn";
import type { Slot, SlotStatus } from "@/lib/types";
import { MIcon } from "./MIcon";

const statusStyles: Record<
  SlotStatus,
  { cell: string; selected?: string; icon?: string }
> = {
  kosong: {
    cell: "bg-court-grass-light text-court-green-deep hover:bg-court-grass-light/70 hover:ring-2 hover:ring-primary-container/40",
    selected: "bg-primary-container text-field-white ring-2 ring-primary-container",
    icon: "add_circle",
  },
  terkonfirmasi: {
    cell: "bg-confirmed-blue text-field-white",
    icon: "lock",
  },
  menunggu_pembayaran: {
    cell: "bg-pending-amber text-[#3d2b00] animate-pulse",
    icon: "schedule",
  },
  tutup: {
    cell: "bg-closure-grey/25 text-slate-whisper",
    icon: "build",
  },
};

const statusLabels: Record<SlotStatus, string> = {
  kosong: "kosong",
  terkonfirmasi: "terkonfirmasi",
  menunggu_pembayaran: "menunggu bayar",
  tutup: "maintenance",
};

const shortLabels: Record<SlotStatus, string> = {
  kosong: "Kosong",
  terkonfirmasi: "Terkonfirmasi",
  menunggu_pembayaran: "Menunggu",
  tutup: "Maintenance",
};

interface SlotCellProps {
  slot: Slot;
  selected?: boolean;
  /** Baris kedua chip (mis. harga atau durasi). */
  hint?: string;
  onSelect?: (slot: Slot) => void;
}

export function SlotCell({ slot, selected, hint, onSelect }: SlotCellProps) {
  const canSelect = slot.status === "kosong" && !!onSelect;
  const clickable = canSelect || (!!onSelect && !!selected);
  const style = statusStyles[slot.status];

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => canSelect && onSelect?.(slot)}
      aria-pressed={selected}
      aria-label={`${String(slot.hour).padStart(2, "0")}:00, ${statusLabels[slot.status]}`}
      className={cn(
        "flex min-h-11 w-full flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-court",
        style.cell,
        selected && style.selected,
        clickable ? "cursor-pointer" : "cursor-not-allowed",
      )}
    >
      <span className="flex w-full items-center justify-between gap-1">
        <span className="text-data-tabular tabular-nums">
          {String(slot.hour).padStart(2, "0")}:00
        </span>
        {style.icon && <MIcon name={style.icon} className="text-[14px]" />}
      </span>
      <span className="text-label-sm opacity-90">{hint ?? shortLabels[slot.status]}</span>
    </button>
  );
}
