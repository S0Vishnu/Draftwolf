/// <reference types="vite/client" />

interface Window {
  electron: {
    ipcRenderer: {
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, func: (...args: any[]) => void) => void;
      once: (channel: string, func: (...args: any[]) => void) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
    process: {
      versions: {
        electron: string;
        chrome: string;
        node: string;
        [key: string]: string | undefined;
      };
    };
  };
  api: {
    openFile: (options?: any) => Promise<string | null>;
    openFolder: () => Promise<string | null>;
    readDir: (path: string) => Promise<{ name: string; isDirectory: boolean; path: string }[]>;
    createFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
    createFile: (path: string) => Promise<{ success: boolean; error?: string }>;
    deleteEntry: (path: string) => Promise<boolean>;
    renameEntry: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
    copyEntry: (sourcePath: string, destPath: string) => Promise<boolean>;
    showInFolder: (path: string) => Promise<boolean>;
    openPath: (path: string) => Promise<boolean>;
    readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    openExternal: (url: string) => Promise<void>;
    getStats: (path: string) => Promise<{ size: number; mtime: Date; birthtime: Date; isFile: boolean; isDirectory: boolean } | null>;
    getFileIcon: (path: string) => Promise<string | null>;
    watchDir: (path: string) => Promise<boolean>;
    onFileChange: (callback: (data: { event: string; path: string }) => void) => () => void;
    confirm: (options: { message: string, title?: string, type?: string, buttons?: string[] }) => Promise<boolean>;
    downloadFile: (url: string, suggestedFileName?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    quitApp: () => void;
    getAppVersion: () => Promise<string>;
    setPinnedFoldersForTray: (folders: { path: string; name: string }[]) => void;
    onTrayOpenFolder: (callback: (path: string) => void) => () => void;
    onTrayNavigate: (callback: (path: string) => void) => () => void;
    draft: {
      init: (projectRoot: string, backupPath?: string) => Promise<boolean>;
      commit: (projectRoot: string, label: string, files: string[], backupPath?: string) => Promise<{ success: boolean; versionId?: string; error?: string }>;
      createSnapshot: (projectRoot: string, folderPath: string, label: string, backupPath?: string) => Promise<{ success: boolean; versionId?: string; error?: string }>;
      getHistory: (projectRoot: string, relativePath?: string, backupPath?: string) => Promise<{ id: string; label: string; timestamp: string | number; files: Record<string, string>; totalSize?: number; parent?: string; parents?: string[]; parentId?: string; totalCompressedSize?: number }[]>;
      restore: (projectRoot: string, versionId: string, backupPath?: string) => Promise<{ success: boolean; error?: string; code?: string }>;
      delete: (projectRoot: string, versionId: string, backupPath?: string) => Promise<boolean>;
      renameVersion: (projectRoot: string, versionId: string, newLabel: string, backupPath?: string) => Promise<boolean>;
      extract: (projectRoot: string, versionId: string, relativePath: string, destPath: string, backupPath?: string) => Promise<boolean>;
      saveAttachment: (projectRoot: string, filePath: string, backupPath?: string) => Promise<{ success: boolean; path: string }>;
      saveMetadata: (projectRoot: string, relativePath: string, metadata: any, backupPath?: string) => Promise<boolean>;
      getMetadata: (projectRoot: string, relativePath: string, backupPath?: string) => Promise<any>;
      getFileVersion: (projectRoot: string, relativePath: string, backupPath?: string) => Promise<string | null>;
      getCurrentHead: (projectRoot: string, backupPath?: string) => Promise<string | null>;
      getStorageReport: (projectRoot: string, backupPath?: string) => Promise<any>;
    };
    auth: {
      login: () => Promise<void>;
      logout: () => Promise<boolean>;
      getToken: () => Promise<string | null>;
      onAuthSuccess: (callback: (token: string) => void) => () => void;
      onLogout: (callback: () => void) => () => void;
    };
    updater: {
      check: () => Promise<any>;
      download: () => Promise<any>;
      install: () => Promise<void>;
      onAvailable: (callback: (info: any) => void) => () => void;
      onDownloaded: (callback: (info: any) => void) => () => void;
      onProgress: (callback: (info: any) => void) => () => void;
      onError: (callback: (error: string) => void) => () => void;
    };
    monitor: {
      start: (dirPath: string, intervalMinutes?: number, enabled?: boolean) => Promise<boolean>;
      stop: () => Promise<boolean>;
      updateSettings: (intervalMinutes?: number, enabled?: boolean) => Promise<boolean>;
      getBufferState: () => Promise<{
        watchedDir: string | null;
        intervalMinutes: number;
        enabled: boolean;
        changes: { path: string; type: 'add' | 'change' | 'unlink'; timestamp: number }[];
        totalChanges: number;
      } | null>;
      clearBuffer: () => Promise<boolean>;
      onNotificationClicked: (callback: (data: {
        changes: { path: string; type: 'add' | 'change' | 'unlink'; timestamp: number }[];
        total: number;
        watchedDir: string;
      }) => void) => () => void;
    };

  };
}

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_MEASUREMENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
