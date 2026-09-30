import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconAlert } from "./icons";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mist text-slate-whisper">
        <IconAlert size={22} />
      </span>
      <h3 className="text-sm font-bold text-night">{title}</h3>
      {description && <p className="max-w-sm text-sm text-slate-whisper">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
