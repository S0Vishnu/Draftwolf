/**
 * FileChangeMonitor — Background file monitoring with native OS notifications.
 *
 * This module watches a workspace directory recursively using chokidar,
 * buffers file changes (add/change/unlink), and at a configurable interval
 * fires a native OS notification summarizing the changes.
 *
 * Clicking the notification brings the app window to the foreground and
 * sends an IPC event to the renderer so it can navigate to the versioning view.
 */

import { Notification, BrowserWindow } from "electron";
import path from "node:path";
import appIcon from "../../public/icon.png?asset";

/** @type {import('chokidar').FSWatcher | null} */
let watcher = null;

/** @type {NodeJS.Timeout | null} */
let notifyTimer = null;

/** Buffered changes: Map<relativePath, { type: 'add'|'change'|'unlink', timestamp: number }> */
const changeBuffer = new Map();

/** Currently watched directory */
let watchedDir = null;

/** Last known directory (preserved across stop/start cycles for re-enabling) */
let lastKnownDir = null;

/** Interval in minutes */
let intervalMinutes = 30;

/** Whether monitoring is enabled */
let enabled = true;

/**
 * Start monitoring a directory.
 * @param {string} dirPath - Absolute path to the workspace root
 * @param {{ intervalMinutes?: number, enabled?: boolean }} options
 */
export async function startMonitoring(dirPath, options = {}) {
    // Stop any previous monitoring
    await stopMonitoring();

    if (options.intervalMinutes !== undefined) {
        intervalMinutes = options.intervalMinutes;
    }
    if (options.enabled !== undefined) {
        enabled = options.enabled;
    }

    if (!enabled) return;

    watchedDir = dirPath;
    lastKnownDir = dirPath;

    const chokidar = await import("chokidar");

    watcher = chokidar.watch(dirPath, {
        ignoreInitial: true,
        persistent: true,
        // Watch recursively (no depth limit) to capture all nested changes
        ignored: [
            /(^|[/\\])\../, // Ignore dotfiles/dotfolders (includes .draft, .git, etc.)
            "**/node_modules/**",
        ],
        awaitWriteFinish: {
            stabilityThreshold: 500,
            pollInterval: 200,
        },
    });

    watcher.on("add", (filePath) => bufferChange(filePath, "add"));
    watcher.on("change", (filePath) => bufferChange(filePath, "change"));
    watcher.on("unlink", (filePath) => bufferChange(filePath, "unlink"));

    watcher.on("error", (err) => {
        console.error("[FileChangeMonitor] Watcher error:", err);
    });

    // Start the periodic notification timer
    startTimer();

    console.log(
        `[FileChangeMonitor] Started monitoring "${dirPath}" with ${intervalMinutes}min interval`
    );
}

/**
 * Stop monitoring.
 */
export async function stopMonitoring() {
    if (notifyTimer) {
        clearInterval(notifyTimer);
        notifyTimer = null;
    }

    if (watcher) {
        await watcher.close();
        watcher = null;
    }

    changeBuffer.clear();
    watchedDir = null;

    console.log("[FileChangeMonitor] Stopped monitoring");
}

/**
 * Update settings without restarting the watcher (unless interval changes).
 * @param {{ intervalMinutes?: number, enabled?: boolean }} options
 */
export function updateSettings(options) {
    if (options.enabled !== undefined) {
        enabled = options.enabled;
        if (!enabled) {
            // Stop monitoring entirely
            stopMonitoring();
            return;
        } else if (!watcher && lastKnownDir) {
            // Re-enable: restart watcher on last known dir
            startMonitoring(lastKnownDir, { intervalMinutes });
            return;
        }
    }

    if (options.intervalMinutes !== undefined && options.intervalMinutes !== intervalMinutes) {
        intervalMinutes = options.intervalMinutes;
        // Restart the timer with the new interval
        if (notifyTimer) {
            clearInterval(notifyTimer);
        }
        if (watcher) {
            startTimer();
        }
    }
}

/**
 * Get the current state of the change buffer (for renderer queries).
 */
export function getBufferState() {
    const entries = [];
    for (const [filePath, info] of changeBuffer.entries()) {
        entries.push({ path: filePath, ...info });
    }
    // Sort by timestamp descending (most recent first)
    entries.sort((a, b) => b.timestamp - a.timestamp);
    return {
        watchedDir,
        intervalMinutes,
        enabled,
        changes: entries,
        totalChanges: entries.length,
    };
}

/**
 * Clear the change buffer manually.
 */
export function clearBuffer() {
    changeBuffer.clear();
}

/**
 * Fire a test notification immediately (for dev/debug).
 * If the buffer is empty, uses dummy data.
 */
export function testNotification() {
    if (changeBuffer.size === 0) {
        // Inject dummy changes so fireNotification has something to show
        changeBuffer.set("assets/character_model.fbx", { type: "change", timestamp: Date.now() });
        changeBuffer.set("textures/skin_v2.png", { type: "add", timestamp: Date.now() - 1000 });
        changeBuffer.set("scenes/level_01.unity", { type: "change", timestamp: Date.now() - 2000 });
    }
    fireNotification();
}

// ─── Internal ────────────────────────────────────────────────────

function bufferChange(filePath, type) {
    // Store a relative path for a cleaner display
    const relativePath = watchedDir
        ? path.relative(watchedDir, filePath)
        : filePath;

    changeBuffer.set(relativePath, {
        type,
        timestamp: Date.now(),
    });
}

function startTimer() {
    if (notifyTimer) clearInterval(notifyTimer);

    const ms = intervalMinutes * 60 * 1000;
    notifyTimer = setInterval(() => {
        fireNotification();
    }, ms);
}

function fireNotification() {
    console.log(`[FileChangeMonitor] fireNotification called, buffer size: ${changeBuffer.size}`);

    if (changeBuffer.size === 0) {
        console.log("[FileChangeMonitor] Buffer empty, skipping notification");
        return;
    }

    // Check if notifications are supported
    const supported = Notification.isSupported();
    console.log(`[FileChangeMonitor] Notification.isSupported(): ${supported}`);
    if (!supported) {
        console.warn("[FileChangeMonitor] Native notifications not supported on this platform");
        return;
    }

    // Collect changes
    const entries = [];
    for (const [filePath, info] of changeBuffer.entries()) {
        entries.push({ path: filePath, ...info });
    }
    // Sort by timestamp descending
    entries.sort((a, b) => b.timestamp - a.timestamp);

    const total = entries.length;
    const top3 = entries.slice(0, 3);

    // Build body text
    const typeLabels = { add: "Added", change: "Modified", unlink: "Deleted" };
    const lines = top3.map(
        (e) => `${typeLabels[e.type] || "Changed"}: ${e.path}`
    );
    if (total > 3) {
        lines.push(`...and ${total - 3} more`);
    }

    const body = lines.join("\n");
    const title = `DraftWolf \u2014 ${total} file${total > 1 ? "s" : ""} changed`;

    console.log(`[FileChangeMonitor] Creating notification: "${title}"`);
    console.log(`[FileChangeMonitor] Body: ${body}`);

    try {
        const notification = new Notification({
            title,
            body,
            icon: appIcon,
            silent: false,
        });

        notification.on("show", () => {
            console.log("[FileChangeMonitor] Notification SHOWN successfully");
        });

        notification.on("click", () => {
            console.log("[FileChangeMonitor] Notification CLICKED");
            // Bring the main window to the foreground
            const win = BrowserWindow.getAllWindows()[0];
            if (win) {
                if (win.isMinimized()) win.restore();
                win.show();
                win.focus();

                // Send the change summary to the renderer so it can navigate
                win.webContents.send("monitor:notification-clicked", {
                    changes: entries,
                    total,
                    watchedDir,
                });
            }
        });

        notification.on("failed", (event, error) => {
            console.error("[FileChangeMonitor] Notification FAILED:", error);
        });

        notification.on("close", () => {
            console.log("[FileChangeMonitor] Notification closed");
        });

        notification.show();
        console.log("[FileChangeMonitor] notification.show() called");

    } catch (err) {
        console.error("[FileChangeMonitor] Error creating/showing notification:", err);
    }

    // Clear buffer after notification is sent
    changeBuffer.clear();

    console.log(
        `[FileChangeMonitor] Notification fired for ${total} change(s)`
    );
}

