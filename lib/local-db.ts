import { SEED_CLIENTS, SEED_OWNERS } from "@/lib/seed";
import type { AnyRow, Entity, Owner, Client } from "@/lib/types";

const STORAGE_KEY = "tablelisting:v1";

/** Simulated round-trip so skeleton loaders are actually visible in local mode. */
const LATENCY_MS = 240;

export interface Store {
  owners: Owner[];
  clients: Client[];
}

const isServer = (): boolean => typeof window === "undefined";

function emptyStore(): Store {
  return { owners: [], clients: [] };
}

function seedStore(): Store {
  return {
    owners: SEED_OWNERS.map((row) => ({ ...row })),
    clients: SEED_CLIENTS.map((row) => ({ ...row })),
  };
}

/**
 * Reads the persisted store, seeding it with sample rows the first time it is
 * touched. Server renders see an empty store (the client hydrates it).
 */
export function readStore(): Store {
  if (isServer()) return emptyStore();

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return emptyStore();
  }

  if (raw === null) {
    const seeded = seedStore();
    writeStore(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      owners: Array.isArray(parsed.owners) ? parsed.owners : [],
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
    };
  } catch {
    // Corrupt payload — recover with a clean seed rather than crashing.
    const seeded = seedStore();
    writeStore(seeded);
    return seeded;
  }
}

export function writeStore(store: Store): void {
  if (isServer()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded / private mode — the in-memory state stays authoritative
    // for this session, it just will not survive a reload.
  }
}

/** Drops the persisted store and re-seeds it. */
export function resetStore(): Store {
  const seeded = seedStore();
  writeStore(seeded);
  return seeded;
}

const bucket = (entity: Entity): keyof Store =>
  entity === "owner" ? "owners" : "clients";

function delay(ms: number = LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function localList(entity: Entity): Promise<AnyRow[]> {
  await delay();
  return readStore()[bucket(entity)];
}

export async function localCreate(
  entity: Entity,
  payload: Record<string, string | number | null>,
): Promise<AnyRow> {
  await delay();
  const store = readStore();
  const now = new Date().toISOString();
  const row = {
    id: makeId(),
    created_at: now,
    updated_at: now,
    ...payload,
    status: payload.status ?? (entity === "owner" ? "available" : "looking"),
  } as AnyRow;

  store[bucket(entity)] = [row, ...store[bucket(entity)]] as never;
  writeStore(store);
  return row;
}

export async function localUpdate(
  entity: Entity,
  id: string,
  patch: Record<string, string | number | null>,
): Promise<AnyRow> {
  await delay();
  const store = readStore();
  const rows = store[bucket(entity)];
  const index = rows.findIndex((row) => row.id === id);

  if (index === -1) throw new Error("Entry not found.");

  const updated = {
    ...rows[index],
    ...patch,
    updated_at: new Date().toISOString(),
  } as AnyRow;

  rows[index] = updated as never;
  writeStore(store);
  return updated;
}

export async function localRemove(entity: Entity, id: string): Promise<void> {
  await delay();
  const store = readStore();
  const rows = store[bucket(entity)];
  const next = rows.filter((row) => row.id !== id);

  if (next.length === rows.length) throw new Error("Entry not found.");

  store[bucket(entity)] = next as never;
  writeStore(store);
}
