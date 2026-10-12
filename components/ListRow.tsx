import { Check, Copy, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import type {
  AnyRow,
  Column,
  EntityConfig,
  RowWithMeta,
  Status,
} from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { StatusMenu } from "./StatusMenu";

interface ListRowProps<T extends AnyRow> {
  config: EntityConfig;
  row: RowWithMeta<T>;
  onStatusChange: (id: string, status: Status) => void;
  onDelete: (row: T) => void;
  onCopy: (text: string) => void;
}

const CELL_CLASS = "px-4 py-3 align-middle";

const ACTION_CLASS = cn(
  "rounded-md p-1.5 text-zinc-600 transition-colors",
  "hover:bg-zinc-800/60 hover:text-zinc-200",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
);

function Cell({ column, value }: { column: Column; value: unknown }) {
  if (column.kind === "text") {
    const empty = value === null || value === undefined || value === "";
    return (
      <td
        className={cn(
          CELL_CLASS,
          column.hide,
          column.className,
          "text-[13px]",
          column.mono && "font-mono tabular-nums",
          column.align === "right" ? "text-right" : "text-zinc-400",
        )}
      >
        {empty ? "—" : String(value)}
      </td>
    );
  }

  if (column.kind === "money") {
    return (
      <td
        className={cn(
          CELL_CLASS,
          column.hide,
          column.className,
          "font-mono text-[13px] tabular-nums text-zinc-200",
          column.align === "right" && "text-right",
        )}
      >
        {formatMoney(typeof value === "number" ? value : null)}
      </td>
    );
  }

  return null;
}

/**
 * One table row. Owns its hover affordances and inline actions: copy contact,
 * status menu, and delete (the delete itself is confirmed by the parent).
 */
export function ListRow<T extends AnyRow>({
  config,
  row,
  onStatusChange,
  onDelete,
  onCopy,
}: ListRowProps<T>) {
  const [copied, setCopied] = useState(false);

  const primaryColumn = config.columns.find(
    (column): column is Extract<Column, { kind: "primary" }> =>
      column.kind === "primary",
  );

  const primaryKey = primaryColumn?.key ?? config.primaryKey;
  const secondaryKey = primaryColumn?.secondaryKey;
  const record = row as unknown as Record<string, unknown>;

  const primary = String(record[primaryKey] ?? "");
  const secondary = secondaryKey ? String(record[secondaryKey] ?? "") : "";
  const phone = String(record.phone ?? "");
  const notes = String(record.notes ?? "");

  const copyText = [primary, secondary, phone]
    .filter((part) => part.length > 0)
    .join(" · ");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      // Clipboard unavailable (insecure context) — fall back to a temp field.
      const area = document.createElement("textarea");
      area.value = copyText;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
    onCopy(`Copied ${primary}`);
  };

  return (
    <tr
      className={cn(
        "group animate-fade-up border-b border-zinc-900 transition-colors last:border-b-0",
        "hover:bg-zinc-800/25",
        row.pending && "opacity-60",
      )}
    >
      {config.columns.map((column) => {
        if (column.kind === "actions") {
          return (
            <td key={column.key} className={cn(CELL_CLASS, column.className)}>
              <div className="flex items-center justify-end gap-0.5">
                {row.pending ? (
                  <span
                    role="status"
                    className="inline-flex items-center gap-1.5 px-1 text-[11px] text-zinc-500"
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label={`Copy contact info for ${primary}`}
                      onClick={() => void handleCopy()}
                      className={ACTION_CLASS}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      aria-label={`Delete ${primary}`}
                      onClick={() => onDelete(row)}
                      className={cn(ACTION_CLASS, "hover:text-red-400")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </td>
          );
        }

        if (column.kind === "badge") {
          return (
            <td
              key={column.key}
              className={cn(CELL_CLASS, column.hide, column.className)}
            >
              <StatusMenu
                status={row.status as Status}
                options={config.statuses}
                onChange={(next) => onStatusChange(row.id, next)}
              />
            </td>
          );
        }

        if (column.kind === "primary") {
          return (
            <td
              key={column.key}
              className={cn(CELL_CLASS, column.hide, column.className)}
              title={notes ? `${primary} — ${notes}` : undefined}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13px] font-medium text-zinc-100">
                  {primary || "—"}
                </span>
                {secondary ? (
                  <span className="truncate text-xs text-zinc-500">
                    {secondary}
                  </span>
                ) : null}
              </div>
            </td>
          );
        }

        return (
          <Cell
            key={column.key}
            column={column}
            value={record[column.key]}
          />
        );
      })}
    </tr>
  );
}

