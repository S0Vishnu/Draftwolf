import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { DraftControlSystem } from './services/DraftControlSystem'
import icon from '../../public/icon.png?asset'

// Secure Deep Linking & Auth
import { authManager, setupAuthIPC } from './auth';

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
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

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
      return true;
    } catch (error) {
      console.error('Failed to create folder:', error);
      return false;
    }
  })

  ipcMain.handle('fs:createFile', async (_, filePath) => {
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(filePath, '');
      return true;
    } catch (error) {
      console.error('Failed to create file:', error);
      return false;
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

      return true;
    } catch (error) {
      console.error('Failed to rename entry:', error);
      return false;
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

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
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

ipcMain.handle('draft:history', async (_, projectRoot) => {
  try {
    const dcs = new DraftControlSystem(projectRoot);
    const history = await dcs.getHistory();
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

