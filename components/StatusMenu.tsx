import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { STATUS_DOT, STATUS_LABEL, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusMenuProps {
  status: Status;
  options: readonly Status[];
  onChange: (next: Status) => void;
  className?: string;
}

/**
 * Inline status changer. Trigger reads as a `StatusBadge`; opening it swaps in
 * a listbox with arrow-key roving focus, Escape to cancel, and outside-click to
 * dismiss — so changing a tag never needs a mouse.
 */
export function StatusMenu({
  status,
  options,
  onChange,
  className,
}: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.indexOf(status)),
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !listRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const items = listRef.current?.querySelectorAll("button");
    items?.[activeIndex]?.focus();
  }, [open, activeIndex]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(
        (current) => (current + delta + options.length) % options.length,
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    }
  };

  return (
    <div className={cn("relative inline-block text-left", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Status: ${STATUS_LABEL[status]}. Change status`}
        onClick={() => {
          setActiveIndex(Math.max(0, options.indexOf(status)));
          setOpen((value) => !value);
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-full transition-opacity",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
          open ? "opacity-100" : "hover:opacity-80",
        )}
      >
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[11px] font-medium leading-none tracking-wide text-zinc-300">
          <span
            aria-hidden="true"
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[status])}
          />
          {STATUS_LABEL[status]}
          <ChevronDown className="h-3 w-3 text-zinc-600" />
        </span>
      </button>

      {open ? (
        <div
          ref={listRef}
          role="listbox"
          aria-label="Status options"
          onKeyDown={onKeyDown}
          className="animate-fade-scale absolute right-0 top-[calc(100%+0.375rem)] z-30 w-40 rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl shadow-black/50"
        >
          {options.map((option) => {
            const selected = option === status;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option);
                  close(true);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
                  selected
                    ? "bg-zinc-800/70 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[option])}
                />
                <span className="flex-1">{STATUS_LABEL[option]}</span>
                {selected ? (
                  <Check className="h-3 w-3 shrink-0 text-zinc-300" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
