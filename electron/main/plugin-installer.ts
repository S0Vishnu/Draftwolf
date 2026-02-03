/**
 * Plugin Installer
 * Handles downloading and installing plugins from GitHub releases
 */

import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Extract } from 'unzipper';
import type { PluginInstallOptions } from '../../src/types/plugin';

export class PluginInstaller {
    private pluginsDir: string;

    constructor(pluginsDir: string) {
        this.pluginsDir = pluginsDir;
    }

    /**
     * Install a plugin from URL
     */
    async install(options: PluginInstallOptions, downloadUrl: string): Promise<boolean> {
        const { pluginId, force } = options;
        const pluginPath = join(this.pluginsDir, pluginId);

        try {
            console.log(`[PluginInstaller] Installing ${pluginId}...`);

            // Check if already installed
            if (existsSync(pluginPath) && !force) {
                throw new Error(`Plugin ${pluginId} is already installed. Use force=true to reinstall.`);
            }

            // Remove existing installation if force
            if (existsSync(pluginPath) && force) {
                console.log(`[PluginInstaller] Removing existing installation...`);
                rmSync(pluginPath, { recursive: true, force: true });
            }

            // Create plugin directory
            mkdirSync(pluginPath, { recursive: true });

            // Download plugin
            console.log(`[PluginInstaller] Downloading from ${downloadUrl}...`);
            const zipPath = join(pluginPath, 'plugin.zip');
            await this.downloadFile(downloadUrl, zipPath);

            // Extract plugin
            console.log(`[PluginInstaller] Extracting...`);
            await this.extractZip(zipPath, pluginPath);

            // Clean up zip file
            rmSync(zipPath, { force: true });

            console.log(`[PluginInstaller] Successfully installed ${pluginId}`);
            return true;
        } catch (error) {
            console.error(`[PluginInstaller] Failed to install ${pluginId}:`, error);

            // Clean up on failure
            if (existsSync(pluginPath)) {
                rmSync(pluginPath, { recursive: true, force: true });
            }

            throw error;
        }
    }

    /**
     * Uninstall a plugin
     */
    async uninstall(pluginId: string): Promise<boolean> {
        const pluginPath = join(this.pluginsDir, pluginId);

        try {
            if (!existsSync(pluginPath)) {
                console.warn(`[PluginInstaller] Plugin ${pluginId} is not installed`);
                return false;
            }

            console.log(`[PluginInstaller] Uninstalling ${pluginId}...`);
            rmSync(pluginPath, { recursive: true, force: true });
            console.log(`[PluginInstaller] Successfully uninstalled ${pluginId}`);

            return true;
        } catch (error) {
            console.error(`[PluginInstaller] Failed to uninstall ${pluginId}:`, error);
            throw error;
        }
    }

    /**
     * Update a plugin
     */
    async update(pluginId: string, downloadUrl: string): Promise<boolean> {
        console.log(`[PluginInstaller] Updating ${pluginId}...`);

        // Reinstall with force flag
        return await this.install(
            { pluginId, force: true },
            downloadUrl
        );
    }

    /**
     * Download a file from URL
     */
    private async downloadFile(url: string, destination: string): Promise<void> {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to download: ${response.statusText}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        const fileStream = createWriteStream(destination);

        // Convert Web ReadableStream to Node.js Readable
        const nodeStream = this.webStreamToNodeStream(response.body);

        await pipeline(nodeStream, fileStream);
    }

    /**
     * Convert Web ReadableStream to Node.js Readable
     */
    private webStreamToNodeStream(webStream: ReadableStream): NodeJS.ReadableStream {
        const reader = webStream.getReader();
        const { Readable } = require('node:stream');

        return new Readable({
            async read() {
                try {
                    const { done, value } = await reader.read();
                    if (done) {
                        this.push(null);
                    } else {
                        this.push(Buffer.from(value));
                    }
                } catch (error) {
                    this.destroy(error as Error);
                }
            }
        });
    }

    /**
     * Extract ZIP file
     */
    private async extractZip(zipPath: string, destination: string): Promise<void> {
        const fs = require('node:fs');

        return new Promise((resolve, reject) => {
            fs.createReadStream(zipPath)
                .pipe(Extract({ path: destination }))
                .on('close', resolve)
                .on('error', reject);
        });
    }
}
