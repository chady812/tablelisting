import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from "lucide-react";
import { useMemo, useState, type RefObject } from "react";

import { ENTITY_CONFIG } from "@/lib/entities";
import type { AnyRow, RowWithMeta, Status } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { ListRow } from "./ListRow";
import { SkeletonList } from "./Skeleton";

interface ListViewProps<T extends AnyRow> {
  entity: "owner" | "client";
  rows: RowWithMeta<T>[];
  loading: boolean;
  /** Owned by the shell so the `/` shortcut can focus the visible list. */
  searchRef: RefObject<HTMLInputElement | null>;
  onStatusChange: (id: string, status: Status) => void;
  onDelete: (row: T) => void;
  onCopy: (text: string) => void;
}

type Sort = { key: string; dir: "asc" | "desc" } | null;

const PILL_CLASS = cn(
  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
);

/**
 * Searchable, filterable, sortable table for one entity. Search and filter state
 * is local so the two desktop columns stay completely independent.
 */
export function ListView<T extends AnyRow>({
  entity,
  rows,
  loading,
  searchRef,
  onStatusChange,
  onDelete,
  onCopy,
}: ListViewProps<T>) {
  const config = ENTITY_CONFIG[entity];

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [sort, setSort] = useState<Sort>(null);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const row of rows) {
      const key = String(row.status);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let next = rows;

    if (statusFilter !== "all") {
      next = next.filter((row) => row.status === statusFilter);
    }

    if (needle.length > 0) {
      next = next.filter((row) => {
        const record = row as unknown as Record<string, unknown>;
        return config.columns.some((column) => {
          if (column.kind === "actions") return false;
          const value = record[column.key];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(needle);
        });
      });
    }

    if (sort) {
      const factor = sort.dir === "asc" ? 1 : -1;
      next = [...next].sort((a, b) => {
        const left = (a as unknown as Record<string, unknown>)[sort.key];
        const right = (b as unknown as Record<string, unknown>)[sort.key];

        if (left == null && right == null) return 0;
        if (left == null) return 1;
        if (right == null) return -1;

        if (typeof left === "number" && typeof right === "number") {
          return (left - right) * factor;
        }

        return (
          String(left).localeCompare(String(right), undefined, {
            numeric: true,
            sensitivity: "base",
          }) * factor
        );
      });
    }

    return next;
  }, [rows, query, statusFilter, sort, config.columns]);

  const toggleSort = (key: string) => {
    setSort((current) => {
      if (current?.key !== key) return { key, dir: "asc" };
      if (current.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const showSkeleton = loading && rows.length === 0;
  const hasFilters = query.trim().length > 0 || statusFilter !== "all";

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      <header className="border-b border-zinc-800 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium text-zinc-100">
              {config.title}
            </h2>
            <span className="font-mono text-[11px] tabular-nums text-zinc-600">
              {formatCount(rows.length)}
            </span>
          </div>

          <span className="hidden truncate text-[11px] text-zinc-600 sm:block">
            {config.description}
          </span>
        </div>

        <div className="relative mt-3">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600"
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${config.title.toLowerCase()}…`}
            aria-label={`Search ${config.title}`}
            className={cn(
              "h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-8 pr-8 text-[13px] text-zinc-100",
              "transition-colors placeholder:text-zinc-600 hover:border-zinc-700 focus:border-zinc-600",
              "focus:outline-none focus:ring-1 focus:ring-zinc-400",
            )}
          />
          {query.length > 0 ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-600",
                "transition-colors hover:text-zinc-300",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            aria-pressed={statusFilter === "all"}
            className={cn(
              PILL_CLASS,
              statusFilter === "all"
                ? "border-zinc-100 bg-zinc-100 text-zinc-950"
                : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
            )}
          >
            All
            <span className="ml-1 font-mono tabular-nums opacity-60">
              {formatCount(statusCounts.all ?? 0)}
            </span>
          </button>

          {config.statuses.map((status) => {
            const active = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(active ? "all" : status)}
                aria-pressed={active}
                className={cn(
                  PILL_CLASS,
                  active
                    ? "border-zinc-100 bg-zinc-100 text-zinc-950"
                    : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="ml-1 font-mono tabular-nums opacity-60">
                  {formatCount(statusCounts[status] ?? 0)}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="min-w-0 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-[0.14em]">
              {config.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 font-medium text-zinc-600",
                    column.hide,
                    column.className,
                    column.kind === "money" &&
                      column.align === "right" &&
                      "text-right",
                  )}
                >
                  {column.kind === "actions" ? (
                    <span className="sr-only">Actions</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      aria-sort={
                        sort?.key === column.key
                          ? sort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={cn(
                        "inline-flex items-center gap-1 uppercase tracking-[0.14em] transition-colors hover:text-zinc-300",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
                        column.kind === "money" &&
                          column.align === "right" &&
                          "flex-row-reverse",
                        sort?.key === column.key && "text-zinc-300",
                      )}
                    >
                      {column.label}
                      {sort?.key === column.key ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {showSkeleton ? (
              <SkeletonList rows={5} columns={config.columns.length} />
            ) : filtered.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  colSpan={config.columns.length}
                  title="No matches"
                  hint={
                    <>
                      Nothing here matches{" "}
                      <span className="font-mono text-zinc-400">
                        {query.trim() ||
                          (statusFilter === "all"
                            ? ""
                            : statusFilter.charAt(0).toUpperCase() +
                              statusFilter.slice(1))}
                      </span>
                      .
                    </>
                  }
                />
              ) : (
                <EmptyState
                  colSpan={config.columns.length}
                  title={`No ${config.title.toLowerCase()} yet`}
                  hint={
                    <>
                      Add the first {config.singular.toLowerCase()} from the bar
                      above — press{" "}
                      <span className="font-mono text-zinc-400">Enter</span> to
                      save it.
                    </>
                  }
                />
              )
            ) : (
              filtered.map((row) => (
                <ListRow
                  key={row.id}
                  config={config}
                  row={row}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  onCopy={onCopy}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
