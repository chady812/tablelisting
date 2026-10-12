import { useEffect, useRef } from "react";

export interface Hotkey {
  /** Single character or named key, matched case-insensitively. */
  key: string;
  /** Require Cmd (macOS) or Ctrl (everything else). */
  meta?: boolean;
  shift?: boolean;
  /** Skip registration without removing the binding. */
  enabled?: boolean;
  handler: (event: KeyboardEvent) => void;
}

/**
 * Registers window-level keyboard shortcuts. The handler list is held in a ref
 * so callers can pass inline arrow functions without re-binding the listener
 * on every render.
 */
export function useHotkeys(hotkeys: Hotkey[]): void {
  const ref = useRef(hotkeys);

  // Keep the latest bindings available to the long-lived listener below.
  useEffect(() => {
    ref.current = hotkeys;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      for (const hotkey of ref.current) {
        if (hotkey.enabled === false) continue;
        if (hotkey.key.toLowerCase() !== key) continue;

        const hasMod = event.metaKey || event.ctrlKey;
        if (hotkey.meta !== hasMod) continue;
        if (Boolean(hotkey.shift) !== event.shiftKey) continue;
        if (event.altKey) continue;

        event.preventDefault();
        hotkey.handler(event);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
