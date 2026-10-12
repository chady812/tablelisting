/**
 * Ad-hoc verification for the pure data layer: the line parser, money parser,
 * payload builder, and the localStorage repository (including its seeded first
 * run and the explicit-id path used by delete-undo).
 *
 * Run with:  npm test
 */
import assert from "node:assert/strict";

import {
  ENTITY_CONFIG,
  buildPayload,
  classifyToken,
  defaultDraft,
  parseEntryLine,
  parseMoney,
} from "./lib/entities";
import { localCreate, localList, localRemove } from "./lib/local-db";

// ---------------------------------------------------------------------------
//  parseMoney
// ---------------------------------------------------------------------------

assert.equal(parseMoney("$2,400"), 2400, "currency symbol + separators");
assert.equal(parseMoney("1.2k"), 1200, "k suffix");
assert.equal(parseMoney("2400"), 2400, "bare integer");
assert.equal(parseMoney("  3,000  "), 3000, "trims and strips commas");
assert.equal(parseMoney(""), null, "empty -> null");
assert.equal(parseMoney("n/a"), null, "non-numeric -> null");

// ---------------------------------------------------------------------------
//  classifyToken
// ---------------------------------------------------------------------------

assert.equal(classifyToken("Rented", "owner"), "status");
assert.equal(classifyToken("AVAILABLE", "owner"), "status");
assert.equal(classifyToken("$1,200", "owner"), "price");
assert.equal(classifyToken("$1,200", "client"), "budget");
assert.equal(classifyToken("+1 555 0188", "owner"), "phone");
assert.equal(classifyToken("Sunset Loft 4B", "owner"), null, "free text");

// ---------------------------------------------------------------------------
//  parseEntryLine — the documented owner example
// ---------------------------------------------------------------------------

const ownerLine = "Sunset Apt 4B | Jane Doe | 555-0134 | $2,400 | Rented";
const ownerDraft = parseEntryLine(ownerLine, "owner");
assert.ok(ownerDraft, "owner line should parse");
assert.equal(ownerDraft.property_name, "Sunset Apt 4B");
assert.equal(ownerDraft.owner_name, "Jane Doe");
assert.equal(ownerDraft.phone, "555-0134");
assert.equal(ownerDraft.price, "$2,400");
assert.equal(ownerDraft.status, "rented");
assert.equal(ownerDraft.location, undefined, "no location token present");

// Alternate separators: tab and double space.
assert.deepEqual(
  parseEntryLine("Oak Terrace\tKenji Mori\t2900", "owner"),
  { property_name: "Oak Terrace", owner_name: "Kenji Mori", price: "2900" },
  "tab separated",
);

assert.deepEqual(
  parseEntryLine("Elm Studio  Tom Whitfield  available", "owner"),
  {
    property_name: "Elm Studio",
    owner_name: "Tom Whitfield",
    status: "available",
  },
  "double-space separated",
);

// ---------------------------------------------------------------------------
//  parseEntryLine — clients
// ---------------------------------------------------------------------------

const clientDraft = parseEntryLine(
  "Marcus Reid | +1 555 0188 | 3000 | Williamsburg | Looking",
  "client",
);
assert.ok(clientDraft, "client line should parse");
assert.equal(clientDraft.client_name, "Marcus Reid");
assert.equal(clientDraft.phone, "+1 555 0188");
assert.equal(clientDraft.budget, "3000");
assert.equal(clientDraft.desired_location, "Williamsburg");
assert.equal(clientDraft.status, "looking");

// Fewer than two tokens must not parse (the literal input is kept instead).
assert.equal(parseEntryLine("just one value", "owner"), null);

// ---------------------------------------------------------------------------
//  buildPayload
// ---------------------------------------------------------------------------

const ownerFields = ENTITY_CONFIG.owner.fields;

const incomplete = buildPayload(
  { ...defaultDraft("owner"), price: "2400" },
  ownerFields,
  "owner",
);
assert.deepEqual(
  incomplete.missing,
  ["Property", "Owner"],
  "required fields are reported by label",
);
assert.equal(incomplete.payload.price, 2400, "money coerced even when incomplete");

const complete = buildPayload(
  {
    property_name: "Riverside Duplex",
    owner_name: "Ana Beltran",
    phone: "",
    price: "1.2k",
    location: "   Jersey   City   ",
    status: "rented",
  },
  ownerFields,
  "owner",
);
assert.deepEqual(complete.missing, [], "nothing required is missing");
assert.equal(complete.payload.price, 1200, "k suffix expands");
assert.equal(complete.payload.location, "Jersey City", "whitespace collapsed");
assert.equal(complete.payload.phone, null, "blank optional -> null");
assert.equal(complete.payload.status, "rented");
assert.equal(complete.payload.notes, null, "hidden field defaults to null");

// ---------------------------------------------------------------------------
//  localStorage repository (minimal window shim)
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const backing = new Map<string, string>();

  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) =>
        backing.has(key) ? (backing.get(key) as string) : null,
      setItem: (key: string, value: string) => void backing.set(key, value),
      removeItem: (key: string) => void backing.delete(key),
    },
  };

  const seeded = await localList("owner");
  assert.equal(seeded.length, 6, "first read seeds six sample apartments");

  const created = await localCreate("owner", {
    property_name: "Verify Loft",
    owner_name: "Test Owner",
    phone: null,
    price: 1000,
    location: null,
    status: "pending",
    notes: null,
  });
  assert.ok(created.id, "create returns an id");
  assert.equal(
    created.created_at,
    created.updated_at,
    "fresh rows share one timestamp",
  );
  assert.equal((await localList("owner")).length, 7, "row appended");

  // Delete-undo relies on `create` honouring an explicit id + created_at.
  const snapshot = { ...created };
  await localRemove("owner", created.id);
  assert.equal((await localList("owner")).length, 6, "row removed");

  const restored = await localCreate(
    "owner",
    snapshot as unknown as Record<string, string | number | null>,
  );
  assert.equal(restored.id, snapshot.id, "undo preserves the original id");
  assert.equal(
    restored.created_at,
    snapshot.created_at,
    "undo preserves created_at",
  );
  assert.equal((await localList("owner")).length, 7, "row restored");

  await assert.rejects(
    () => localRemove("owner", "does-not-exist"),
    /not found/i,
    "removing an unknown id rejects",
  );

  console.log("verify.ts: all assertions passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
