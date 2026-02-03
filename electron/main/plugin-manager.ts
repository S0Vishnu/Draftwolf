/**
 * Plugin Manager
 * Manages plugin discovery, installation, updates, and lifecycle
 */

import { app } from 'electron';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import type {
    Plugin,
    PluginManifest,
    PluginRegistry,
    PluginUpdateInfo
} from '../../src/types/plugin';

class PluginManager {
    private plugins: Map<string, Plugin> = new Map();
    private pluginsDir: string;
    private configPath: string;
    private registryUrl = 'https://raw.githubusercontent.com/S0Vishnu/draftflow-plugins/main/registry.json';

    constructor() {
        // Plugin directory in user data
        this.pluginsDir = join(app.getPath('userData'), 'plugins');
        this.configPath = join(app.getPath('userData'), 'plugins-config.json');

        // Ensure plugins directory exists
        if (!existsSync(this.pluginsDir)) {
            mkdirSync(this.pluginsDir, { recursive: true });
        }
    }

    /**
     * Initialize plugin system
     */
    async init() {
        console.log('[PluginManager] Initializing...');

        // Load installed plugins
        await this.loadInstalledPlugins();

        // Activate enabled plugins
        await this.activateEnabledPlugins();

        console.log(`[PluginManager] Loaded ${this.plugins.size} plugin(s)`);
    }

    /**
     * Load all installed plugins from disk
     */
    private async loadInstalledPlugins() {
        if (!existsSync(this.pluginsDir)) return;

        const pluginDirs = readdirSync(this.pluginsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const pluginId of pluginDirs) {
            try {
                const pluginPath = join(this.pluginsDir, pluginId);
                const manifestPath = join(pluginPath, 'manifest.json');

                if (!existsSync(manifestPath)) {
                    console.warn(`[PluginManager] No manifest found for ${pluginId}`);
                    continue;
                }

                const manifest: PluginManifest = JSON.parse(
                    readFileSync(manifestPath, 'utf-8')
                );

                const config = this.getPluginConfig(pluginId);

                this.plugins.set(pluginId, {
                    manifest,
                    enabled: config?.enabled ?? true,
                    installed: true,
                    installedVersion: manifest.version,
                    installPath: pluginPath
                });

                console.log(`[PluginManager] Discovered plugin: ${manifest.name} v${manifest.version}`);
            } catch (error) {
                console.error(`[PluginManager] Failed to load plugin ${pluginId}:`, error);
            }
        }
    }

    /**
     * Activate all enabled plugins
     */
    private async activateEnabledPlugins() {
        for (const [pluginId, plugin] of this.plugins) {
            if (plugin.enabled && plugin.installed) {
                await this.activatePlugin(pluginId);
            }
        }
    }

    /**
     * Activate a specific plugin
     */
    async activatePlugin(pluginId: string): Promise<boolean> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin || !plugin.installed || !plugin.installPath) {
            console.error(`[PluginManager] Cannot activate ${pluginId}: not installed`);
            return false;
        }

        try {
            const mainPath = join(plugin.installPath, plugin.manifest.main);

            if (!existsSync(mainPath)) {
                console.error(`[PluginManager] Main file not found: ${mainPath}`);
                return false;
            }

            // Load the plugin module
            const module = require(mainPath);
            plugin.module = module;

            // Call activate hook if exists
            if (module.activate) {
                await module.activate();
            }

            console.log(`[PluginManager] Activated: ${plugin.manifest.name}`);
            return true;
        } catch (error) {
            console.error(`[PluginManager] Failed to activate ${pluginId}:`, error);
            return false;
        }
    }

    /**
     * Deactivate a plugin
     */
    async deactivatePlugin(pluginId: string): Promise<boolean> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin || !plugin.module) return false;

        try {
            if (plugin.module.deactivate) {
                await plugin.module.deactivate();
            }

            plugin.module = undefined;
            console.log(`[PluginManager] Deactivated: ${plugin.manifest.name}`);
            return true;
        } catch (error) {
            console.error(`[PluginManager] Failed to deactivate ${pluginId}:`, error);
            return false;
        }
    }

    /**
     * Get list of all plugins
     */
    getPlugins(): Plugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Get a specific plugin
     */
    getPlugin(pluginId: string): Plugin | undefined {
        return this.plugins.get(pluginId);
    }

    /**
     * Fetch available plugins from registry
     */
    async fetchRegistry(): Promise<PluginRegistry> {
        try {
            const response = await fetch(this.registryUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch registry: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('[PluginManager] Failed to fetch registry:', error);
            // Return empty registry as fallback
            return { version: '1.0.0', plugins: [] };
        }
    }

    /**
     * Check for plugin updates
     */
    async checkForUpdates(): Promise<PluginUpdateInfo[]> {
        const updates: PluginUpdateInfo[] = [];

        try {
            const registry = await this.fetchRegistry();

            for (const [pluginId, plugin] of this.plugins) {
                if (!plugin.installed || !plugin.installedVersion) continue;

                const registryEntry = registry.plugins.find(p => p.id === pluginId);
                if (!registryEntry) continue;

                if (this.isNewerVersion(registryEntry.version, plugin.installedVersion)) {
                    updates.push({
                        pluginId,
                        currentVersion: plugin.installedVersion,
                        latestVersion: registryEntry.version,
                        downloadUrl: registryEntry.downloadUrl
                    });
                }
            }
        } catch (error) {
            console.error('[PluginManager] Failed to check for updates:', error);
        }

        return updates;
    }

    /**
     * Enable a plugin
     */
    async enablePlugin(pluginId: string): Promise<boolean> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return false;

        plugin.enabled = true;
        this.savePluginConfig(pluginId, { enabled: true });

        if (plugin.installed) {
            return await this.activatePlugin(pluginId);
        }

        return true;
    }

    /**
     * Disable a plugin
     */
    async disablePlugin(pluginId: string): Promise<boolean> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return false;

        plugin.enabled = false;
        this.savePluginConfig(pluginId, { enabled: false });

        return await this.deactivatePlugin(pluginId);
    }

    /**
     * Get plugin configuration
     */
    private getPluginConfig(pluginId: string): any {
        try {
            if (!existsSync(this.configPath)) return null;
            const config = JSON.parse(readFileSync(this.configPath, 'utf-8'));
            return config[pluginId];
        } catch {
            return null;
        }
    }

    /**
     * Save plugin configuration
     */
    private savePluginConfig(pluginId: string, data: any) {
        try {
            let config: Record<string, any> = {};
            if (existsSync(this.configPath)) {
                config = JSON.parse(readFileSync(this.configPath, 'utf-8'));
            }
            config[pluginId] = { ...config[pluginId], ...data };
            writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('[PluginManager] Failed to save config:', error);
        }
    }

    /**
     * Compare versions (simple semver comparison)
     */
    private isNewerVersion(v1: string, v2: string): boolean {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if (parts1[i] > parts2[i]) return true;
            if (parts1[i] < parts2[i]) return false;
        }

        return false;
    }

    /**
     * Get plugins directory path
     */
    getPluginsDir(): string {
        return this.pluginsDir;
    }

    /**
     * Cleanup on app quit
     */
    async cleanup() {
        console.log('[PluginManager] Cleaning up...');

        for (const [pluginId] of this.plugins) {
            await this.deactivatePlugin(pluginId);
        }
    }
}

// Export singleton instance
export const pluginManager = new PluginManager();
