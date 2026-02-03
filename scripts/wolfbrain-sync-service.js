/**
 * Wolfbrain Background Sync Service
 * Automatically checks for updates on app startup and periodically
 */

const { checkForUpdates, performSync } = require('./sync-wolfbrain');
const { app, Notification } = require('electron');

class WolfbrainSyncService {
    constructor() {
        this.checkInterval = null;
        this.isChecking = false;
        this.autoSync = true; // Set to false to disable auto-sync
        this.checkIntervalMs = 24 * 60 * 60 * 1000; // Check every 24 hours
    }

    /**
     * Initialize the sync service
     */
    async init() {
        console.log('[WolfbrainSync] Initializing sync service...');

        // Check on startup (after 10 seconds delay)
        setTimeout(() => {
            this.checkForUpdatesInBackground();
        }, 10000);

        // Set up periodic checks
        this.startPeriodicChecks();
    }

    /**
     * Start periodic update checks
     */
    startPeriodicChecks() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.checkInterval = setInterval(() => {
            this.checkForUpdatesInBackground();
        }, this.checkIntervalMs);

        console.log(`[WolfbrainSync] Periodic checks enabled (every ${this.checkIntervalMs / 1000 / 60 / 60} hours)`);
    }

    /**
     * Stop periodic checks
     */
    stopPeriodicChecks() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('[WolfbrainSync] Periodic checks disabled');
        }
    }

    /**
     * Check for updates in the background
     */
    async checkForUpdatesInBackground() {
        if (this.isChecking) {
            console.log('[WolfbrainSync] Check already in progress, skipping...');
            return;
        }

        this.isChecking = true;

        try {
            console.log('[WolfbrainSync] Checking for updates...');
            const updateInfo = await checkForUpdates();

            if (updateInfo) {
                console.log('[WolfbrainSync] Update available!');
                this.notifyUpdateAvailable(updateInfo);

                if (this.autoSync) {
                    console.log('[WolfbrainSync] Auto-syncing enabled, performing sync...');
                    await performSync();
                    this.notifyUpdateInstalled();
                }
            } else {
                console.log('[WolfbrainSync] Already up to date');
            }
        } catch (error) {
            console.error('[WolfbrainSync] Error checking for updates:', error.message);
        } finally {
            this.isChecking = false;
        }
    }

    /**
     * Manually trigger an update check
     */
    async manualCheck() {
        console.log('[WolfbrainSync] Manual update check triggered');
        await this.checkForUpdatesInBackground();
    }

    /**
     * Show notification that update is available
     */
    notifyUpdateAvailable(updateInfo) {
        if (Notification.isSupported()) {
            const notification = new Notification({
                title: 'Wolfbrain Update Available',
                body: `A new version of Wolfbrain is available.\nVersion: ${updateInfo.remoteVersion.substring(0, 7)}`,
                icon: null // You can add an icon path here
            });

            notification.show();
        }
    }

    /**
     * Show notification that update was installed
     */
    notifyUpdateInstalled() {
        if (Notification.isSupported()) {
            const notification = new Notification({
                title: 'Wolfbrain Updated',
                body: 'Wolfbrain has been updated to the latest version. Restart the app to see changes.',
                icon: null
            });

            notification.show();
        }
    }

    /**
     * Enable or disable auto-sync
     */
    setAutoSync(enabled) {
        this.autoSync = enabled;
        console.log(`[WolfbrainSync] Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Cleanup on app quit
     */
    cleanup() {
        this.stopPeriodicChecks();
        console.log('[WolfbrainSync] Service cleaned up');
    }
}

// Export singleton instance
const syncService = new WolfbrainSyncService();

module.exports = syncService;
