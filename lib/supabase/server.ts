import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";

/**
 * Server Component / Server Action / Route Handler Supabase client.
 *
 * Returns `null` when Supabase credentials are missing so the caller can fall
 * back to local storage instead of throwing during render.
 *
 * A fresh client is built per request — never share one across requests.
 * `setAll` is omitted (only `getAll` is required from a Server Component):
 * Server Components cannot write response headers, and there is no auth session
 * to refresh yet. When auth is added, move session refresh into a `proxy.ts`
 * (Next 16's replacement for `middleware.ts`).
 */
export async function createClient() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookie writes are not
          // possible. Safe to ignore as long as no auth session needs to be
          // refreshed outside of proxy.ts.
        }
      },
    },
  });
}
