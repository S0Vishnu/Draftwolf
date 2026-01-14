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
  getStats: (path) => electronAPI.ipcRenderer.invoke('fs:getStats', path),
  watchDir: (path) => electronAPI.ipcRenderer.invoke('fs:watchDir', path),
  downloadAddon: () => electronAPI.ipcRenderer.invoke('addon:download'),
  onFileChange: (callback) => {
    const subscription = (_event, value) => callback(value);
    return electronAPI.ipcRenderer.on('fs:fileChanged', subscription);
  },
  confirm: (options) => electronAPI.ipcRenderer.invoke('dialog:confirm', options),
  quitApp: () => electronAPI.ipcRenderer.send('app:quit'),
  draft: {
    init: (projectRoot) => electronAPI.ipcRenderer.invoke('draft:init', projectRoot),
    commit: (projectRoot, label, files) => electronAPI.ipcRenderer.invoke('draft:commit', { projectRoot, label, files }),
    getHistory: (projectRoot) => electronAPI.ipcRenderer.invoke('draft:history', projectRoot),
    restore: (projectRoot, versionId) => electronAPI.ipcRenderer.invoke('draft:restore', { projectRoot, versionId }),
    delete: (projectRoot, versionId) => electronAPI.ipcRenderer.invoke('draft:delete', { projectRoot, versionId }),
    extract: (projectRoot, versionId, relativePath, destPath) => electronAPI.ipcRenderer.invoke('draft:extract', { projectRoot, versionId, relativePath, destPath }),
    saveAttachment: (projectRoot, filePath) => electronAPI.ipcRenderer.invoke('draft:saveAttachment', { projectRoot, filePath }),
    saveMetadata: (projectRoot, relativePath, metadata) => electronAPI.ipcRenderer.invoke('draft:saveMetadata', { projectRoot, relativePath, metadata }),
    getMetadata: (projectRoot, relativePath) => electronAPI.ipcRenderer.invoke('draft:getMetadata', { projectRoot, relativePath }),
    getFileVersion: (projectRoot, relativePath) => electronAPI.ipcRenderer.invoke('draft:getFileVersion', { projectRoot, relativePath })
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
    }
  }
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
  window.electron = electronAPI
  window.api = api
}
