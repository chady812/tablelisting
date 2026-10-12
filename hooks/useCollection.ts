import { useCallback, useEffect, useRef, useState } from "react";

import { makeId } from "@/lib/local-db";
import { errorMessage, repository, type RowPayload } from "@/lib/repository";
import type { AnyRow, Entity, RowWithMeta } from "@/lib/types";

export interface UseCollectionOptions<T extends AnyRow> {
  entity: Entity;
  /** Rows SSR'd by the server component — shown immediately, then refreshed. */
  initial: T[];
  onError?: (message: string) => void;
}

export interface UseCollection<T extends AnyRow> {
  rows: RowWithMeta<T>[];
  /** True only until the first load settles when no SSR rows were supplied. */
  loading: boolean;
  error: string | null;
  /** Optimistic insert; resolves with the persisted row, or `null` on failure. */
  add: (payload: RowPayload) => Promise<T | null>;
  /** Optimistic patch; resolves `false` if it was rolled back. */
  update: (id: string, patch: RowPayload) => Promise<boolean>;
  /** Optimistic delete; resolves `false` if it was rolled back. */
  remove: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

/**
 * Loads one entity list and exposes optimistic CRUD on top of it.
 *
 * Every mutation writes to local state first and reconciles with the
 * repository afterwards; a failed call rolls the row back to its previous
 * snapshot and reports the error through `onError` (surfaced as a toast).
 */
export function useCollection<T extends AnyRow>(
  options: UseCollectionOptions<T>,
): UseCollection<T> {
  const { entity, initial, onError } = options;

  const [rows, setRows] = useState<RowWithMeta<T>[]>(
    () => initial as RowWithMeta<T>[],
  );
  const [loading, setLoading] = useState<boolean>(initial.length === 0);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const rowsRef = useRef(rows);
  const onErrorRef = useRef(onError);

  // Refs are synced after commit — they must never be written during render.
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const fail = useCallback((err: unknown, fallback: string) => {
    const text = errorMessage(err, fallback);
    if (!mountedRef.current) return text;
    setError(text);
    onErrorRef.current?.(text);
    return text;
  }, []);

  /**
   * Written as a promise chain rather than async/await so every `setState` sits
   * lexically inside a callback — nothing runs synchronously from the mount
   * effect, which is what `react-hooks/set-state-in-effect` guards against.
   */
  const refresh = useCallback((): Promise<void> => {
    return repository
      .list(entity)
      .then((data) => {
        if (!mountedRef.current) return;
        setRows(data as RowWithMeta<T>[]);
        setError(null);
      })
      .catch((err: unknown) => {
        fail(err, "Could not load entries.");
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, [entity, fail]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (payload: RowPayload): Promise<T | null> => {
      const tempId = `pending-${makeId()}`;
      const now = new Date().toISOString();
      const optimistic = {
        id: tempId,
        ...payload,
        created_at: now,
        updated_at: now,
        pending: true,
      } as unknown as RowWithMeta<T>;

      setRows((prev) => [optimistic, ...prev]);

      try {
        const created = (await repository.create(entity, payload)) as T;
        if (mountedRef.current) {
          setRows((prev) =>
            prev.map((row) => (row.id === tempId ? created : row)),
          );
          setError(null);
        }
        return created;
      } catch (err) {
        if (mountedRef.current) {
          setRows((prev) => prev.filter((row) => row.id !== tempId));
        }
        fail(err, "Could not save the entry.");
        return null;
      }
    },
    [entity, fail],
  );

  const update = useCallback(
    async (id: string, patch: RowPayload): Promise<boolean> => {
      const snapshot = rowsRef.current.find((row) => row.id === id);
      if (!snapshot) return false;

      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? { ...row, ...patch, updated_at: new Date().toISOString() }
            : row,
        ),
      );

      try {
        await repository.update(entity, id, patch);
        if (mountedRef.current) setError(null);
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setRows((prev) =>
            prev.map((row) => (row.id === id ? snapshot : row)),
          );
        }
        fail(err, "Could not update the entry.");
        return false;
      }
    },
    [entity, fail],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const index = rowsRef.current.findIndex((row) => row.id === id);
      if (index === -1) return false;

      const snapshot = rowsRef.current[index];
      setRows((prev) => prev.filter((row) => row.id !== id));

      try {
        await repository.remove(entity, id);
        if (mountedRef.current) setError(null);
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setRows((prev) => {
            const restored = [...prev];
            restored.splice(Math.min(index, restored.length), 0, snapshot);
            return restored;
          });
        }
        fail(err, "Could not delete the entry.");
        return false;
      }
    },
    [entity, fail],
  );

  return { rows, loading, error, add, update, remove, refresh };
}
