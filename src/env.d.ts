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
    openFile: () => Promise<string | null>;
    openFolder: () => Promise<string | null>;
    readDir: (path: string) => Promise<{ name: string; isDirectory: boolean; path: string }[]>;
    createFolder: (path: string) => Promise<boolean>;
    createFile: (path: string) => Promise<boolean>;
    deleteEntry: (path: string) => Promise<boolean>;
    renameEntry: (oldPath: string, newPath: string) => Promise<boolean>;
    copyEntry: (sourcePath: string, destPath: string) => Promise<boolean>;
    showInFolder: (path: string) => Promise<boolean>;
    openPath: (path: string) => Promise<boolean>;
    getStats: (path: string) => Promise<{ size: number; mtime: Date; birthtime: Date; isFile: boolean; isDirectory: boolean } | null>;
    watchDir: (path: string) => Promise<boolean>;
    onFileChange: (callback: (data: { event: string; path: string }) => void) => () => void;
    confirm: (options: { message: string, title?: string, type?: string, buttons?: string[] }) => Promise<boolean>;
    quitApp: () => void;
    draft: {
      init: (projectRoot: string) => Promise<boolean>;
      commit: (projectRoot: string, label: string, files: string[]) => Promise<{ success: boolean; versionId?: string; error?: string }>;
      getHistory: (projectRoot: string) => Promise<{ id: string; label: string; timestamp: string; files: Record<string, string> }[]>;
      restore: (projectRoot: string, versionId: string) => Promise<boolean>;
      delete: (projectRoot: string, versionId: string) => Promise<boolean>;
      extract: (projectRoot: string, versionId: string, relativePath: string, destPath: string) => Promise<boolean>;
      getFileVersion: (projectRoot: string, relativePath: string) => Promise<string | null>;
    };
    auth: {
      login: () => Promise<void>;
      logout: () => Promise<boolean>;
      getToken: () => Promise<string | null>;
      onAuthSuccess: (callback: (token: string) => void) => () => void;
      onLogout: (callback: () => void) => () => void;
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
