import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { MIcon } from "@/components/ui/MIcon";
import type { SlotStatus } from "@/lib/types";

const ITEMS: Array<{ status?: SlotStatus; label: string; dot: string; icon?: string }> = [
  { status: "kosong", label: "Tersedia (Book Sekarang)", dot: "bg-court-grass-light ring-1 ring-primary-container/40" },
  { label: "Terpilih", dot: "bg-primary-container", icon: "check" },
  { status: "menunggu_pembayaran", label: "Menunggu Bayar (15 mnt)", dot: "bg-pending-amber", icon: "schedule" },
  { status: "terkonfirmasi", label: "Terkonfirmasi (Booked)", dot: "bg-confirmed-blue", icon: "lock" },
  { status: "tutup", label: "Maintenance / Tutup", dot: "bg-closure-grey", icon: "close" },
];

export function StatusLegend({
  compact = false,
  showDuration = false,
}: {
  compact?: boolean;
  showDuration?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex flex-wrap items-center gap-x-4 gap-y-2"
          : "flex flex-wrap items-center gap-x-6 gap-y-3"
      }
      aria-label="Keterangan status slot"
    >
      {ITEMS.map((item) => (
        <span key={item.label} className="flex items-center gap-2 text-label-sm text-on-surface">
          <span className={`flex h-3.5 w-3.5 items-center justify-center rounded ${item.dot} ring-offset-1`}>
            {item.icon && (
              <MIcon name={item.icon} className="text-[10px] text-field-white" />
            )}
          </span>
          {item.label}
        </span>
      ))}
      {showDuration && (
        <span className="flex items-center gap-2 text-label-sm text-on-surface">
          <MIcon name="bolt" className="text-[15px] text-pending-amber" />
          Durasi 60 Menit / Sesi
        </span>
      )}
    </div>
  );
}

export function SlotStatusInfo() {
  return <StatusLegend />;
}

export function CourtTag({ children }: { children: ReactNode }) {
  return <Badge tone="blue">{children}</Badge>;
}
