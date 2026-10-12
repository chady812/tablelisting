import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware class joiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** `$12,400` · `—` for null. Zero-currency so CAD/AUD users aren't surprised. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** Two-digit counters for the tab badges: `03`, `12`. */
export function formatCount(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** `2026-10-12` — sliced straight from the ISO string so it is UTC-stable and
 *  renders identically on the server and the client (no hydration mismatch). */
export function formatDate(iso: string | null | undefined): string {
  return typeof iso === "string" ? iso.slice(0, 10) : "";
}

/** `⌘` on Apple platforms, `Ctrl` elsewhere. Evaluated lazily (SSR-safe). */
export function modKeyLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  const source = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
  return /Mac|iPhone|iPad|iPod/.test(source) ? "⌘" : "Ctrl";
}

/** Trims, collapses runs of whitespace, and returns `null` for empty strings. */
export function toNullable(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** True when the keypress has Cmd/Ctrl held. */
export function isModKey(event: {
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean {
  return event.metaKey || event.ctrlKey;
}
