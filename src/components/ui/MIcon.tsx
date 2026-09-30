import { cn } from "@/lib/cn";

/**
 * Ikon Material Symbols (dimuat via Google Fonts di root layout).
 * Karena berbasis font, selalu beri `aria-label` pada tombol yang hanya berisi ikon.
 */
export function MIcon({
  name,
  className,
  fill = false,
}: {
  name: string;
  className?: string;
  fill?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("material-symbols-outlined select-none", className)}
      style={
        fill
          ? { fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24' }
          : undefined
      }
    >
      {name}
    </span>
  );
}
