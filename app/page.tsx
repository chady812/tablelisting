import { Workspace } from "@/components/Workspace";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Client, Owner } from "@/lib/types";

/** Rows are read through cookies-backed Supabase, so render per request. */
export const dynamic = "force-dynamic";

interface Prefetched<T> {
  rows: T[];
  error: string | null;
}

async function prefetch<T>(table: "owners" | "clients"): Promise<Prefetched<T>> {
  if (!isSupabaseConfigured) return { rows: [], error: null };

  try {
    const supabase = await createClient();
    if (!supabase) return { rows: [], error: null };

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as T[], error: null };
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "Could not reach Supabase.",
    };
  }
}

export default async function HomePage() {
  const [owners, clients] = await Promise.all([
    prefetch<Owner>("owners"),
    prefetch<Client>("clients"),
  ]);

  // Surface a Supabase misconfiguration (e.g. table not created yet) through
  // the normal toast path instead of failing the render.
  if (owners.error || clients.error) {
    console.error("[tablelisting] Supabase prefetch failed:", owners.error ?? clients.error);
  }

  return (
    <Workspace initialOwners={owners.rows} initialClients={clients.rows} />
  );
}
