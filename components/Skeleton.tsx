import { cn } from "@/lib/utils";

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "block h-3 animate-pulse rounded-sm bg-zinc-800/70",
        className,
      )}
    />
  );
}

/** A shimmering table row matching the column count of the real list. */
export function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr className="border-b border-zinc-900">
      <td className="px-4 py-4" colSpan={columns}>
        <div className="flex items-center gap-4">
          <SkeletonBlock className="h-3.5 w-32" />
          <SkeletonBlock className="hidden h-3 w-24 lg:block" />
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="ml-auto h-3 w-14" />
        </div>
      </td>
    </tr>
  );
}

export function SkeletonList({
  rows = 5,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonRow key={index} columns={columns} />
      ))}
    </>
  );
}
