import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  openFile: (options) => electronAPI.ipcRenderer.invoke('dialog:openFile', options),
  openFolder: () => electronAPI.ipcRenderer.invoke('dialog:openFolder'),
  readDir: (path) => electronAPI.ipcRenderer.invoke('fs:readDir', path),
  createFolder: (path) => electronAPI.ipcRenderer.invoke('fs:createFolder', path),
  createFile: (path) => electronAPI.ipcRenderer.invoke('fs:createFile', path),
  deleteEntry: (path) => electronAPI.ipcRenderer.invoke('fs:deleteEntry', path),
  renameEntry: (oldPath, newPath) => electronAPI.ipcRenderer.invoke('fs:renameEntry', { oldPath, newPath }),
  copyEntry: (sourcePath, destPath) => electronAPI.ipcRenderer.invoke('fs:copyEntry', { sourcePath, destPath }),
  showInFolder: (path) => electronAPI.ipcRenderer.invoke('fs:showInFolder', path),
  openPath: (path) => electronAPI.ipcRenderer.invoke('fs:openPath', path),
  readFile: (path) => electronAPI.ipcRenderer.invoke('fs:readFile', path),
  openExternal: (url) => electronAPI.ipcRenderer.invoke('shell:openExternal', url),
  getStats: (path) => electronAPI.ipcRenderer.invoke('fs:getStats', path),
  getFileIcon: (path) => electronAPI.ipcRenderer.invoke('fs:getFileIcon', path),
  watchDir: (path) => electronAPI.ipcRenderer.invoke('fs:watchDir', path),
  onFileChange: (callback) => {
    const subscription = (_event, value) => callback(value);
    return electronAPI.ipcRenderer.on('fs:fileChanged', subscription);
  },
  confirm: (options) => electronAPI.ipcRenderer.invoke('dialog:confirm', options),
  downloadFile: (url, suggestedFileName) => electronAPI.ipcRenderer.invoke('download:file', { url, suggestedFileName }),
  quitApp: () => electronAPI.ipcRenderer.send('app:quit'),
  getAppVersion: () => electronAPI.ipcRenderer.invoke('app:getVersion'),
  setPinnedFoldersForTray: (folders) => electronAPI.ipcRenderer.send('tray:set-pinned-folders', folders),
  onTrayOpenFolder: (callback) => {
    const sub = (_event, path) => callback(path);
    electronAPI.ipcRenderer.on('tray:open-folder', sub);
    return () => electronAPI.ipcRenderer.removeListener('tray:open-folder', sub);
  },
  onTrayNavigate: (callback) => {
    const sub = (_event, path) => callback(path);
    electronAPI.ipcRenderer.on('tray:navigate', sub);
    return () => electronAPI.ipcRenderer.removeListener('tray:navigate', sub);
  },
  draft: {
    init: (projectRoot, backupPath) => electronAPI.ipcRenderer.invoke('draft:init', { projectRoot, backupPath }),
    commit: (projectRoot, label, files, backupPath) => electronAPI.ipcRenderer.invoke('draft:commit', { projectRoot, label, files, backupPath }),
    createSnapshot: (projectRoot, folderPath, label, backupPath) => electronAPI.ipcRenderer.invoke('draft:createSnapshot', { projectRoot, folderPath, label, backupPath }),
    getHistory: (projectRoot, relativePath, backupPath) => electronAPI.ipcRenderer.invoke('draft:history', { projectRoot, relativePath, backupPath }),
    restore: (projectRoot, versionId, backupPath) => electronAPI.ipcRenderer.invoke('draft:restore', { projectRoot, versionId, backupPath }),
    delete: (projectRoot, versionId, backupPath) => electronAPI.ipcRenderer.invoke('draft:delete', { projectRoot, versionId, backupPath }),
    renameVersion: (projectRoot, versionId, newLabel, backupPath) => electronAPI.ipcRenderer.invoke('draft:renameVersion', { projectRoot, versionId, newLabel, backupPath }),
    extract: (projectRoot, versionId, relativePath, destPath, backupPath) => electronAPI.ipcRenderer.invoke('draft:extract', { projectRoot, versionId, relativePath, destPath, backupPath }),
    saveAttachment: (projectRoot, filePath, backupPath) => electronAPI.ipcRenderer.invoke('draft:saveAttachment', { projectRoot, filePath, backupPath }),
    saveMetadata: (projectRoot, relativePath, metadata, backupPath) => electronAPI.ipcRenderer.invoke('draft:saveMetadata', { projectRoot, relativePath, metadata, backupPath }),
    getMetadata: (projectRoot, relativePath, backupPath) => electronAPI.ipcRenderer.invoke('draft:getMetadata', { projectRoot, relativePath, backupPath }),
    saveProjectMetadata: (projectRoot, metadata, backupPath) => electronAPI.ipcRenderer.invoke('draft:saveProjectMetadata', { projectRoot, metadata, backupPath }),
    getProjectMetadata: (projectRoot, backupPath) => electronAPI.ipcRenderer.invoke('draft:getProjectMetadata', { projectRoot, backupPath }),
    getFileVersion: (projectRoot, relativePath, backupPath) => electronAPI.ipcRenderer.invoke('draft:getFileVersion', { projectRoot, relativePath, backupPath }),
    getCurrentHead: (projectRoot, backupPath) => electronAPI.ipcRenderer.invoke('draft:getCurrentHead', { projectRoot, backupPath }),
    getStorageReport: (projectRoot, backupPath) => electronAPI.ipcRenderer.invoke('draft:storageReport', { projectRoot, backupPath })
  },
  auth: {
    login: () => electronAPI.ipcRenderer.invoke('auth:login'),
    logout: () => electronAPI.ipcRenderer.invoke('auth:logout'),
    getToken: () => electronAPI.ipcRenderer.invoke('auth:getToken'),
    onAuthSuccess: (callback) => {
      const subscription = (_event, token) => callback(token);
      return electronAPI.ipcRenderer.on('auth:success', subscription);
    },
    onLogout: (callback) => {
      const subscription = () => callback();
      return electronAPI.ipcRenderer.on('auth:logout', subscription);
    }
  },
  updater: {
    check: () => electronAPI.ipcRenderer.invoke('update:check'),
    download: () => electronAPI.ipcRenderer.invoke('update:download'),
    install: () => electronAPI.ipcRenderer.invoke('update:install'),
    onAvailable: (callback) => {
      const sub = (_event, info) => callback(info);
      return electronAPI.ipcRenderer.on('update:available', sub);
    },
    onDownloaded: (callback) => {
      const sub = (_event, info) => callback(info);
      return electronAPI.ipcRenderer.on('update:downloaded', sub);
    },
    onProgress: (callback) => {
      const sub = (_event, info) => callback(info);
      return electronAPI.ipcRenderer.on('update-progress', sub);
    },
    onError: (callback) => {
      const sub = (_event, error) => callback(error);
      return electronAPI.ipcRenderer.on('update:error', sub);
    }
  },
  monitor: {
    start: (dirPath, intervalMinutes, enabled) => electronAPI.ipcRenderer.invoke('monitor:start', { dirPath, intervalMinutes, enabled }),
    stop: () => electronAPI.ipcRenderer.invoke('monitor:stop'),
    updateSettings: (intervalMinutes, enabled) => electronAPI.ipcRenderer.invoke('monitor:updateSettings', { intervalMinutes, enabled }),
    getBufferState: () => electronAPI.ipcRenderer.invoke('monitor:getBufferState'),
    clearBuffer: () => electronAPI.ipcRenderer.invoke('monitor:clearBuffer'),
    testNotification: () => electronAPI.ipcRenderer.invoke('monitor:testNotification'),
    onNotificationClicked: (callback) => {
      const sub = (_event, data) => callback(data);
      electronAPI.ipcRenderer.on('monitor:notification-clicked', sub);
      return () => electronAPI.ipcRenderer.removeListener('monitor:notification-clicked', sub);
    }
  },

}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  globalThis.electron = electronAPI
  globalThis.api = api
}
