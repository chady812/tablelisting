# tablelisting

A minimal, keyboard-first workspace for managing real-estate **apartments/owners**
and the **clients** looking for them. Vercel/Linear-style dark mode: zinc scale,
1px borders, monospace details, no chrome that doesn't earn its place.

It ships working with **zero configuration** — no database, no accounts. Add
Supabase credentials when you want it to persist server-side.

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The first load seeds six sample apartments and six
sample clients into `localStorage` so there is something to interact with
immediately.

## Connecting Supabase

1. Create a project at <https://supabase.com>.
2. Paste `schema.sql` into the SQL Editor and run it. It creates the `owners`
   and `clients` tables, `updated_at` triggers, B-tree indexes on
   `status`/`created_at`, and **trigram GIN indexes** on every searchable text
   column so live search stays fast as the list grows.
3. Configure the client:

```bash
cp .env.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key>
```

Restart `npm run dev`. The chip in the header flips from `local` to
`supabase`; until both values are present and parse as a URL, everything stays
in `localStorage`.

> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is accepted as an alias for the anon
> key, matching Supabase's current dashboard naming.

> **Security note:** `schema.sql` enables RLS with deliberately wide policies so
> the app works with just a public key and no auth. That is fine for a personal
> tool on localhost — not for a public deployment. The file has a commented
> snippet showing how to scope rows to `auth.users`.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Jump to the quick-entry bar and focus the first field |
| `Enter` | Submit the entry bar from any field |
| `/` | Focus the search box of the visible list |
| `Esc` | Cancel a dialog, clear a parse preview, or dismiss a menu |
| `↑` `↓` | Move through the status menu options |

## Paste-to-parse

The entry bar has **structured fields** by default, but you can hand it a whole
line and have it split it up:

```
Sunset Loft 4B | Jane Doe | 555 0134 | 2400 | Rented
```

Paste it into any field (or click the wand in the hint row) and each token is
assigned by shape — status words, currency (`$1,200`, `1.2k`), phone-shaped
digit runs, then free text in field order. A chip row appears under the bar so
you can review and correct the fields before pressing `Enter`. Separators:
`|`, `·`, `•`, tab, or two-or-more spaces.

## Project layout

```
schema.sql                     Supabase migration (tables, indexes, RLS, triggers)
app/
  page.tsx                     Server component — prefetches rows when Supabase is on
  layout.tsx                   Geist + Geist_Mono, metadata, viewport
  globals.css                  Tailwind v4 import, theme tokens, animations, scrollbars
components/
  Workspace.tsx                Client shell: state, hotkeys, toasts, delete confirmation
  EntryBar.tsx                 Sticky command bar + field row + parse preview
  EntityToggle.tsx             Segmented Apartments | Clients switch with live counters
  ListView.tsx                 Search, status pills, sort, skeleton/empty states
  ListRow.tsx                  Row cells + copy / status / delete actions
  StatusMenu.tsx               Keyboard-navigable inline status changer
  StatusBadge.tsx              Monochrome pill with a single tinted dot
  ConfirmDialog.tsx            Focus-trapped delete confirmation
  Skeleton.tsx  EmptyState.tsx  Toaster.tsx
lib/
  env.ts                       Env resolution + isSupabaseConfigured
  supabase/client.ts           Browser client (null when unconfigured)
  supabase/server.ts           Server client via next/headers cookies
  repository.ts                Repository interface → Supabase or localStorage
  local-db.ts                  localStorage adapter + seed data + simulated latency
  entities.ts                  Field/column descriptors, line parser, payload builder
  types.ts  seed.ts  utils.ts
hooks/
  useCollection.ts             Optimistic CRUD with rollback
  useHotkeys.ts
verify.ts                      `npm test` — assertions for parser + local repository
```

## Architecture notes

- **One source of truth.** `ENTITY_CONFIG` in `lib/entities.ts` drives both the
  entry-bar fields and the list columns, so a field can never drift between the
  two.
- **Optimistic everything.** `useCollection` writes to local state first, then
  reconciles; a failed write rolls the row back to its snapshot and raises a
  toast. Deletes are confirmed first, then offer **Undo** from the toast — the
  undo path re-creates the row with its original `id` and `created_at`.
- **Local mode is a first-class repository**, not a special case. It has a ~240ms
  simulated round-trip so skeleton loaders are exercised without a network.
- **No `middleware.ts`.** Next 16 renamed it `proxy.ts`, and its only job here
  would be refreshing an auth session — which this app doesn't have. Add it
  alongside auth.

## Scripts

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # parser + repository assertions
```

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TypeScript 5.9 ·
Supabase (`@supabase/ssr` + `@supabase/supabase-js`) · `clsx` + `tailwind-merge` ·
`lucide-react`.
