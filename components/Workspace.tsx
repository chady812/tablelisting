"use client";

import { Database, HardDrive } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { useCollection } from "@/hooks/useCollection";
import { useHotkeys } from "@/hooks/useHotkeys";
import { ENTITY_CONFIG } from "@/lib/entities";
import { makeId } from "@/lib/local-db";
import { dataSource, type RowPayload } from "@/lib/repository";
import {
  STATUS_LABEL,
  type AnyRow,
  type Client,
  type Entity,
  type Owner,
  type Status,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./ConfirmDialog";
import { EntryBar, type EntryBarHandle } from "./EntryBar";
import { ListView } from "./ListView";
import { Toaster, type Toast } from "./Toaster";

interface WorkspaceProps {
  initialOwners: Owner[];
  initialClients: Client[];
}

/** Rebuilds a create payload from an existing row so a delete can be undone. */
function payloadOf(entity: Entity, row: AnyRow): RowPayload {
  const config = ENTITY_CONFIG[entity];
  const record = row as unknown as Record<string, unknown>;
  const payload: RowPayload = { ...(record as RowPayload) };

  for (const field of config.fields) {
    if (!(field.key in payload) || payload[field.key] === undefined) {
      payload[field.key] =
        field.kind === "status" ? config.defaultStatus : null;
    }
  }

  payload.notes = (record.notes as string | null) ?? null;
  return payload;
}

function primaryLabel(entity: Entity, row: AnyRow): string {
  const config = ENTITY_CONFIG[entity];
  const record = row as unknown as Record<string, unknown>;
  return String(record[config.primaryKey] ?? "this entry");
}

export function Workspace({
  initialOwners,
  initialClients,
}: WorkspaceProps) {
  const [entity, setEntity] = useState<Entity>("owner");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{
    entity: Entity;
    row: AnyRow;
  } | null>(null);

  const entryBarRef = useRef<EntryBarHandle>(null);
  const ownerSearchRef = useRef<HTMLInputElement>(null);
  const clientSearchRef = useRef<HTMLInputElement>(null);

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = makeId();
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((item) => item.id !== id)),
      toast.action ? 7000 : 4000,
    );
  }, []);

  const owners = useCollection<Owner>({
    entity: "owner",
    initial: initialOwners,
    onError: (text) => pushToast({ text, tone: "danger" }),
  });

  const clients = useCollection<Client>({
    entity: "client",
    initial: initialClients,
    onError: (text) => pushToast({ text, tone: "danger" }),
  });

  const counts: Record<Entity, number> = {
    owner: owners.rows.length,
    client: clients.rows.length,
  };

  useHotkeys([
    {
      key: "k",
      meta: true,
      handler: () => entryBarRef.current?.focus(),
    },
    {
      key: "/",
      handler: () => {
        const target =
          entity === "owner" ? ownerSearchRef.current : clientSearchRef.current;
        target?.focus();
        target?.select();
      },
    },
  ]);

  const handleSubmit = async (payload: RowPayload): Promise<boolean> => {
    const created =
      entity === "owner"
        ? await owners.add(payload)
        : await clients.add(payload);

    if (!created) return false;

    pushToast({
      text: `Added ${primaryLabel(entity, created)}`,
      tone: "success",
    });
    return true;
  };

  const handleStatusChange = (target: Entity, id: string, status: Status) => {
    const collection = target === "owner" ? owners : clients;
    const row = collection.rows.find((item) => item.id === id);
    if (!row) return;

    void collection.update(id, { status });

    pushToast({
      text: `${primaryLabel(target, row)} → ${STATUS_LABEL[status]}`,
    });
  };

  const handleDelete = async (target: Entity, row: AnyRow) => {
    const collection = target === "owner" ? owners : clients;
    const label = primaryLabel(target, row);
    setPendingDelete(null);

    const removed = await collection.remove(row.id);
    if (!removed) return;

    pushToast({
      text: `Deleted ${label}`,
      tone: "danger",
      action: {
        label: "Undo",
        onClick: () => {
          void collection.add(payloadOf(target, row));
          pushToast({ text: `Restored ${label}`, tone: "success" });
        },
      },
    });
  };

  const handleCopy = (text: string) => pushToast({ text });

  const isSupabase = dataSource === "supabase";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <EntryBar
        ref={entryBarRef}
        entity={entity}
        counts={counts}
        onEntityChange={setEntity}
        onSubmit={handleSubmit}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-zinc-600">
            {isSupabase
              ? "Synced with Supabase — every change is optimistic and reconciles once the write settles."
              : "No Supabase credentials found. Entries live in this browser only; add them to .env.local to switch."}
          </p>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-wide",
              isSupabase
                ? "border-emerald-900/80 text-emerald-400"
                : "border-zinc-800 text-zinc-500",
            )}
          >
            {isSupabase ? (
              <Database className="h-3 w-3" />
            ) : (
              <HardDrive className="h-3 w-3" />
            )}
            {isSupabase ? "supabase" : "local"}
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isSupabase ? "bg-emerald-400" : "bg-zinc-600",
              )}
            />
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className={cn("min-w-0", entity !== "owner" && "hidden lg:block")}>
            <ListView<Owner>
              entity="owner"
              rows={owners.rows}
              loading={owners.loading}
              searchRef={ownerSearchRef}
              onStatusChange={(id, status) =>
                handleStatusChange("owner", id, status)
              }
              onDelete={(row) => setPendingDelete({ entity: "owner", row })}
              onCopy={handleCopy}
            />
          </div>

          <div className={cn("min-w-0", entity !== "client" && "hidden lg:block")}>
            <ListView<Client>
              entity="client"
              rows={clients.rows}
              loading={clients.loading}
              searchRef={clientSearchRef}
              onStatusChange={(id, status) =>
                handleStatusChange("client", id, status)
              }
              onDelete={(row) => setPendingDelete({ entity: "client", row })}
              onCopy={handleCopy}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-900 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-zinc-700">
          <span>⌘K / Ctrl+K — quick entry</span>
          <span>/ — search</span>
          <span>Enter — add</span>
          <span>Esc — dismiss</span>
        </div>
      </footer>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete
            ? `Delete ${primaryLabel(pendingDelete.entity, pendingDelete.row)}?`
            : "Delete entry?"
        }
        description="The row is removed immediately. You can still undo it from the notification that follows."
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            void handleDelete(pendingDelete.entity, pendingDelete.row);
          }
        }}
      />

      <Toaster
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((item) => item.id !== id))
        }
      />
    </div>
  );
}
