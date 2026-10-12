import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";

type BrowserClient = ReturnType<typeof createBrowserClient>;

/**
 * Cached browser client. `null` when Supabase credentials are missing, so
 * callers never have to guard `process.env` themselves.
 *
 * `createBrowserClient` already returns a singleton by default; caching here as
 * well keeps `getRepository()` free of per-call client construction.
 */
let cached: BrowserClient | null = null;

export function createClient(): BrowserClient | null {
  if (!isSupabaseConfigured) return null;
  if (cached) return cached;

  cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  return cached;
}
