import { STATUS_DOT, STATUS_LABEL, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

/**
 * Monochrome status pill: zinc border, zinc surface, zinc text. The only colour
 * in the whole component is a 6px dot, which is what makes statuses scannable
 * without breaking the dark, single-hue aesthetic.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[11px] font-medium leading-none tracking-wide text-zinc-300",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[status])}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}
