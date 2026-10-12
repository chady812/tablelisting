import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastTone = "neutral" | "success" | "danger";

export interface Toast {
  id: string;
  text: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
}

const TONE_CLASS: Record<ToastTone, string> = {
  neutral: "border-zinc-800 text-zinc-200",
  success: "border-emerald-900/70 text-emerald-200",
  danger: "border-red-900/70 text-red-200",
};

interface ToasterProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

/** Bottom-right toast stack. Each entry can carry one optional inline action
 *  (used for "Undo" after a delete). */
export function Toaster({ toasts, onDismiss }: ToasterProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:left-auto sm:right-4 sm:w-80"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "animate-fade-up pointer-events-auto flex w-full items-center gap-3 rounded-lg border bg-zinc-900/95 px-3 py-2.5 shadow-xl shadow-black/50 backdrop-blur",
            TONE_CLASS[toast.tone ?? "neutral"],
          )}
        >
          <span className="flex-1 text-[13px] leading-snug">{toast.text}</span>

          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                onDismiss(toast.id);
              }}
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                "transition-colors hover:bg-zinc-800",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
              )}
            >
              {toast.action.label}
            </button>
          ) : null}

          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
            className={cn(
              "shrink-0 rounded p-0.5 text-zinc-500 transition-colors hover:text-zinc-200",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
