import type { Entity } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";

const TABS: { key: Entity; label: string }[] = [
  { key: "owner", label: "Apartments" },
  { key: "client", label: "Clients" },
];

interface EntityToggleProps {
  value: Entity;
  counts: Record<Entity, number>;
  onChange: (next: Entity) => void;
  className?: string;
}

/**
 * Segmented control used to switch the entry mode (and, below `lg`, which list
 * is visible). Two equal grid columns let the sliding pill be positioned with
 * pure CSS — `translate-x-full` lands exactly on the second tab.
 */
export function EntityToggle({
  value,
  counts,
  onChange,
  className,
}: EntityToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Entry type"
      className={cn(
        "relative grid w-full grid-cols-2 rounded-lg border border-zinc-800 bg-zinc-950 p-1 sm:w-72",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-md bg-white",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          value === "client" && "translate-x-full",
        )}
      />

      {TABS.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
              active
                ? "text-zinc-950"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums",
                active ? "text-zinc-500" : "text-zinc-700",
              )}
            >
              {formatCount(counts[tab.key])}
            </span>
          </button>
        );
      })}
    </div>
  );
}
