import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Focus-trapped confirmation modal. Escape cancels, the backdrop cancels, and
 * Tab cycles between the two actions. Focus lands on Cancel so a stray Enter
 * cannot destroy data.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab") return;

      const buttons = panelRef.current?.querySelectorAll("button");
      if (!buttons || buttons.length === 0) return;

      const first = buttons[0];
      const last = buttons[buttons.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="animate-fade-scale relative w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl shadow-black/60"
      >
        <h2 id="confirm-title" className="text-sm font-medium text-zinc-100">
          {title}
        </h2>

        {description ? (
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
            {description}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={cn(
              "rounded-md border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300",
              "transition-colors hover:bg-zinc-800/60 hover:text-zinc-100",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
            )}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "rounded-md border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950",
              "transition-all hover:bg-white active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
