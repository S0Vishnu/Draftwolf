/**
 * Plugin System Type Definitions
 */

export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    homepage?: string;
    repository?: string;
    icon?: string;

    // Requirements
    minDraftflowVersion?: string;
    maxDraftflowVersion?: string;

    // Entry points
    main: string;              // JavaScript entry point
    renderer?: string;         // React component entry
    styles?: string;           // CSS file

    // Permissions
    permissions?: PluginPermission[];

    // Metadata
    category?: 'productivity' | 'design' | 'utility' | 'other';
    tags?: string[];
    screenshots?: string[];

    // Installation
    downloadUrl?: string;      // GitHub release URL
    installSize?: number;      // Size in bytes
}

export type PluginPermission =
    | 'filesystem'
    | 'network'
    | 'clipboard'
    | 'notifications'
    | 'window-management';

export interface Plugin {
    manifest: PluginManifest;
    enabled: boolean;
    installed: boolean;
    installedVersion?: string;
    installPath?: string;

    // Loaded module
    module?: PluginModule;
}

export interface PluginModule {
    // Lifecycle hooks
    activate?: () => void | Promise<void>;
    deactivate?: () => void | Promise<void>;

    // React component (if plugin provides UI)
    Component?: React.ComponentType<any>;

    // Window configuration (if plugin needs separate window)
    createWindow?: () => PluginWindowConfig;

    // IPC handlers (if plugin needs backend logic)
    ipcHandlers?: Record<string, (...args: any[]) => any>;
}

export interface PluginWindowConfig {
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    frame?: boolean;
    transparent?: boolean;
    alwaysOnTop?: boolean;
    route: string;             // React router path
}

export interface PluginRegistry {
    version: string;
    plugins: PluginRegistryEntry[];
}

export interface PluginRegistryEntry {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    homepage: string;
    repository: string;
    downloadUrl: string;
    category: string;
    tags: string[];
    icon?: string;
    screenshots?: string[];
    verified: boolean;
}

export interface PluginInstallOptions {
    pluginId: string;
    version?: string;         // Specific version or 'latest'
    force?: boolean;          // Force reinstall
}

export interface PluginUpdateInfo {
    pluginId: string;
    currentVersion: string;
    latestVersion: string;
    changelog?: string;
    downloadUrl: string;
}
