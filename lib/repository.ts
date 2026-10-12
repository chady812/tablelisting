import { isSupabaseConfigured } from "@/lib/env";
import {
  localCreate,
  localList,
  localRemove,
  localUpdate,
} from "@/lib/local-db";
import { createClient } from "@/lib/supabase/client";
import type { AnyRow, Entity } from "@/lib/types";

export type RowPayload = Record<string, string | number | null>;

export type DataSource = "supabase" | "local";

const TABLE: Record<Entity, "owners" | "clients"> = {
  owner: "owners",
  client: "clients",
};

export interface Repository {
  readonly mode: DataSource;
  list(entity: Entity): Promise<AnyRow[]>;
  create(entity: Entity, payload: RowPayload): Promise<AnyRow>;
  update(entity: Entity, id: string, patch: RowPayload): Promise<AnyRow>;
  remove(entity: Entity, id: string): Promise<void>;
}

const message = (value: unknown, fallback: string): string => {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === "string" && value.length > 0) return value;
  return fallback;
};

// ---------------------------------------------------------------------------
//  Supabase-backed repository
// ---------------------------------------------------------------------------

function requireClient() {
  const client = createClient();
  if (!client) throw new Error("Supabase credentials are not configured.");
  return client;
}

const supabaseRepository: Repository = {
  mode: "supabase",

  async list(entity) {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from(TABLE[entity])
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as AnyRow[];
  },

  async create(entity, payload) {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from(TABLE[entity])
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("The insert returned no row.");
    return data as AnyRow;
  },

  async update(entity, id, patch) {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from(TABLE[entity])
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Entry not found.");
    return data as AnyRow;
  },

  async remove(entity, id) {
    const supabase = requireClient();
    const { error } = await supabase.from(TABLE[entity]).delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
//  Local (localStorage) repository — used whenever credentials are missing
// ---------------------------------------------------------------------------

const localRepository: Repository = {
  mode: "local",
  list: (entity) => localList(entity),
  create: (entity, payload) => localCreate(entity, payload),
  update: (entity, id, patch) => localUpdate(entity, id, patch),
  remove: (entity, id) => localRemove(entity, id),
};

/**
 * The active storage layer. Chosen once from the resolved environment: if
 * `NEXT_PUBLIC_SUPABASE_URL` + key are present the Supabase client is used,
 * otherwise everything is persisted to `localStorage` (seeded on first run).
 */
export const repository: Repository = isSupabaseConfigured
  ? supabaseRepository
  : localRepository;

export const dataSource: DataSource = repository.mode;

export { message as errorMessage };
