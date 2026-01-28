import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { DraftControlSystem } from './services/DraftControlSystem'
import icon from '../../public/icon.png?asset'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

// Secure Deep Linking & Auth
import { authManager, setupAuthIPC } from './auth';
import { startApiServer } from './api-server';

// Start API Server
let apiServer = startApiServer();

// Register custom protocol
const isDev = !app.isPackaged;
// macOS + Windows (prod)
app.setAsDefaultProtocolClient("myapp");

// Windows (dev mode fix)
if (process.platform === "win32" && isDev) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(
      "myapp",
      process.execPath,
      [resolve(process.argv[1])]
    );
  }
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, argv, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    // Protocol handler for Windows/Linux
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }

    // Extract URL from argv
    // argv: [path_to_app, args..., url]
    const url = argv.find(arg => arg.startsWith('myapp://'));
    if (url) {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
      authManager.handleDeepLink(url);
    }
  })

  // Handle open-url (macOS)
  app.on('open-url', (event, url) => {
    event.preventDefault();
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    authManager.handleDeepLink(url);
  });
}

// Setup Auth IPC
setupAuthIPC();

// Listen for Auth Success and notify Renderer
authManager.on('auth-success', (token) => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('auth:success', token);
  }
});
authManager.on('logout', () => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    mainWindow.webContents.send('auth:logout');
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
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false, // Per internal requirement, though contextIsolation is true.
      webSecurity: false, // User requested specific security constraints? nodeIntegration: false, contextIsolation: true. 
      // The user code existing had webSecurity: false. I will leave it but ensure contextIsolation is true (default).
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()

    // Check initial auth state
    authManager.init().then(token => {
      if (token) {
        mainWindow.webContents.send('auth:success', token);
      }
    });
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // Allow Google/Firebase Auth popups if any (though we are moving to system browser)
    // We strictly use system browser for external links now as per requirement
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.draftwolf.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.on('app:quit', () => {
    app.quit();
  })

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  })

  ipcMain.handle('dialog:openFile', async (_, options) => {
    const { canceled, filePaths } = await import('electron').then(mod =>
      mod.dialog.showOpenDialog({
        properties: ['openFile'],
        filters: options?.filters
      })
    )
    if (canceled) {
      return null
    } else {
      return filePaths[0]
    }
  })

  ipcMain.handle('dialog:openFolder', async () => {
    const { canceled, filePaths } = await import('electron').then(mod =>
      mod.dialog.showOpenDialog({
        properties: ['openDirectory']
      })
    )
    if (canceled) {
      return null
    } else {
      return filePaths[0]
    }
  })

  ipcMain.handle('dialog:confirm', async (event, options) => {
    const { dialog, BrowserWindow } = await import('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Yes', 'No'],
      defaultId: 0,
      cancelId: 1,
      title: 'Confirm',
      message: 'Are you sure?',
      noLink: true, // Common style for alerts
      ...options
    })
    return response === 0;
  })

  ipcMain.handle('fs:readDir', async (_, dirPath) => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dirents = await fs.readdir(dirPath, { withFileTypes: true });
    // We'll map stat manually later if needed, but for list view this is fast
    return dirents
      .filter(dirent => dirent.name !== '.draft')
      .map(dirent => ({
        name: dirent.name,
        isDirectory: dirent.isDirectory(),
        path: path.join(dirPath, dirent.name)
      }));
  })

  ipcMain.handle('fs:createFolder', async (_, folderPath) => {
    try {
      const fs = await import('fs/promises');
      await fs.mkdir(folderPath);
      return { success: true };
    } catch (error) {
      console.error('Failed to create folder:', error);
      let msg = 'Failed to create folder';
      if (error.code === 'EEXIST') msg = 'Folder already exists';
      return { success: false, error: msg };
    }
  })

  ipcMain.handle('fs:createFile', async (_, filePath) => {
    try {
      const fs = await import('fs/promises');
      // Use 'wx' flag to fail if path exists
      await fs.writeFile(filePath, '', { flag: 'wx' });
      return { success: true };
    } catch (error) {
      console.error('Failed to create file:', error);
      let msg = 'Failed to create file';
      if (error.code === 'EEXIST') msg = 'File already exists';
      return { success: false, error: msg };
    }
  })

  ipcMain.handle('fs:deleteEntry', async (_, targetPath) => {
    try {
      const fs = await import('fs/promises');
      await fs.rm(targetPath, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error('Failed to delete entry:', error);
      return false;
    }
  })

  ipcMain.handle('fs:renameEntry', async (_, { oldPath, newPath }) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Check if destination exists
      try {
        await fs.access(newPath);
        // If it exists, check if it's just a case change on the same file (Windows)
        const isCaseRename = process.platform === 'win32' && oldPath.toLowerCase() === newPath.toLowerCase();
        const isSameFile = oldPath === newPath;

        if (!isCaseRename && !isSameFile) {
          return { success: false, error: 'A file or folder with this name already exists' };
        }
      } catch (e) {
        // Destination doesn't exist, proceed
      }

      await fs.rename(oldPath, newPath);

      // Attempt to move metadata if we are in a tracked project
      try {
        // We can check if oldPath is inside a project
        // We need to find project root from oldPath
        // Since DraftControlSystem class is imported, we can use the static method if we exposed it, 
        // but `DraftControlSystem` is a default export in the file I viewed? 
        // Actually it was `export class DraftControlSystem`.
        const projectRoot = await DraftControlSystem.findProjectRoot(path.dirname(oldPath));
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
      console.error('Failed to rename entry:', error);
      return { success: false, error: 'Failed to rename entry' };
    }
  })

  // ... (keeping existing handlers)

  ipcMain.handle('draft:saveAttachment', async (_, { projectRoot, filePath }) => {
    try {
      const dcs = new DraftControlSystem(projectRoot);
      const internalPath = await dcs.saveAttachment(filePath);
      return { success: true, path: internalPath };
    } catch (e) {
      console.error("Failed to save attachment:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('draft:saveMetadata', async (_, { projectRoot, relativePath, metadata }) => {
    try {
      const dcs = new DraftControlSystem(projectRoot);
      await dcs.saveMetadata(relativePath, metadata);
      return true;
    } catch (e) {
      console.error("Failed to save metadata:", e);
      return false;
    }
  });

  ipcMain.handle('draft:getMetadata', async (_, { projectRoot, relativePath }) => {
    try {
      const dcs = new DraftControlSystem(projectRoot);
      const meta = await dcs.getMetadata(relativePath);
      return meta;
    } catch (e) {
      console.error("Failed to get metadata:", e);
      return null;
    }
  });

  ipcMain.handle('fs:copyEntry', async (_, { sourcePath, destPath }) => {
    try {
      const fs = await import('fs/promises');
      // cp is available in Node 16.7.0+
      await fs.cp(sourcePath, destPath, { recursive: true });
      return true;
    } catch (error) {
      console.error('Failed to copy entry:', error);
      return false;
    }
  })

  ipcMain.handle('fs:showInFolder', async (_, targetPath) => {
    shell.showItemInFolder(targetPath);
    return true;
  })

  ipcMain.handle('fs:openPath', async (_, targetPath) => {
    try {
      await shell.openPath(targetPath);
      return true;
    } catch (e) {
      console.error("Failed to open path:", e);
      return false;
    }
  })

  ipcMain.handle('fs:getStats', async (_, targetPath) => {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(targetPath);
      return {
        size: stats.size,
        mtime: stats.mtime,
        birthtime: stats.birthtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return null;
    }
  })

  ipcMain.handle('shell:openExternal', async (_, url) => {
    try {
      await shell.openExternal(url);
      return true;
    } catch (e) {
      console.error("Failed to open external url:", e);
      return false;
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Auto Updater
  if (!is.dev) {
    autoUpdater.autoDownload = false;
    autoUpdater.logger = log;
    log.transports.file.level = "info";
    log.info("App starting...");
    autoUpdater.autoDownload = false;
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
      if (win) win.webContents.send("update:error", err.message || err.toString());
    });

    ipcMain.handle('update:check', () => {
      log.info("Checking for updates...");
      return autoUpdater.checkForUpdates();
    });

    ipcMain.handle('update:download', () => {
      log.info("Downloading update...");
      return autoUpdater.downloadUpdate();
    });

    ipcMain.handle('update:install', () => {
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
  } else {
    // Development mode: Register stub handlers to prevent "No handler registered" errors
    ipcMain.handle('update:check', () => {
      console.log('[Dev Mode] Update check skipped');
      return null;
    });

    ipcMain.handle('update:download', () => {
      console.log('[Dev Mode] Simulating update download...');
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
            win.webContents.send("update:downloaded", { version: '9.9.9' });
          }
        }
      }, 100);
      return null;
    });

    ipcMain.handle('update:install', () => {
      console.log('[Dev Mode] Update install skipped');
      return false;
    });
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (apiServer) {
      apiServer.close();
    }
    app.quit()
  }
})

// Watcher
let watcher = null;
ipcMain.handle('fs:watchDir', async (event, dirPath) => {
  try {
    const chokidar = await import('chokidar');
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
        pollInterval: 100
      }
    });

    watcher.on('all', (event, path) => {
      // Debounce or just send? Renderer can debounce.
      // Send event to all windows or just the sender?
      // webContents.send is better.
      // But since we are in handle, we can use event.sender.
      // However, 'all' callback doesn't have event.sender.
      // We need reference to mainWindow or use BrowserWindow.getAllWindows
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('fs:fileChanged', { event, path });
      });
    });

    return true;
  } catch (error) {
    console.error("Failed to watch dir:", error);
    return false;
  }
})

// --- Draft Control System ---

ipcMain.handle('draft:init', async (_, projectRoot) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    await dcs.init();
    return true;
  } catch (e) {
    console.error('Draft Init Failed:', e);
    return false;
  }
});

ipcMain.handle('draft:commit', async (_, { projectRoot, label, files }) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    const versionId = await dcs.commit(label, files);
    return { success: true, versionId };
  } catch (e) {
    console.error('Draft Commit Failed:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('draft:history', async (_, { projectRoot, relativePath }) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    const history = await dcs.getHistory(relativePath);
    return history;
  } catch (e) {
    console.error('Draft History Failed:', e);
    return [];
  }
});

ipcMain.handle('draft:restore', async (_, { projectRoot, versionId }) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    await dcs.restore(versionId);
    return true;
  } catch (e) {
    console.error('Draft Restore Failed:', e);
    return false;
  }
});

ipcMain.handle('draft:delete', async (_, { projectRoot, versionId }) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    await dcs.deleteVersion(versionId);
    return true;
  } catch (e) {
    console.error('Draft Delete Failed:', e);
    return false;
  }
});

ipcMain.handle('draft:extract', async (_, { projectRoot, versionId, relativePath, destPath }) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    await dcs.extractFile(versionId, relativePath, destPath);
    return true;
  } catch (e) {
    console.error('Draft Extract Failed:', e);
    throw e; // Throw to let renderer know
  }
});

ipcMain.handle('draft:renameVersion', async (_, { projectRoot, versionId, newLabel }) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    await dcs.renameVersion(versionId, newLabel);
    return true;
  } catch (e) {
    console.error('Draft Rename Version Failed:', e);
    return false;
  }
});

ipcMain.handle('draft:getFileVersion', async (_, { projectRoot, relativePath }) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    const version = await dcs.getLatestVersionForFile(relativePath);
    return version;
  } catch (e) {
    console.error('Draft Get File Version Failed:', e);
    return null;
  }
});

ipcMain.handle('draft:getCurrentHead', async (_, projectRoot) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    return await dcs.getCurrentHead();
  } catch (e) {
    console.error('Draft Get Current Head Failed:', e);
    return null;
  }
});

ipcMain.handle('draft:storageReport', async (_, projectRoot) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    return await dcs.getStorageReport();
  } catch (e) {
    console.error('Draft Storage Report Failed:', e);
    return null;
  }
});

ipcMain.handle('draft:validate', async (_, projectRoot) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    return await dcs.validateIntegrity();
  } catch (e) {
    console.error('Draft Validate Failed:', e);
    return { valid: false, errors: [e.message] };
  }
});

ipcMain.handle('addon:download', async () => {
  const { dialog } = await import('electron');
  const path = await import('path');
  const fs = await import('fs/promises');
  const AdmZip = (await import('adm-zip')).default;

  let sourcePath;
  if (app.isPackaged) {
    sourcePath = path.join(process.resourcesPath, 'aadons', 'draftwolf_addon.py');
  } else {
    sourcePath = path.join(__dirname, '../../aadons/draftwolf_addon.py');
  }

  // Check if file exists
  try {
    await fs.access(sourcePath);
  } catch (error) {
    console.error("Addon file not found at:", sourcePath);
    return { success: false, error: 'Addon file missing in bundle.' };
  }

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Blender Addon',
    defaultPath: 'draftwolf_addon.zip',
    filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
  });

  if (canceled || !filePath) return { success: false, userCancelled: true };

  try {
    const zip = new AdmZip();
    zip.addLocalFile(sourcePath);
    zip.writeZip(filePath);
    return { success: true };
  } catch (err) {
    console.error('Failed to save addon:', err);
    return { success: false, error: err.message };
  }
});

