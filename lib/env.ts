/**
 * Resolved Supabase configuration.
 *
 * Both a classic `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the newer
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` name are accepted, because Supabase's
 * dashboards renamed the anon key to "publishable key". Anon wins when both
 * are present so an older `.env.local` keeps working.
 *
 * When either value is missing or malformed the whole app silently degrades to
 * local (localStorage) storage — see `lib/repository.ts`.
 */

const trim = (value: string | undefined): string => (value ?? "").trim();

function isReachableUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const SUPABASE_URL = trim(process.env.NEXT_PUBLIC_SUPABASE_URL);

export const SUPABASE_ANON_KEY =
  trim(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  trim(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const isSupabaseConfigured: boolean =
  SUPABASE_URL.length > 0 &&
  SUPABASE_ANON_KEY.length > 0 &&
  isReachableUrl(SUPABASE_URL);

/** Which storage layer is in use — surfaced in the UI as a status chip. */
export const dataSource: "supabase" | "local" = isSupabaseConfigured
  ? "supabase"
  : "local";
