/** Shared domain types for the owners (apartments) and clients lists. */

// ---------------------------------------------------------------------------
//  Statuses
// ---------------------------------------------------------------------------

export const OWNER_STATUSES = ["available", "rented", "pending"] as const;
export const CLIENT_STATUSES = ["looking", "matched", "closed"] as const;

export type OwnerStatus = (typeof OWNER_STATUSES)[number];
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export type Status = OwnerStatus | ClientStatus;
export type AnyStatusList = typeof OWNER_STATUSES | typeof CLIENT_STATUSES;

export type Entity = "owner" | "client";

export const STATUS_LABEL: Record<Status, string> = {
  available: "Available",
  rented: "Rented",
  pending: "Pending",
  looking: "Looking",
  matched: "Matched",
  closed: "Closed",
};

/** Monochrome-first tint: only the 6px dot carries colour. */
export const STATUS_DOT: Record<Status, string> = {
  available: "bg-emerald-400",
  rented: "bg-zinc-500",
  pending: "bg-amber-400",
  looking: "bg-emerald-400",
  matched: "bg-sky-400",
  closed: "bg-zinc-500",
};

export function isStatus(value: unknown, entity: Entity): value is Status {
  const list = entity === "owner" ? OWNER_STATUSES : CLIENT_STATUSES;
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
//  Rows
// ---------------------------------------------------------------------------

export interface Owner {
  id: string;
  property_name: string;
  owner_name: string;
  phone: string | null;
  price: number | null;
  location: string | null;
  status: OwnerStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  client_name: string;
  phone: string | null;
  budget: number | null;
  preferences: string | null;
  desired_location: string | null;
  status: ClientStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type AnyRow = Owner | Client;
export type RowOf<E extends Entity> = E extends "owner" ? Owner : Client;

/** Adds the optimistic-insert flag used while a create request is in flight. */
export type RowWithMeta<T> = T & { pending?: boolean };

// ---------------------------------------------------------------------------
//  Entry-bar drafts (raw, unvalidated field values as typed by the user)
// ---------------------------------------------------------------------------

export type Draft = Record<string, string>;

export interface FieldDescriptor {
  key: string;
  label: string;
  placeholder: string;
  kind: "text" | "phone" | "money" | "status";
  required?: boolean;
  mono?: boolean;
  /** Responsive column span for the entry-bar grid (`lg:` breakpoint = 12 cols). */
  barClass?: string;
}

// ---------------------------------------------------------------------------
//  List columns
// ---------------------------------------------------------------------------

interface ColumnBase {
  label: string;
  className?: string;
  /** Responsive classes that hide the column at smaller widths. */
  hide?: string;
}

export type Column =
  | (ColumnBase & { key: string; kind: "primary"; secondaryKey?: string })
  | (ColumnBase & { key: string; kind: "text"; mono?: boolean; align?: "left" | "right" })
  | (ColumnBase & { key: string; kind: "money"; align?: "right" })
  | (ColumnBase & { key: string; kind: "badge" })
  | (ColumnBase & { key: string; kind: "actions" });

// ---------------------------------------------------------------------------
//  Per-entity configuration (single source of truth for bar + list)
// ---------------------------------------------------------------------------

export interface EntityConfig<E extends Entity = Entity> {
  entity: E;
  /** Tab / heading title. */
  title: string;
  singular: string;
  description: string;
  fields: FieldDescriptor[];
  columns: Column[];
  statuses: AnyStatusList;
  defaultStatus: Status;
  primaryKey: string;
}
