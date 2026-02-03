/**
 * Plugin IPC Handlers
 * Exposes plugin management functions to the renderer process
 */

import { ipcMain } from 'electron';
import { pluginManager } from './plugin-manager';
import { PluginInstaller } from './plugin-installer';
import type { PluginInstallOptions } from '../../src/types/plugin';

export function setupPluginIPC() {
    const installer = new PluginInstaller(pluginManager.getPluginsDir());

    /**
     * Get list of all plugins
     */
    ipcMain.handle('plugins:getAll', async () => {
        try {
            return {
                success: true,
                plugins: pluginManager.getPlugins()
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    });

    /**
     * Get a specific plugin
     */
    ipcMain.handle('plugins:get', async (_, pluginId: string) => {
        try {
            const plugin = pluginManager.getPlugin(pluginId);
            return {
                success: true,
                plugin
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    });

    /**
     * Fetch available plugins from registry
     */
    ipcMain.handle('plugins:fetchRegistry', async () => {
        try {
            const registry = await pluginManager.fetchRegistry();
            return {
                success: true,
                registry
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    });

    /**
     * Install a plugin
     */
    ipcMain.handle('plugins:install', async (_, options: PluginInstallOptions, downloadUrl: string) => {
        try {
            await installer.install(options, downloadUrl);

            // Reload plugins after installation
            await pluginManager.init();

            return {
                success: true,
                message: `Plugin ${options.pluginId} installed successfully`
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    });

    /**
     * Uninstall a plugin
     */
    ipcMain.handle('plugins:uninstall', async (_, pluginId: string) => {
        try {
            // Deactivate first
            await pluginManager.disablePlugin(pluginId);

            // Uninstall
            await installer.uninstall(pluginId);

            // Reload plugins
            await pluginManager.init();

            return {
                success: true,
                message: `Plugin ${pluginId} uninstalled successfully`
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    });

    /**
     * Enable a plugin
     */
    ipcMain.handle('plugins:enable', async (_, pluginId: string) => {
        try {
            const success = await pluginManager.enablePlugin(pluginId);
            return {
                success,
                message: success ? `Plugin ${pluginId} enabled` : 'Failed to enable plugin'
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    });

    /**
     * Disable a plugin
     */
    ipcMain.handle('plugins:disable', async (_, pluginId: string) => {
        try {
            const success = await pluginManager.disablePlugin(pluginId);
            return {
                success,
                message: success ? `Plugin ${pluginId} disabled` : 'Failed to disable plugin'
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    });

    /**
     * Check for plugin updates
     */
    ipcMain.handle('plugins:checkUpdates', async () => {
        try {
            const updates = await pluginManager.checkForUpdates();
            return {
                success: true,
                updates
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    });

    /**
     * Update a plugin
     */
    ipcMain.handle('plugins:update', async (_, pluginId: string, downloadUrl: string) => {
        try {
            await installer.update(pluginId, downloadUrl);

            // Reload plugins
            await pluginManager.init();

            return {
                success: true,
                message: `Plugin ${pluginId} updated successfully`
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    });

    console.log('[PluginIPC] Handlers registered');
}
