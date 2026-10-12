import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  hint: ReactNode;
  icon?: ReactNode;
  /** Spans every column of the list table. */
  colSpan: number;
  className?: string;
}

export function EmptyState({
  title,
  hint,
  icon,
  colSpan,
  className,
}: EmptyStateProps) {
  return (
    <tr className="border-b border-zinc-900">
      <td className="px-4 py-14 text-center" colSpan={colSpan}>
        <div className={cn("mx-auto flex max-w-xs flex-col items-center gap-3", className)}>
          {icon ? (
            <span className="text-zinc-700" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <p className="text-sm font-medium text-zinc-300">{title}</p>
          <p className="text-[13px] leading-relaxed text-zinc-500">{hint}</p>
        </div>
      </td>
    </tr>
  );
}
