import { cn } from "@/lib/cn";
import { MIcon } from "@/components/ui/MIcon";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-court text-white shadow-[0_4px_10px_rgba(46,125,50,0.25)]",
        className,
      )}
    >
      <MIcon name="sports_tennis" className="text-[19px]" fill />
    </span>
  );
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark className={light ? "bg-primary-fixed-dim text-primary" : undefined} />
      <span
        className={cn(
          "font-display text-headline-sm tracking-[-0.03em]",
          light ? "text-white" : "text-court-green-deep",
        )}
      >
        Padel<span className={light ? "text-white/75" : "text-on-surface"}>Club</span>
      </span>
    </span>
  );
}
