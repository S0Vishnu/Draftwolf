import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron";
import { join, resolve } from "node:path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { DraftControlSystem } from "./services/DraftControlSystem";
import icon from "../../public/icon.png?asset";
import { autoUpdater } from "electron-updater";
import log from "electron-log";

// System tray: keep reference for menu updates; pinned folders from renderer
let tray = null;
let pinnedFoldersForTray = [];

// Secure Deep Linking & Auth
import { authManager, setupAuthIPC } from "./auth";
import { startApiServer } from "./api-server";

// Start API Server
let apiServer = startApiServer();

// Register custom protocol
const isDev = !app.isPackaged;
// macOS + Windows (prod)
app.setAsDefaultProtocolClient("myapp");

// Windows (dev mode fix)
if (process.platform === "win32" && isDev) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("myapp", process.execPath, [
      resolve(process.argv[1]),
    ]);
  }
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (gotTheLock) {
  app.on("second-instance", (event, argv, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    // Protocol handler for Windows/Linux
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    // Extract URL from argv
    // argv: [path_to_app, args..., url]
    const url = argv.find((arg) => arg.startsWith("myapp://"));
    if (url) {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
      authManager.handleDeepLink(url);
    }
  });

  // Handle open-url (macOS)
  app.on("open-url", (event, url) => {
    event.preventDefault();
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    authManager.handleDeepLink(url);
  });
} else {
  app.quit();
}

// Setup Auth IPC
setupAuthIPC();

// Listen for Auth Success and notify Renderer
authManager.on("auth-success", (token) => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("auth:success", token);
  }
});
authManager.on("logout", () => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    mainWindow.webContents.send("auth:logout");
  }
});

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon: icon, // Works for Windows and Linux (macOS uses .icns automatically)
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false, // Per internal requirement, though contextIsolation is true.
      webSecurity: false, // User requested specific security constraints? nodeIntegration: false, contextIsolation: true.
      // The user code existing had webSecurity: false. I will leave it but ensure contextIsolation is true (default).
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // FORCE CORS Allow for Firebase Storage and other external APIs
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders };
      // Force allow origin
      responseHeaders["Access-Control-Allow-Origin"] = ["*"];
      responseHeaders["Access-Control-Allow-Headers"] = ["*"];
      responseHeaders["Access-Control-Allow-Methods"] = [
        "GET, HEAD, POST, PUT, DELETE, OPTIONS",
      ];

      // Remove conflicting headers if any
      delete responseHeaders["access-control-allow-origin"];
      delete responseHeaders["access-control-allow-headers"];
      delete responseHeaders["access-control-allow-methods"];

      callback({ responseHeaders });
    },
  );

  // Also ensure we don't send a restricted Origin that confuses the server (optional but good)
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      const requestHeaders = { ...details.requestHeaders };
      // Some servers reject file:// origin
      if (requestHeaders.Origin === "file://" || !requestHeaders.Origin) {
        requestHeaders.Origin = "https://draftflow-app.local"; // Fake origin
      }
      callback({ requestHeaders });
    },
  );

  mainWindow.on("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();

    // Check initial auth state
    authManager.init().then((token) => {
      if (token) {
        mainWindow.webContents.send("auth:success", token);
      }
    });

    // Handle Cold Start Deep Link (Windows/Linux)
    if (process.platform === "win32" || process.platform === "linux") {
      const url = process.argv.find((arg) => arg.startsWith("myapp://"));
      if (url) {
        // Add a small delay/log to ensure window is ready? valid for ready-to-show.
        console.log("Processing Cold Start Deep Link:", url);
        authManager.handleDeepLink(url);
      }
    }
  });

  // Close to system tray instead of quitting
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    if (tray) tray.destroy();
    tray = null;
  });

  // System tray with DraftWolf icon
  const trayIcon = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 });
  if (trayIcon.isEmpty()) {
    tray = new Tray(icon);
  } else {
    tray = new Tray(trayIcon);
  }
  tray.setToolTip("DraftWolf");

  function buildTrayMenu() {
    const pinnedSubmenu =
      pinnedFoldersForTray.length > 0
        ? pinnedFoldersForTray.map((f) => ({
            label: (f.name || f.path).slice(0, 50),
            click: () => {
              const win = BrowserWindow.getAllWindows()[0];
              if (win) {
                win.show();
                win.focus();
                win.webContents.send("tray:open-folder", f.path);
              }
            },
          }))
        : [{ label: "No pinned folders", enabled: false }];

    return Menu.buildFromTemplate([
      { label: "Open DraftWolf", click: () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          win.show();
          win.focus();
        }
      }},
      { type: "separator" },
      { label: "Pinned folders", submenu: pinnedSubmenu },
      { type: "separator" },
      { label: "Settings", click: () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          win.show();
          win.focus();
          win.webContents.send("tray:navigate", "/settings");
        }
      }},
      { type: "separator" },
      { label: "Quit", click: () => {
        app.isQuitting = true;
        app.quit();
      }},
    ]);
  }

  tray.setContextMenu(buildTrayMenu());
  tray.on("click", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.show();
      win.focus();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // Allow Google/Firebase Auth popups if any (though we are moving to system browser)
    // We strictly use system browser for external links now as per requirement
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.draftwolf.app");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  // Local Theme Development Watcher
  if (is.dev) {
    (async () => {
      try {
        const fs = require('node:fs/promises');
        const path = require('node:path');
        const chokidar = require('chokidar');
        
        const localThemeDir = path.join(__dirname, '../../theme');
        const userDataPath = app.getPath("userData");
        const installedThemeDir = path.join(userDataPath, 'themes', 'dracula');

        const syncLocalTheme = async () => {
          try {
            await fs.access(localThemeDir);
            await fs.mkdir(installedThemeDir, { recursive: true });
            await fs.cp(localThemeDir, installedThemeDir, { recursive: true });
            console.log('[Dev] Synced local theme to installed themes');
          } catch (e) {
            // Ignore if local theme doesn't exist
            if (e.code !== 'ENOENT') {
              console.error('[Dev] Failed to sync local theme:', e);
            }
          }
        };

        // Initial sync
        await syncLocalTheme();

        // Watch
        chokidar.watch(localThemeDir, { ignoreInitial: true }).on('all', async (event, path) => {
          console.log(`[Dev] Theme file changed: ${event} ${path}`);
          await syncLocalTheme();
        });
        console.log('[Dev] Watching local theme directory:', localThemeDir);
      } catch (e) {
        console.error('[Dev] Failed to setup theme watcher:', e);
      }
    })();
  }
});

// IPC test
ipcMain.on("ping", () => console.log("pong"));

ipcMain.on("app:quit", () => {
  app.isQuitting = true;
  app.quit();
});

ipcMain.on("tray:set-pinned-folders", (_, folders) => {
  pinnedFoldersForTray = Array.isArray(folders) ? folders : [];
  if (tray) {
    const pinnedSubmenu =
      pinnedFoldersForTray.length > 0
        ? pinnedFoldersForTray.map((f) => ({
            label: (f.name || f.path).slice(0, 50),
            click: () => {
              const win = BrowserWindow.getAllWindows()[0];
              if (win) {
                win.show();
                win.focus();
                win.webContents.send("tray:open-folder", f.path);
              }
            },
          }))
        : [{ label: "No pinned folders", enabled: false }];
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open DraftWolf", click: () => {
          const win = BrowserWindow.getAllWindows()[0];
          if (win) {
            win.show();
            win.focus();
          }
        }},
        { type: "separator" },
        { label: "Pinned folders", submenu: pinnedSubmenu },
        { type: "separator" },
        { label: "Settings", click: () => {
          const win = BrowserWindow.getAllWindows()[0];
          if (win) {
            win.show();
            win.focus();
            win.webContents.send("tray:navigate", "/settings");
          }
        }},
        { type: "separator" },
        { label: "Quit", click: () => {
          app.isQuitting = true;
          app.quit();
        }},
      ])
    );
  }
});

ipcMain.handle("app:getVersion", () => {
  return app.getVersion();
});

ipcMain.handle("dialog:openFile", async (_, options) => {
  const { canceled, filePaths } = await import("electron").then((mod) =>
    mod.dialog.showOpenDialog({
      properties: ["openFile"],
      filters: options?.filters,
    }),
  );
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

ipcMain.handle("dialog:openFolder", async () => {
  const { canceled, filePaths } = await import("electron").then((mod) =>
    mod.dialog.showOpenDialog({
      properties: ["openDirectory"],
    }),
  );
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

ipcMain.handle("dialog:confirm", async (event, options) => {
  const { dialog, BrowserWindow } = await import("electron");
  const win = BrowserWindow.fromWebContents(event.sender);
  const { response } = await dialog.showMessageBox(win, {
    type: "question",
    buttons: ["Yes", "No"],
    defaultId: 0,
    cancelId: 1,
    title: "Confirm",
    message: "Are you sure?",
    noLink: true, // Common style for alerts
    ...options,
  });
  return response === 0;
});

ipcMain.handle("download:file", async (_, { url, suggestedFileName }) => {
  const { dialog, app } = await import("electron");
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  const defaultPath = suggestedFileName
    ? path.join(app.getPath("downloads"), suggestedFileName)
    : app.getPath("downloads");

  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath,
    title: "Save extension",
  });

  if (canceled || !filePath) {
    return { success: false, error: "Canceled" };
  }

  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) {
      return { success: false, error: `Download failed: ${response.status} ${response.statusText}` };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message || "Download failed" };
  }
});

ipcMain.handle("fs:readDir", async (_, dirPath) => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dirents = await fs.readdir(dirPath, { withFileTypes: true });
  // We'll map stat manually later if needed, but for list view this is fast
  return dirents
    .filter((dirent) => dirent.name !== ".draft")
    .map((dirent) => ({
      name: dirent.name,
      isDirectory: dirent.isDirectory(),
      path: path.join(dirPath, dirent.name),
    }));
});

ipcMain.handle("fs:createFolder", async (_, folderPath) => {
  try {
    const fs = await import("node:fs/promises");
    await fs.mkdir(folderPath);
    return { success: true };
  } catch (error) {
    console.error("Failed to create folder:", error);
    let msg = "Failed to create folder";
    if (error.code === "EEXIST") msg = "Folder already exists";
    return { success: false, error: msg };
  }
});

ipcMain.handle("fs:createFile", async (_, filePath) => {
  try {
    const fs = await import("node:fs/promises");
    // Use 'wx' flag to fail if path exists
    await fs.writeFile(filePath, "", { flag: "wx" });
    return { success: true };
  } catch (error) {
    console.error("Failed to create file:", error);
    let msg = "Failed to create file";
    if (error.code === "EEXIST") msg = "File already exists";
    return { success: false, error: msg };
  }
});

ipcMain.handle("fs:writeFile", async (_, { path, content }) => {
  try {
    const fs = await import("node:fs/promises");
    await fs.writeFile(path, content, "utf-8");
    return { success: true };
  } catch (error) {
    console.error("Failed to write file:", error);
    return { success: false, error: "Failed to write file" };
  }
});

ipcMain.handle("fs:deleteEntry", async (_, targetPath) => {
  try {
    const fs = await import("node:fs/promises");
    await fs.rm(targetPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error("Failed to delete entry:", error);
    return false;
  }
});

ipcMain.handle("fs:renameEntry", async (_, { oldPath, newPath }) => {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    // Check if destination exists
    try {
      await fs.access(newPath);
      // If it exists, check if it's just a case change on the same file (Windows)
      const isCaseRename =
        process.platform === "win32" &&
        oldPath.toLowerCase() === newPath.toLowerCase();
      const isSameFile = oldPath === newPath;

      if (!isCaseRename && !isSameFile) {
        return {
          success: false,
          error: "A file or folder with this name already exists",
        };
      }
    } catch (e) {
      if (e.code !== "ENOENT") {
        throw e;
      }
    }

    await fs.rename(oldPath, newPath);

    // Attempt to move metadata if we are in a tracked project
    try {
      // We can check if oldPath is inside a project
      // We need to find project root from oldPath
      // Since DraftControlSystem class is imported, we can use the static method if we exposed it,
      // but `DraftControlSystem` is a default export in the file I viewed?
      // Actually it was `export class DraftControlSystem`.
      const projectRoot = await DraftControlSystem.findProjectRoot(
        path.dirname(oldPath),
      );
      if (projectRoot) {
        const dcs = new DraftControlSystem(projectRoot);
        const oldRel = path.relative(projectRoot, oldPath);
        const newRel = path.relative(projectRoot, newPath);
        await dcs.moveMetadata(oldRel, newRel);
      }
    } catch (e) {
      console.error("Failed to move metadata on rename:", e);
      // Don't fail the rename operation just because metadata move failed
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to rename entry:", error);
    return { success: false, error: "Failed to rename entry" };
  }
});

// ... (keeping existing handlers)

ipcMain.handle("draft:saveAttachment", async (_, { projectRoot, filePath }) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    const internalPath = await dcs.saveAttachment(filePath);
    return { success: true, path: internalPath };
  } catch (e) {
    console.error("Failed to save attachment:", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle(
  "draft:saveMetadata",
  async (_, { projectRoot, relativePath, metadata }) => {
    try {
      const dcs = new DraftControlSystem(projectRoot);
      await dcs.saveMetadata(relativePath, metadata);
      return true;
    } catch (e) {
      console.error("Failed to save metadata:", e);
      return false;
    }
  },
);

ipcMain.handle(
  "draft:getMetadata",
  async (_, { projectRoot, relativePath }) => {
    try {
      const dcs = new DraftControlSystem(projectRoot);
      const meta = await dcs.getMetadata(relativePath);
      return meta;
    } catch (e) {
      console.error("Failed to get metadata:", e);
      return null;
    }
  },
);

ipcMain.handle("fs:copyEntry", async (_, { sourcePath, destPath }) => {
  try {
    const fs = await import("node:fs/promises");
    // cp is available in Node 16.7.0+
    await fs.cp(sourcePath, destPath, { recursive: true });
    return true;
  } catch (error) {
    console.error("Failed to copy entry:", error);
    return false;
  }
});

ipcMain.handle("fs:showInFolder", async (_, targetPath) => {
  shell.showItemInFolder(targetPath);
  return true;
});

ipcMain.handle("fs:openPath", async (_, targetPath) => {
  try {
    await shell.openPath(targetPath);
    return true;
  } catch (e) {
    console.error("Failed to open path:", e);
    return false;
  }
});

ipcMain.handle("fs:readFile", async (_, filePath) => {
  try {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(filePath, "utf-8");
    return { success: true, content };
  } catch (error) {
    console.error("Failed to read file:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("fs:getStats", async (_, targetPath) => {
  try {
    const fs = await import("node:fs/promises");
    const stats = await fs.stat(targetPath);
    return {
      size: stats.size,
      mtime: stats.mtime,
      birthtime: stats.birthtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    console.error("Failed to get stats:", error);
    return null;
  }
});

ipcMain.handle("fs:getFileIcon", async (_, filePath) => {
  try {
    const icon = await app.getFileIcon(filePath);
    return icon.toDataURL();
  } catch (error) {
    console.error("Failed to get file icon:", error);
    return null;
  }
});

ipcMain.handle("shell:openExternal", async (_, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (e) {
    console.error("Failed to open external url:", e);
    return false;
  }
});

// createWindow called in whenReady

app.on("activate", function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Auto Updater
if (is.dev) {
  // Development mode: Register stub handlers to prevent "No handler registered" errors
  ipcMain.handle("update:check", () => {
    console.log("[Dev Mode] Update check skipped");
    return null;
  });

  ipcMain.handle("update:download", () => {
    console.log("[Dev Mode] Simulating update download...");
    const win = BrowserWindow.getAllWindows()[0];
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      if (win) {
        win.webContents.send("update-progress", { percent: progress });
      }
      if (progress >= 100) {
        clearInterval(interval);
        if (win) {
          win.webContents.send("update:downloaded", { version: "9.9.9" });
        }
      }
    }, 100);
    return null;
  });

  ipcMain.handle("update:install", () => {
    console.log("[Dev Mode] Update install skipped");
    return false;
  });
} else {
  autoUpdater.autoDownload = true;
  autoUpdater.logger = log;
  log.transports.file.level = "info";
  log.info("App starting...");
  autoUpdater.allowPrerelease = true;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("download-progress", (progressObj) => {
    log.info("Download Progress:", progressObj);
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send("update-progress", progressObj);
  });

  autoUpdater.on("update-available", (info) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send("update:available", info);
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded, ready to install");
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send("update:downloaded", info);
  });

  autoUpdater.on("error", (err) => {
    log.error("AutoUpdater Error:", err);
    const win = BrowserWindow.getAllWindows()[0];
    if (win)
      win.webContents.send("update:error", err.message || err.toString());
  });

  ipcMain.handle("update:check", () => {
    log.info("Checking for updates...");
    return autoUpdater.checkForUpdates();
  });

  ipcMain.handle("update:download", () => {
    log.info("Downloading update...");
    return autoUpdater.downloadUpdate();
  });

  ipcMain.handle("update:install", () => {
    log.info("Installing update...");
    // Close all windows first
    BrowserWindow.getAllWindows().forEach((window) => {
      window.close();
    });

    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 500);
    return true;
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (apiServer) {
      apiServer.close();
    }
    app.quit();
  }
});

// Watcher
let watcher = null;
ipcMain.handle("fs:watchDir", async (event, dirPath) => {
  try {
    const chokidar = await import("chokidar");
    if (watcher) {
      await watcher.close();
    }

    watcher = chokidar.watch(dirPath, {
      ignoreInitial: true,
      depth: 0, // shallow watch for performance? or undefined for recursive?
      // Usually explorer only shows current dir, so depth 0 is better for perf.
      // But if we want recursive updates for subfolders size calculation...
      // Let's stick to depth 0 (shallow) significantly reduces resource usage.
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    watcher.on("all", (event, path) => {
      // Debounce or just send? Renderer can debounce.
      // Send event to all windows or just the sender?
      // webContents.send is better.
      // But since we are in handle, we can use event.sender.
      // However, 'all' callback doesn't have event.sender.
      // We need reference to mainWindow or use BrowserWindow.getAllWindows
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("fs:fileChanged", { event, path });
      });
    });

    return true;
  } catch (error) {
    console.error("Failed to watch dir:", error);
    return false;
  }
});

// --- Draft Control System ---

ipcMain.handle("draft:init", async (_, projectRoot) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    await dcs.init();
    return true;
  } catch (e) {
    console.error("Draft Init Failed:", e);
    return false;
  }
});

ipcMain.handle("draft:commit", async (_, { projectRoot, label, files }) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    const versionId = await dcs.commit(label, files);
    return { success: true, versionId };
  } catch (e) {
    console.error("Draft Commit Failed:", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("draft:history", async (_, { projectRoot, relativePath }) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    const history = await dcs.getHistory(relativePath);
    return history;
  } catch (e) {
    console.error("Draft History Failed:", e);
    return [];
  }
});

ipcMain.handle("draft:restore", async (_, { projectRoot, versionId }) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    await dcs.restore(versionId);
    return { success: true };
  } catch (e) {
    console.error("Draft Restore Failed:", e);
    return { success: false, error: e.message || e.toString(), code: e.code };
  }
});

ipcMain.handle("draft:delete", async (_, { projectRoot, versionId }) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    await dcs.deleteVersion(versionId);
    return true;
  } catch (e) {
    console.error("Draft Delete Failed:", e);
    return false;
  }
});

ipcMain.handle(
  "draft:extract",
  async (_, { projectRoot, versionId, relativePath, destPath }) => {
    try {
      const dcs = new DraftControlSystem(projectRoot);
      await dcs.extractFile(versionId, relativePath, destPath);
      return true;
    } catch (e) {
      console.error("Draft Extract Failed:", e);
      throw e; // Throw to let renderer know
    }
  },
);

ipcMain.handle(
  "draft:renameVersion",
  async (_, { projectRoot, versionId, newLabel }) => {
    try {
      const dcs = new DraftControlSystem(projectRoot);
      await dcs.renameVersion(versionId, newLabel);
      return true;
    } catch (e) {
      console.error("Draft Rename Version Failed:", e);
      return false;
    }
  },
);

ipcMain.handle(
  "draft:getFileVersion",
  async (_, { projectRoot, relativePath }) => {
    try {
      const dcs = new DraftControlSystem(projectRoot);
      const version = await dcs.getLatestVersionForFile(relativePath);
      return version;
    } catch (e) {
      console.error("Draft Get File Version Failed:", e);
      return null;
    }
  },
);

ipcMain.handle("draft:getCurrentHead", async (_, projectRoot) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    return await dcs.getCurrentHead();
  } catch (e) {
    console.error("Draft Get Current Head Failed:", e);
    return null;
  }
});

ipcMain.handle("draft:storageReport", async (_, projectRoot) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    return await dcs.getStorageReport();
  } catch (e) {
    console.error("Draft Storage Report Failed:", e);
    return null;
  }
});

ipcMain.handle("draft:validate", async (_, projectRoot) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    return await dcs.validateIntegrity();
  } catch (e) {
    console.error("Draft Validate Failed:", e);
    return { valid: false, errors: [e.message] };
  }
});

// --- Theme Management ---
const getThemesDir = () => {
  const path = require("node:path");
  return path.join(app.getPath("userData"), "themes");
};

ipcMain.handle("theme:list", async () => {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const themesDir = getThemesDir();
    
    // Ensure themes directory exists
    try {
      await fs.mkdir(themesDir, { recursive: true });
    } catch (e) {
      // Directory may already exist
    }
    
    const entries = await fs.readdir(themesDir, { withFileTypes: true });
    const themes = [];
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const themeJsonPath = path.join(themesDir, entry.name, "theme.json");
        try {
          const content = await fs.readFile(themeJsonPath, "utf-8");
          const themeInfo = JSON.parse(content);
          themes.push({
            ...themeInfo,
            path: path.join(themesDir, entry.name),
          });
        } catch (e) {
          // Invalid theme, skip
          console.error(`Invalid theme at ${entry.name}:`, e.message);
        }
      }
    }
    
    return themes;
  } catch (e) {
    console.error("Theme List Failed:", e);
    return [];
  }
});

ipcMain.handle("theme:install", async (_, { repoUrl, downloadUrl }) => {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const os = await import("node:os");
    const themesDir = getThemesDir();
    
    // Ensure themes directory exists
    await fs.mkdir(themesDir, { recursive: true });
    
    // Determine download URL (use provided downloadUrl or convert repo to zip)
    const cleanRepoUrl = repoUrl.replace(/\.git\/?$/, "").replace(/\/$/, "");
    const zipUrl = downloadUrl || `${cleanRepoUrl}/archive/refs/heads/main.zip`;
    
    // Download ZIP to temp directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "draftwolf-theme-"));
    const zipPath = path.join(tempDir, "theme.zip");
    
    console.log(`Downloading theme from ${zipUrl}...`);
    const response = await fetch(zipUrl, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(zipPath, buffer);
    
    // Extract ZIP
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(zipPath);
    const extractPath = path.join(tempDir, "extracted");
    zip.extractAllTo(extractPath, true);
    
    // Find theme.json in extracted contents (may be in a subfolder)
    const findThemeJson = async (dir) => {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        if (item.isFile() && item.name === "theme.json") {
          return dir;
        }
        if (item.isDirectory()) {
          const found = await findThemeJson(itemPath);
          if (found) return found;
        }
      }
      return null;
    };
    
    const themeDir = await findThemeJson(extractPath);
    if (!themeDir) {
      throw new Error("Invalid theme: theme.json not found");
    }
    
    // Read theme.json to get theme ID
    const themeJsonPath = path.join(themeDir, "theme.json");
    const themeContent = await fs.readFile(themeJsonPath, "utf-8");
    const themeInfo = JSON.parse(themeContent);
    
    if (!themeInfo.id) {
      throw new Error("Invalid theme: missing 'id' in theme.json");
    }
    
    // Copy to themes directory
    const destDir = path.join(themesDir, themeInfo.id);
    
    // Remove existing if present
    try {
      await fs.rm(destDir, { recursive: true, force: true });
    } catch (e) {
      // May not exist
    }
    
    await fs.cp(themeDir, destDir, { recursive: true });
    
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to cleanup temp dir:", e);
    }
    
    console.log(`Theme ${themeInfo.name} installed successfully`);
    return { success: true, themeId: themeInfo.id, theme: themeInfo };
  } catch (e) {
    console.error("Theme Install Failed:", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("theme:remove", async (_, themeId) => {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const themesDir = getThemesDir();
    const themeDir = path.join(themesDir, themeId);
    
    await fs.rm(themeDir, { recursive: true, force: true });
    console.log(`Theme ${themeId} removed`);
    return { success: true };
  } catch (e) {
    console.error("Theme Remove Failed:", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("theme:readCSS", async (_, themeId) => {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const themesDir = getThemesDir();
    const cssPath = path.join(themesDir, themeId, "theme.css");
    
    const content = await fs.readFile(cssPath, "utf-8");
    return { success: true, css: content };
  } catch (e) {
    console.error("Theme Read CSS Failed:", e);
    return { success: false, error: e.message };
  }
});

