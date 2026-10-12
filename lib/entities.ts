import {
  CLIENT_STATUSES,
  OWNER_STATUSES,
  type Draft,
  type Entity,
  type EntityConfig,
  type FieldDescriptor,
  type Status,
} from "@/lib/types";

// ---------------------------------------------------------------------------
//  Value parsers
// ---------------------------------------------------------------------------

/** `$2,400` → 2400 · `1.2k` → 1200 · `2400` → 2400 · `abc` → null */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,\s]/g, "");
  if (cleaned.length === 0) return null;

  const suffixed = cleaned.match(/^(-?\d+(?:\.\d+)?)([km])$/i);
  if (suffixed) {
    const base = Number.parseFloat(suffixed[1]);
    const factor = suffixed[2].toLowerCase() === "k" ? 1_000 : 1_000_000;
    return Number.isFinite(base) ? Math.round(base * factor) : null;
  }

  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

const FIELD_KEYS: Record<Entity, string[]> = {
  owner: [
    "property_name",
    "owner_name",
    "phone",
    "price",
    "location",
    "status",
    "notes",
  ],
  client: [
    "client_name",
    "phone",
    "budget",
    "preferences",
    "desired_location",
    "status",
    "notes",
  ],
};

/** Free-text fallback keys, in the order unparsed tokens are consumed. */
const FREE_TEXT_KEYS: Record<Entity, string[]> = {
  owner: ["property_name", "owner_name", "location", "notes"],
  client: ["client_name", "desired_location", "preferences", "notes"],
};

const PHONE_CHARS = /^[\d\s()+\-./]+$/;

/** Decides which field a single token belongs to, or `null` for free text. */
export function classifyToken(token: string, entity: Entity): string | null {
  const trimmed = token.trim();
  if (trimmed.length === 0) return null;

  const statuses = entity === "owner" ? OWNER_STATUSES : CLIENT_STATUSES;
  const normalised = trimmed.toLowerCase().replace(/\s+/g, "");
  if ((statuses as readonly string[]).includes(normalised)) return "status";

  const digits = trimmed.replace(/\D/g, "");
  const moneyKey = entity === "owner" ? "price" : "budget";

  // Explicit money shapes: `$1,200`, `1.2k`, `1,200`.
  if (
    trimmed.startsWith("$") ||
    /\d[,\d]*[km]$/i.test(trimmed) ||
    /^\d{1,3}(,\d{3})+$/.test(trimmed)
  ) {
    return moneyKey;
  }

  // Phone-shaped tokens with enough digits win before the bare-number rule,
  // otherwise `5550134` would be mistaken for a price.
  if (digits.length >= 7 && PHONE_CHARS.test(trimmed)) return "phone";

  if (trimmed.length <= 5 && digits.length > 0 && /^[\d.]+$/.test(trimmed)) {
    return moneyKey;
  }

  return null;
}

const TOKEN_SPLIT = /\s*[|·•]\s*|\t+|\s{2,}/;

/**
 * Splits a pasted line such as
 * `Sunset Apt 4B | Jane Doe | 555-0134 | $2,400 | Rented`
 * into a draft by assigning each token to a field based on its shape.
 *
 * Returns `null` when there is nothing to parse (fewer than 2 tokens) so the
 * caller can leave the user's literal input untouched.
 */
export function parseEntryLine(line: string, entity: Entity): Draft | null {
  const tokens = line
    .split(TOKEN_SPLIT)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length < 2) return null;

  const draft: Draft = {};
  const freeText = [...FREE_TEXT_KEYS[entity]];
  const moneyKey = entity === "owner" ? "price" : "budget";
  let consumedMoney = false;

  for (const token of tokens) {
    const key = classifyToken(token, entity);

    if (key === "status") {
      const statuses = entity === "owner" ? OWNER_STATUSES : CLIENT_STATUSES;
      const status = statuses.find(
        (value) => value === token.toLowerCase().replace(/\s+/g, ""),
      );
      if (status) {
        draft.status = status;
        continue;
      }
    } else if (key === "money") {
      // Keep the first money token as the price/budget; later money-looking
      // tokens fall through to free text rather than overwriting the amount.
      if (!consumedMoney && !draft[moneyKey]) {
        draft[moneyKey] = token;
        consumedMoney = true;
        continue;
      }
    } else if (key) {
      if (!draft[key]) {
        draft[key] = token;
        continue;
      }
      // Already filled by an earlier token — fall through to free text.
    }

    const target = freeText.find((candidate) => !draft[candidate]);
    if (target) draft[target] = token;
  }

  return Object.keys(draft).length > 0 ? draft : null;
}

// ---------------------------------------------------------------------------
//  Draft → row payload
// ---------------------------------------------------------------------------

export interface ParsedPayload {
  payload: Record<string, string | number | null>;
  missing: string[];
}

/** Trims every draft value, coerces money fields, and reports required gaps. */
export function buildPayload(
  draft: Draft,
  fields: FieldDescriptor[],
  entity: Entity,
): ParsedPayload {
  const payload: Record<string, string | number | null> = {};
  const missing: string[] = [];

  for (const field of fields) {
    const raw = (draft[field.key] ?? "").trim();

    if (field.required && raw.length === 0) {
      missing.push(field.label);
      continue;
    }

    if (field.kind === "money") {
      payload[field.key] = parseMoney(raw);
      continue;
    }

    payload[field.key] = raw.length === 0 ? null : raw.replace(/\s+/g, " ");
  }

  // `notes` is hidden from both the bar and the list, but the line parser may
  // fill it — carry it through when present.
  if (!("notes" in payload)) {
    const notes = (draft.notes ?? "").trim();
    payload.notes = notes.length > 0 ? notes : null;
  }

  if (!payload.status) payload.status = defaultStatus(entity);

  return { payload, missing };
}

export function defaultStatus(entity: Entity): Status {
  return entity === "owner" ? "available" : "looking";
}

export function defaultDraft(entity: Entity): Draft {
  const draft: Draft = {};
  for (const key of FIELD_KEYS[entity]) {
    draft[key] = key === "status" ? defaultStatus(entity) : "";
  }
  return draft;
}
// ---------------------------------------------------------------------------
//  Entity configuration — single source of truth for the entry bar and the list
// ---------------------------------------------------------------------------

const ownerFields: FieldDescriptor[] = [
  {
    key: "property_name",
    label: "Property",
    placeholder: "Sunset Loft 4B",
    kind: "text",
    required: true,
    barClass: "lg:col-span-3",
  },
  {
    key: "owner_name",
    label: "Owner",
    placeholder: "Jane Doe",
    kind: "text",
    required: true,
    barClass: "lg:col-span-2",
  },
  {
    key: "phone",
    label: "Phone",
    placeholder: "+1 555 013 4567",
    kind: "phone",
    mono: true,
    barClass: "lg:col-span-2",
  },
  {
    key: "price",
    label: "Rent",
    placeholder: "2400",
    kind: "money",
    mono: true,
    barClass: "lg:col-span-2",
  },
  {
    key: "location",
    label: "Location",
    placeholder: "Brooklyn, NY",
    kind: "text",
    barClass: "lg:col-span-2",
  },
  {
    key: "status",
    label: "Status",
    placeholder: "",
    kind: "status",
    barClass: "lg:col-span-1",
  },
];

const clientFields: FieldDescriptor[] = [
  {
    key: "client_name",
    label: "Client",
    placeholder: "Marcus Reid",
    kind: "text",
    required: true,
    barClass: "sm:col-span-2 lg:col-span-3",
  },
  {
    key: "phone",
    label: "Phone",
    placeholder: "+1 555 0188",
    kind: "phone",
    mono: true,
    barClass: "lg:col-span-2",
  },
  {
    key: "budget",
    label: "Budget",
    placeholder: "3000",
    kind: "money",
    mono: true,
    barClass: "lg:col-span-2",
  },
  {
    key: "preferences",
    label: "Preferences",
    placeholder: "2 bed, high floor",
    kind: "text",
    barClass: "lg:col-span-2",
  },
  {
    key: "desired_location",
    label: "Looking in",
    placeholder: "Williamsburg",
    kind: "text",
    barClass: "lg:col-span-2",
  },
  {
    key: "status",
    label: "Status",
    placeholder: "",
    kind: "status",
    barClass: "lg:col-span-1",
  },
];

export const ENTITY_CONFIG = {
  owner: {
    entity: "owner",
    title: "Owners",
    singular: "Apartment",
    description: "Apartments and their owners",
    fields: ownerFields,
    statuses: OWNER_STATUSES,
    defaultStatus: "available",
    primaryKey: "property_name",
    columns: [
      {
        key: "property_name",
        kind: "primary",
        label: "Property",
        secondaryKey: "owner_name",
        className: "min-w-[11rem]",
      },
      {
        key: "phone",
        kind: "text",
        label: "Phone",
        mono: true,
        hide: "hidden lg:table-cell",
      },
      { key: "price", kind: "money", label: "Rent", align: "right" },
      {
        key: "location",
        kind: "text",
        label: "Location",
        hide: "hidden xl:table-cell",
      },
      {
        key: "status",
        kind: "badge",
        label: "Status",
        hide: "hidden sm:table-cell",
      },
      { key: "__actions", kind: "actions", label: "", className: "w-[7.5rem]" },
    ],
  },
  client: {
    entity: "client",
    title: "Clients",
    singular: "Client",
    description: "Buyers and renters in the pipeline",
    fields: clientFields,
    statuses: CLIENT_STATUSES,
    defaultStatus: "looking",
    primaryKey: "client_name",
    columns: [
      {
        key: "client_name",
        kind: "primary",
        label: "Client",
        secondaryKey: "preferences",
        className: "min-w-[11rem]",
      },
      {
        key: "phone",
        kind: "text",
        label: "Phone",
        mono: true,
        hide: "hidden lg:table-cell",
      },
      { key: "budget", kind: "money", label: "Budget", align: "right" },
      {
        key: "desired_location",
        kind: "text",
        label: "Looking in",
        hide: "hidden xl:table-cell",
      },
      {
        key: "status",
        kind: "badge",
        label: "Status",
        hide: "hidden sm:table-cell",
      },
      { key: "__actions", kind: "actions", label: "", className: "w-[7.5rem]" },
    ],
  },
} satisfies Record<Entity, EntityConfig>;


