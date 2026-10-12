import { ChevronDown, Plus, RotateCcw, Wand2 } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import {
  ENTITY_CONFIG,
  buildPayload,
  defaultDraft,
  parseEntryLine,
} from "@/lib/entities";
import type { RowPayload } from "@/lib/repository";
import type { Draft, Entity, FieldDescriptor } from "@/lib/types";
import { cn, isModKey, modKeyLabel } from "@/lib/utils";
import { EntityToggle } from "./EntityToggle";

export interface EntryBarHandle {
  /** Programmatic focus — wired to the ⌘K / Ctrl+K shortcut. */
  focus: () => void;
}

interface EntryBarProps {
  entity: Entity;
  counts: Record<Entity, number>;
  onEntityChange: (next: Entity) => void;
  /** Persist the new row. Resolves `true` only on success. */
  onSubmit: (payload: RowPayload) => Promise<boolean>;
}

const INPUT_CLASS =
  "h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-[13px] text-zinc-100 transition-colors placeholder:text-zinc-600 hover:border-zinc-700 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50";

const LABEL_CLASS =
  "text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600";

/** Detects the separators `parseEntryLine` understands. */
function looksLikeLine(text: string): boolean {
  return /[\t|·•]/.test(text) || /\s{2,}/.test(text);
}

interface EntryFieldProps {
  entity: Entity;
  field: FieldDescriptor;
  value: string;
  disabled?: boolean;
  inputRef?: (element: HTMLInputElement | null) => void;
  onChange: (next: string) => void;
  onPasteLine: (text: string) => void;
  onSubmit: () => void;
}

function EntryField({
  entity,
  field,
  value,
  disabled,
  inputRef,
  onChange,
  onPasteLine,
  onSubmit,
}: EntryFieldProps) {
  const id = `entry-${entity}-${field.key}`;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.shiftKey || isModKey(event)) return;
    event.preventDefault();
    onSubmit();
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!looksLikeLine(text)) return;
    event.preventDefault();
    onPasteLine(text);
  };

  if (field.kind === "status") {
    const config = ENTITY_CONFIG[entity];

    return (
      <div className={cn("flex flex-col gap-1.5", field.barClass)}>
        <label htmlFor={id} className={LABEL_CLASS}>
          {field.label}
        </label>

        <div className="relative">
          <select
            id={id}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className={cn(
              INPUT_CLASS,
              "cursor-pointer appearance-none pr-7",
              "focus:ring-1 focus:ring-zinc-400",
            )}
          >
            {config.statuses.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>

          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600"
          />
        </div>
      </div>
    );
  }

  const isMoney = field.kind === "money";

  return (
    <div className={cn("flex flex-col gap-1.5", field.barClass)}>
      <label htmlFor={id} className={LABEL_CLASS}>
        {field.label}
        {field.required ? <span className="text-zinc-500"> *</span> : null}
      </label>

      <div className="relative">
        {isMoney ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[13px] text-zinc-600"
          >
            $
          </span>
        ) : null}

        <input
          id={id}
          ref={inputRef}
          type="text"
          inputMode={isMoney ? "decimal" : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={value}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          className={cn(
            INPUT_CLASS,
            isMoney && "pl-6 font-mono tabular-nums",
            field.mono && !isMoney && "font-mono",
          )}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface BarMessage {
  text: string;
  tone: "error" | "info";
}

const SUBMIT_CLASS = [
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-zinc-100 px-3",
  "text-xs font-semibold text-zinc-950 transition-all hover:bg-white active:scale-[0.98]",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
  "disabled:pointer-events-none disabled:opacity-50",
].join(" ");

const KBD_CLASS =
  "rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-zinc-400";

/** `navigator.platform` never changes, so an empty subscription is enough. */
const subscribeNoop = () => () => {};

/**
 * Sticky command bar: segmented entity switcher, the structured input row, and
 * an inline hint line that doubles as the paste-to-parse preview.
 *
 * Drafts are kept per entity so switching the toggle never loses typed input.
 */
export const EntryBar = forwardRef<EntryBarHandle, EntryBarProps>(
  function EntryBar({ entity, counts, onEntityChange, onSubmit }, ref) {
    const config = ENTITY_CONFIG[entity];

    const [drafts, setDrafts] = useState<Record<Entity, Draft>>(() => ({
      owner: defaultDraft("owner"),
      client: defaultDraft("client"),
    }));
    const [message, setMessage] = useState<BarMessage | null>(null);
    const [parsedCount, setParsedCount] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [pulse, setPulse] = useState(false);

    /**
     * Read lazily so the server renders `Ctrl` and Apple clients hydrate to
     * `⌘` without a useEffect-driven re-render (and without a mismatch).
     */
    const modLabel = useSyncExternalStore(subscribeNoop, modKeyLabel, () => "Ctrl");

    const containerRef = useRef<HTMLFormElement>(null);
    const firstFieldRef = useRef<HTMLInputElement | null>(null);

    const setFirstField = useCallback((element: HTMLInputElement | null) => {
      firstFieldRef.current = element;
    }, []);

    const draft = drafts[entity];

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          containerRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
          window.setTimeout(() => firstFieldRef.current?.focus(), 0);
        },
      }),
      [],
    );

    const updateField = (key: string, next: string) => {
      setDrafts((prev) => ({
        ...prev,
        [entity]: { ...prev[entity], [key]: next },
      }));
      setMessage(null);
    };

    const applyParsed = (text: string) => {
      const parsed = parseEntryLine(text, entity);
      if (!parsed) {
        setMessage({
          text: "Nothing to split — separate values with a pipe ( | ), a tab, or two spaces.",
          tone: "info",
        });
        return false;
      }

      setDrafts((prev) => ({ ...prev, [entity]: { ...prev[entity], ...parsed } }));
      setParsedCount(Object.keys(parsed).length);
      setMessage(null);
      return true;
    };

    const handleParseButton = () => {
      const active = document.activeElement;
      const source =
        active instanceof HTMLInputElement &&
        containerRef.current?.contains(active)
          ? active.value
          : (draft[config.fields[0].key] ?? "");

      applyParsed(source);
    };

    const clearParsed = () => {
      setParsedCount(null);
      setDrafts((prev) => ({ ...prev, [entity]: defaultDraft(entity) }));
      setMessage(null);
      firstFieldRef.current?.focus();
    };

    const submit = async () => {
      if (submitting) return;

      const { payload, missing } = buildPayload(draft, config.fields, entity);

      if (missing.length > 0) {
        setMessage({
          text:
            missing.length === 1
              ? `${missing[0]} is required.`
              : `Required: ${missing.join(", ")}.`,
          tone: "error",
        });
        return;
      }

      setSubmitting(true);
      const saved = await onSubmit(payload);
      setSubmitting(false);

      if (!saved) return;

      setDrafts((prev) => ({ ...prev, [entity]: defaultDraft(entity) }));
      setParsedCount(null);
      setMessage(null);
      setPulse(true);
      window.setTimeout(() => setPulse(false), 650);
      firstFieldRef.current?.focus();
    };

    const handleEntityChange = (next: Entity) => {
      setMessage(null);
      setParsedCount(null);
      onEntityChange(next);
    };

    const chips = config.fields.filter(
      (field) =>
        field.kind !== "status" && (draft[field.key] ?? "").trim().length > 0,
    );

    return (
      <form
        ref={containerRef}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className={cn(
          "sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur-xl",
          "px-4 py-3 sm:px-6",
          pulse && "animate-pulse-ring",
        )}
      >
        {/* Row 1 — mode switch + shortcut hints */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <EntityToggle
            value={entity}
            counts={counts}
            onChange={handleEntityChange}
          />

          <div className="hidden items-center gap-1.5 font-mono text-[11px] text-zinc-600 sm:flex">
            <kbd className={KBD_CLASS}>{modLabel}+K</kbd>
            <span className="mr-1">focus</span>
            <kbd className={KBD_CLASS}>Enter</kbd>
            <span>add</span>
          </div>
        </div>

        {/* Row 2 — structured input row */}
        <div className="mt-3 flex items-end gap-2">
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12">
            {config.fields.map((field, index) => (
              <EntryField
                key={`${entity}-${field.key}`}
                entity={entity}
                field={field}
                value={draft[field.key] ?? ""}
                disabled={submitting}
                inputRef={index === 0 ? setFirstField : undefined}
                onChange={(next) => updateField(field.key, next)}
                onPasteLine={applyParsed}
                onSubmit={submit}
              />
            ))}
          </div>

          <button type="submit" disabled={submitting} className={SUBMIT_CLASS}>
            <Plus className="h-3.5 w-3.5" />
            Add
            <span className="hidden md:inline">
              {" "}
              {config.singular.toLowerCase()}
            </span>
          </button>
        </div>

        {/* Row 3 — validation / parse preview / discoverability hint */}
        <div className="mt-2.5 flex min-h-[1.25rem] flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
          {message ? (
            <span
              className={
                message.tone === "error"
                  ? "font-medium text-red-400/90"
                  : "text-zinc-500"
              }
            >
              {message.text}
            </span>
          ) : null}

          {parsedCount !== null ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-zinc-500">
                <Wand2 className="h-3 w-3" />
                Parsed {parsedCount} fields
              </span>

              <span className="hidden items-center gap-1.5 md:flex">
                {chips.map((field) => (
                  <span
                    key={field.key}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/70 px-2 py-0.5"
                  >
                    <span className="text-zinc-600">{field.label}</span>
                    <span className="font-mono text-zinc-300">
                      {draft[field.key]}
                    </span>
                  </span>
                ))}
              </span>

              <button
                type="button"
                onClick={clearParsed}
                className="inline-flex items-center gap-1 text-zinc-500 underline decoration-zinc-800 underline-offset-2 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
              >
                <RotateCcw className="h-3 w-3" />
                Clear
              </button>
            </>
          ) : null}

          {parsedCount === null && !message ? (
            <button
              type="button"
              onClick={handleParseButton}
              className="inline-flex items-center gap-1.5 text-zinc-600 transition-colors hover:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
            >
              <Wand2 className="h-3 w-3" />
              <span>
                Paste or type a line like{" "}
                <span className="font-mono text-zinc-500">
                  Sunset Loft 4B | Jane Doe | 555 0134 | 2400 | Rented
                </span>{" "}
                to split it into fields.
              </span>
            </button>
          ) : null}
        </div>
      </form>
    );
  },
);

EntryBar.displayName = "EntryBar";

