/**
 * useShortcuts — global keyboard shortcut dispatcher hook.
 *
 * Loads the user's shortcut bindings from the registry and
 * matches incoming KeyboardEvents against them to fire actions.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { loadShortcuts, ShortcutDef, eventToCombo } from '../utils/shortcuts';

export type ShortcutHandler = (e: KeyboardEvent) => void;

/**
 * Register a map of shortcut ID → handler.
 * The hook listens for keydown and dispatches to the right handler
 * based on the current (possibly user-customised) key bindings.
 *
 * Options:
 *  - `enabled`: whether the hook is active (default true)
 *  - `ignoreInputs`: skip when focus is in INPUT/TEXTAREA (default true)
 */
export function useShortcuts(
    handlers: Record<string, ShortcutHandler>,
    options: { enabled?: boolean; ignoreInputs?: boolean } = {},
) {
    const { enabled = true, ignoreInputs = true } = options;

    // Keep handlers ref-stable so we don't re-register the listener every render
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    // Build a combo → shortcut lookup; re-build when localStorage changes
    const [comboMap, setComboMap] = useState(() => buildComboMap());

    // Listen for storage change events (fired when shortcuts are saved from HelpModal)
    useEffect(() => {
        const refreshMap = () => setComboMap(buildComboMap());

        const onStorage = (e: StorageEvent) => {
            if (e.key === 'draftwolf_shortcuts' || e.key === null) {
                refreshMap();
            }
        };
        globalThis.addEventListener('storage', onStorage);
        globalThis.addEventListener('shortcuts-changed', refreshMap);

        // Also poll on visibility change (covers same-tab localStorage writes if event missed)
        const onVisibility = () => {
            if (document.visibilityState === 'visible') refreshMap();
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            globalThis.removeEventListener('storage', onStorage);
            globalThis.removeEventListener('shortcuts-changed', refreshMap);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    const listener = useCallback(
        (e: KeyboardEvent) => {
            if (!enabled) return;

            // Skip modifier-only key presses
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

            // Skip when typing in inputs
            if (ignoreInputs) {
                const target = e.target as HTMLElement;
                if (
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable
                ) return;
            }

            const combo = eventToCombo(e);
            const sc = comboMap.get(combo);

            if (sc && handlersRef.current[sc.id]) {
                handlersRef.current[sc.id](e);
            }
        },
        [enabled, ignoreInputs, comboMap],
    );

    useEffect(() => {
        globalThis.addEventListener('keydown', listener);
        return () => globalThis.removeEventListener('keydown', listener);
    }, [listener]);
}

function buildComboMap(): Map<string, ShortcutDef> {
    const shortcuts = loadShortcuts();
    const map = new Map<string, ShortcutDef>();
    for (const sc of shortcuts) {
        map.set(sc.keys, sc);
    }
    return map;
}
