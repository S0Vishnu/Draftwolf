/**
 * Shortcuts Manager
 * Central registry of keyboard shortcuts with persistence.
 */

export interface ShortcutDef {
    id: string;
    label: string;
    category: 'file' | 'navigation' | 'edit' | 'view' | 'version' | 'general';
    /** Key combo string, e.g. "Ctrl+S", "F2", "Delete", "Ctrl+Shift+N" */
    keys: string;
    /** Original default keys (never changes) */
    defaultKeys: string;
}

const DEFAULT_SHORTCUTS: Omit<ShortcutDef, 'defaultKeys'>[] = [
    // ── File ───────────────────────────────────────
    { id: 'file.newFile', label: 'New File', category: 'file', keys: 'Ctrl+N' },
    { id: 'file.newFolder', label: 'New Folder', category: 'file', keys: 'Ctrl+Shift+N' },
    { id: 'file.rename', label: 'Rename', category: 'file', keys: 'F2' },
    { id: 'file.delete', label: 'Delete', category: 'file', keys: 'Delete' },
    { id: 'file.openFile', label: 'Open File / Enter Folder', category: 'file', keys: 'Enter' },
    { id: 'file.showInExplorer', label: 'Show in Explorer', category: 'file', keys: 'Ctrl+Shift+E' },

    // ── Edit ───────────────────────────────────────
    { id: 'edit.copy', label: 'Copy', category: 'edit', keys: 'Ctrl+C' },
    { id: 'edit.cut', label: 'Cut', category: 'edit', keys: 'Ctrl+X' },
    { id: 'edit.paste', label: 'Paste', category: 'edit', keys: 'Ctrl+V' },
    { id: 'edit.selectAll', label: 'Select All', category: 'edit', keys: 'Ctrl+A' },
    { id: 'edit.deselect', label: 'Deselect All / Close', category: 'edit', keys: 'Escape' },

    // ── Navigation ─────────────────────────────────
    { id: 'nav.back', label: 'Go Back', category: 'navigation', keys: 'Backspace' },

    // ── View ───────────────────────────────────────
    { id: 'view.toggleSidebar', label: 'Toggle Sidebar', category: 'view', keys: 'Ctrl+B' },
    { id: 'view.toggleInspector', label: 'Toggle Inspector', category: 'view', keys: 'Ctrl+I' },
    { id: 'view.refresh', label: 'Refresh', category: 'view', keys: 'Ctrl+R' },
    { id: 'view.search', label: 'Focus Search', category: 'view', keys: 'Ctrl+F' },

    // ── Version Control ────────────────────────────
    { id: 'version.create', label: 'Create Version', category: 'version', keys: 'Ctrl+Shift+S' },
    { id: 'version.compare', label: 'Visual Diff (Compare)', category: 'version', keys: 'Ctrl+D' },

    // ── General ────────────────────────────────────
    { id: 'general.help', label: 'Show Help', category: 'general', keys: 'F1' },
    { id: 'general.settings', label: 'Open Settings', category: 'general', keys: 'Ctrl+,' },
];

const STORAGE_KEY = 'draftwolf_shortcuts';

/**
 * Load shortcuts, merging user overrides from localStorage over defaults.
 */
export function loadShortcuts(): ShortcutDef[] {
    const base: ShortcutDef[] = DEFAULT_SHORTCUTS.map(s => ({
        ...s,
        defaultKeys: s.keys,
    }));

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const overrides: Record<string, string> = JSON.parse(raw);
            for (const sc of base) {
                if (overrides[sc.id]) {
                    sc.keys = overrides[sc.id];
                }
            }
        }
    } catch {
        // ignore parse errors
    }

    return base;
}

/**
 * Persist only the user-customised keys (delta from defaults).
 */
export function saveShortcuts(shortcuts: ShortcutDef[]): void {
    const overrides: Record<string, string> = {};
    for (const sc of shortcuts) {
        if (sc.keys !== sc.defaultKeys) {
            overrides[sc.id] = sc.keys;
        }
    }
    if (Object.keys(overrides).length === 0) {
        localStorage.removeItem(STORAGE_KEY);
    } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    }
    dispatchShortcutsChanged();
}

function dispatchShortcutsChanged() {
    window.dispatchEvent(new Event('shortcuts-changed'));
}

/**
 * Reset all shortcuts to defaults.
 */
export function resetShortcuts(): ShortcutDef[] {
    localStorage.removeItem(STORAGE_KEY);
    dispatchShortcutsChanged();
    return loadShortcuts();
}

/** Category labels for display */
export const CATEGORY_LABELS: Record<string, string> = {
    file: 'File',
    edit: 'Edit',
    navigation: 'Navigation',
    view: 'View',
    version: 'Version Control',
    general: 'General',
};

/**
 * Format a key combo for display: "Ctrl+Shift+N" → ["Ctrl", "Shift", "N"]
 */
export function formatKeyCombo(keys: string): string[] {
    return keys.split('+').map(k => k.trim());
}

/**
 * Convert a KeyboardEvent into a normalised combo string: "Ctrl+Shift+N"
 */
export function eventToCombo(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    let key = e.key;
    // Normalise special keys
    if (key === ' ') key = 'Space';
    else if (key === 'ArrowUp') key = 'ArrowUp';
    else if (key === 'ArrowDown') key = 'ArrowDown';
    else if (key === 'ArrowLeft') key = 'ArrowLeft';
    else if (key === 'ArrowRight') key = 'ArrowRight';
    else if (key.length === 1) key = key.toUpperCase();

    // Don't add modifier keys themselves as the "key" part
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
        parts.push(key);
    }

    return parts.join('+');
}
