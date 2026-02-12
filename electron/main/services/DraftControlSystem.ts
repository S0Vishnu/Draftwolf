import fs from 'fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { createBrotliCompress, createBrotliDecompress } from 'zlib';

// --- Types ---

export type Hash = string;

export interface FileMetadata {
  size: number; // Original size
  compressedSize: number; // Size on disk (in objects/)
  isCompressed: boolean;
  refCount: number;
  path?: string; // Original relative path for debugging/recovery
}

export interface VersionIndex {
  objects: Record<Hash, FileMetadata>;
  latestVersion: string | null;
  currentHead: string | null; // Track the currently checked-out version
}

export interface VersionManifest {
  id: string;
  versionNumber: string; // "1.0", "1.1", "2.0"
  label: string;
  timestamp: string;
  files: Record<string, Hash>;
  fileIds?: Record<string, string>; // Mapping of relativePath -> unique file ID
  parentId: string | null;
  totalSize?: number;
  totalCompressedSize?: number;
  scope?: string; // The relative folder path this snapshot was created for
}

export interface FileMetadataStore {
  id: string;
  path: string;
  previousPaths: string[];
  renamedTo?: string;
  tags?: string[];
  tasks?: any[];
  attachments?: any[];
  [key: string]: any;
}

// --- Constants ---

const DRAFT_DIR = '.draft';
const OBJECTS_DIR = 'objects';
const VERSIONS_DIR = 'versions';
const INDEX_FILE = 'index.json';

// --- Core System ---

export class DraftControlSystem {
  private projectRoot: string;
  private draftPath: string;
  private objectsPath: string;
  private versionsPath: string;
  private indexPath: string;

  constructor(projectRoot: string, storageRoot?: string) {
    this.projectRoot = projectRoot;
    // If storageRoot is provided, use it for .draft location. Otherwise default to projectRoot.
    const rootForDraft = storageRoot || projectRoot;
    this.draftPath = path.join(rootForDraft, DRAFT_DIR);
    this.objectsPath = path.join(this.draftPath, OBJECTS_DIR);
    this.versionsPath = path.join(this.draftPath, VERSIONS_DIR);
    this.indexPath = path.join(this.draftPath, INDEX_FILE);
  }

  /**
   * Initialize the .draft directory structure if it doesn't exist.
   */
  async init(): Promise<void> {
    if (!existsSync(this.draftPath)) {
      await fs.mkdir(this.draftPath, { recursive: true });
      await fs.mkdir(this.objectsPath, { recursive: true });
      await fs.mkdir(this.versionsPath, { recursive: true });
      await fs.mkdir(path.join(this.draftPath, 'metadata'), { recursive: true });
      await fs.mkdir(path.join(this.draftPath, 'attachments'), { recursive: true });

      this.hideDraftFolder();

      const initialIndex: VersionIndex = {
        objects: {},
        latestVersion: null,
        currentHead: null
      };
      await this.writeIndex(initialIndex);
    } else {
      // Ensure subdirs exist even if root exists
      if (!existsSync(this.objectsPath)) await fs.mkdir(this.objectsPath, { recursive: true });
      if (!existsSync(this.versionsPath)) await fs.mkdir(this.versionsPath, { recursive: true });
      if (!existsSync(path.join(this.draftPath, 'metadata'))) await fs.mkdir(path.join(this.draftPath, 'metadata'), { recursive: true });
      if (!existsSync(path.join(this.draftPath, 'attachments'))) await fs.mkdir(path.join(this.draftPath, 'attachments'), { recursive: true });

      // Ensure hidden state is enforced (idempotent-ish)
      if (!this.isHiddenChecked) {
        this.hideDraftFolder();
      }
    }
  }

  private isHiddenChecked = false;

  private hideDraftFolder() {
    if (process.platform === 'win32') {
      // Use attrib +h +s +r to make it a hidden system folder (effectively read-only/protected in Explorer UI)
      const { exec } = require('child_process');
      exec(`attrib +h +s +r "${this.draftPath}"`, (error: any) => {
        if (error) {
          // console.error("Failed to secure .draft folder:", error);
        } else {
          this.isHiddenChecked = true;
        }
      });
    }
  }

  // --- Metadata & Attachments ---

  /**
   * Save an attachment file to the internal storage.
   * Returns the relative path within .draft (e.g. "attachments/<hash>.png")
   */
  async saveAttachment(filePath: string): Promise<string> {
    await this.init();
    // 1. Hash the content
    const hash = await this.hashFile(filePath);
    const ext = path.extname(filePath);
    const filename = `${hash}${ext}`;
    const destPath = path.join(this.draftPath, 'attachments', filename);

    // 2. Copy if not exists
    if (!existsSync(destPath)) {
      await fs.copyFile(filePath, destPath);
    }

    return `attachments/${filename}`;
  }

  /**
   * Save metadata (tasks, attachment refs) for a specific file.
   */
  async saveMetadata(relativePath: string, metadata: any): Promise<void> {
    await this.init();
    const norm = this.normalizePath(relativePath);
    const hash = this.hashString(norm);
    const metaFilePath = path.join(this.draftPath, 'metadata', `${hash}.json`);

    // Ensure path is stored in metadata for rename/recovery support
    const enrichedMetadata = {
      ...metadata,
      path: norm
    };

    await this.writeJson(metaFilePath, enrichedMetadata);
  }

  /**
   * Get metadata for a specific file.
   */
  async getMetadata(relativePath: string): Promise<any> {
    const hash = this.hashString(this.normalizePath(relativePath));
    const metaFilePath = path.join(this.draftPath, 'metadata', `${hash}.json`);
    if (existsSync(metaFilePath)) {
      return await this.readJson(metaFilePath);
    }
    return null;
  }

  /**
   * Save project-wide metadata.
   */
  async saveProjectMetadata(metadata: any): Promise<void> {
    await this.init();
    const metaFilePath = path.join(this.draftPath, 'metadata.json');
    await this.writeJson(metaFilePath, metadata);
  }

  /**
   * Get project-wide metadata.
   */
  async getProjectMetadata(): Promise<any> {
    const metaFilePath = path.join(this.draftPath, 'metadata.json');
    if (existsSync(metaFilePath)) {
      return await this.readJson(metaFilePath);
    }
    return null;
  }

  /**
   * Get or create a unique ID for a file/folder from its metadata.
   */
  async getOrCreateFileId(relativePath: string): Promise<string> {
    const normPath = this.normalizePath(relativePath);
    let meta = await this.getMetadata(normPath);

    if (!meta) {
      meta = { id: crypto.randomUUID() };
      await this.saveMetadata(normPath, meta);
    } else if (!meta.id) {
      meta.id = crypto.randomUUID();
      await this.saveMetadata(normPath, meta);
    }

    return meta.id;
  }

  /**
   * Get existing ID for a path without creating one.
   */
  async getFileId(relativePath: string): Promise<string | null> {
    const meta = await this.getMetadata(this.normalizePath(relativePath));
    return meta?.id || null;
  }

  /**
   * Move metadata from one file path to another (used during rename).
   * Keeps old metadata files to preserve bidirectional linking.
   */
  async moveMetadata(oldRelativePath: string, newRelativePath: string): Promise<void> {
    const oldNorm = this.normalizePath(oldRelativePath);
    const newNorm = this.normalizePath(newRelativePath);

    const metadataDir = path.join(this.draftPath, 'metadata');
    if (!existsSync(metadataDir)) return;

    // 1. Identify all metadata entries that need to move
    const files = await fs.readdir(metadataDir);
    const metadataToMove: { oldPath: string, newPath: string, oldFile: string }[] = [];

    let directMatchHandledByPath = false;
    const oldHash = this.hashString(oldNorm);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const metaPath = path.join(metadataDir, file);
      try {
        const meta = await this.readJson(metaPath);
        if (meta && meta.path) {
          const itemPath = this.normalizePath(meta.path);

          // Case-insensitive check for robustness (especially on Windows)
          if (itemPath === oldNorm || itemPath.toLowerCase() === oldNorm.toLowerCase()) {
            metadataToMove.push({ oldPath: itemPath, newPath: newNorm, oldFile: file });
            directMatchHandledByPath = true;
          } else {
            // Check for directory resize/move (prefix match)
            // Fix: ensure we match against folder boundary to avoid partial name matches (e.g. /myfolder vs /myfolder2)
            // And handle case-insensitivity
            const itemPathLower = itemPath.toLowerCase();
            const oldNormLower = oldNorm.toLowerCase();

            if (itemPath.startsWith(oldNorm + '/') || itemPathLower.startsWith(oldNormLower + '/')) {
              // If it was a case-insensitive match, we need to be careful with string replacement
              // But for simplicity in moving, we can just replace the prefix.
              // However, if casings are mixed, substring might not work perfectly.
              // Let's use the actual matched suffix.

              let suffix = "";
              if (itemPath.startsWith(oldNorm + '/')) {
                suffix = itemPath.substring(oldNorm.length);
              } else {
                // Case insensitive match
                suffix = itemPath.substring(oldNorm.length);
              }

              metadataToMove.push({ oldPath: itemPath, newPath: newNorm + suffix, oldFile: file });
            }
          }
        }
      } catch (e) {
        console.error(`Failed to read metadata for ${file} during rename scan:`, e);
      }
    }

    // 2. Handling legacy direct match (files without .path property in JSON)
    if (!directMatchHandledByPath) {
      const oldMetaPath = path.join(metadataDir, `${oldHash}.json`);
      if (existsSync(oldMetaPath)) {
        metadataToMove.push({ oldPath: oldNorm, newPath: newNorm, oldFile: `${oldHash}.json` });
      }
    }

    // 3. Execute renames and update properties
    for (const task of metadataToMove) {
      const oldFile = path.join(metadataDir, task.oldFile);
      try {
        const meta = await this.readJson(oldFile);

        // Ensure ID exists
        if (!meta.id) meta.id = crypto.randomUUID();
        const fileId = meta.id;

        // Track history of paths
        const prevPaths = new Set(meta.previousPaths || []);
        prevPaths.add(task.oldPath);
        meta.previousPaths = Array.from(prevPaths);

        // Create new metadata for the new path
        const newMeta = {
          ...meta,
          path: task.newPath
        };

        const newHash = this.hashString(task.newPath);
        const newFile = path.join(metadataDir, `${newHash}.json`);

        // Write new metadata file
        await this.writeJson(newFile, newMeta);

        // Update old metadata to point to new path (bidirectional linking)
        // Keep the old file but mark it as renamed
        const oldMeta = {
          ...meta,
          path: task.oldPath,
          renamedTo: task.newPath,
          id: fileId // Ensure same ID for linking
        };

        // Only update old file if it's different from new file
        if (newHash !== task.oldFile.replace('.json', '')) {
          await this.writeJson(oldFile, oldMeta);
        }
      } catch (e) {
        console.error(`Failed to move metadata task ${task.oldPath} -> ${task.newPath}:`, e);
      }
    }
  }

  // --- Static Helpers ---

  static async findProjectRoot(startPath: string): Promise<string | null> {
    let current = startPath;
    const fs = await import('fs/promises');
    const path = await import('path');

    while (true) {
      const check = path.join(current, '.draft');
      try {
        await fs.access(check);
        return current;
      } catch {
        // Not here
      }

      const parent = path.dirname(current);
      if (parent === current) return null; // Root reached
      current = parent;
    }
  }

  // --- Utils ---

  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  private hashString(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Create a new version snapshot.
   */
  /**
   * Create a new snapshot of a folder.
   */
  async createSnapshot(folderPath: string, label: string): Promise<string> {
    await this.init();
    const index = await this.readIndex();
    const fileHashes: Record<string, Hash> = {};
    const fileIds: Record<string, string> = {};
    const newObjects: Record<Hash, FileMetadata> = {};

    // Normalize folderPath to be relative and use forward slashes
    let scope = this.normalizePath(folderPath);
    if (path.isAbsolute(folderPath) && folderPath.startsWith(this.projectRoot)) {
      scope = this.normalizePath(path.relative(this.projectRoot, folderPath));
    }
    if (scope === '') scope = '.';

    // 1. Recursively scan and process files
    const scanDir = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.projectRoot, fullPath);

        if (entry.isDirectory()) {
          if (entry.name !== '.draft') { // Skip .draft folder
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          // Process file
          const { hash, originalSize, compressedSize } = await this.addFileToCAS(fullPath);

          // Get or create ID
          const id = await this.getOrCreateFileId(relativePath);

          fileHashes[relativePath] = hash;
          fileIds[relativePath] = id;

          if (!index.objects[hash]) {
            newObjects[hash] = {
              size: originalSize,
              compressedSize: compressedSize,
              isCompressed: true,
              refCount: 0,
              path: relativePath
            };
          }
        }
      }));
    };

    const absoluteScanPath = path.resolve(this.projectRoot, scope);
    if (!existsSync(absoluteScanPath)) {
      // If it was meant to be ".", and doesn't exist? (unlikely)
      throw new Error(`Path not found: ${absoluteScanPath}`);
    }
    await scanDir(absoluteScanPath);

    // 2. Determine Version Number (Same logic as commit)
    let nextVerNum = "1.0";
    const parentId = index.currentHead;

    if (parentId) {
      let parentManifest: VersionManifest | null = null;
      try {
        parentManifest = await this.readJson(path.join(this.versionsPath, `${parentId}.json`));
      } catch (e) { /* ignore */ }

      if (parentManifest) {
        const parts = parentManifest.versionNumber.split('.');
        const pMajor = parseInt(parts[0]);
        const pMinor = parts.length > 1 ? parseInt(parts[1]) : 0;

        if (index.currentHead === index.latestVersion) {
          nextVerNum = (pMajor + 1).toString();
        } else {
          const allManifests = await this.getHistory(); // Could optimize
          let maxMinor = pMinor;
          for (const m of allManifests) {
            const mParts = m.versionNumber.split('.');
            const mMajor = parseInt(mParts[0]);
            const mMinor = mParts.length > 1 ? parseInt(mParts[1]) : 0;
            if (mMajor === pMajor && mMinor > maxMinor) maxMinor = mMinor;
          }
          nextVerNum = `${pMajor}.${maxMinor + 1}`;
        }
      }
    }

    // 3. Create Version Manifest
    const versionId = `v${Date.now()}`;
    const manifest: VersionManifest = {
      id: versionId,
      versionNumber: nextVerNum,
      label,
      timestamp: new Date().toISOString(),
      files: fileHashes,
      fileIds: fileIds,
      parentId: parentId || null,
      scope: scope
    };

    await this.writeJson(path.join(this.versionsPath, `${versionId}.json`), manifest);

    // 4. Update Index
    Object.assign(index.objects, newObjects);

    for (const hash of Object.values(fileHashes)) {
      if (index.objects[hash]) {
        index.objects[hash].refCount++;
      }
    }

    index.latestVersion = versionId;
    index.currentHead = versionId;
    await this.writeIndex(index);

    return versionId;
  }

  /**
   * Create a new version snapshot (Legacy/Single File support).
   */
  async commit(label: string, filesToTrack: string[]): Promise<string> {
    // Re-implemented to reuse addFileToCAS logic for consistency
    await this.init();
    const index = await this.readIndex();
    const fileHashes: Record<string, Hash> = {};
    const fileIds: Record<string, string> = {};
    const newObjects: Record<Hash, FileMetadata> = {};

    await Promise.all(filesToTrack.map(async (filePath) => {
      const relativePath = path.isAbsolute(filePath)
        ? path.relative(this.projectRoot, filePath)
        : filePath;

      const fullPath = path.join(this.projectRoot, relativePath);

      if (!existsSync(fullPath)) return;

      const { hash, originalSize, compressedSize } = await this.addFileToCAS(fullPath);
      const id = await this.getOrCreateFileId(relativePath);

      fileHashes[relativePath] = hash;
      fileIds[relativePath] = id;

      if (!index.objects[hash]) {
        newObjects[hash] = {
          size: originalSize,
          compressedSize: compressedSize,
          isCompressed: true,
          refCount: 0,
          path: relativePath
        };
      }
    }));

    // Version Number Logic (Duplicate of createSnapshot - could be extracted)
    let nextVerNum = "1.0";
    const parentId = index.currentHead;

    if (parentId) {
      let parentManifest: VersionManifest | null = null;
      try {
        parentManifest = await this.readJson(path.join(this.versionsPath, `${parentId}.json`));
      } catch (e) { /* ignore */ }

      if (parentManifest) {
        const parts = parentManifest.versionNumber.split('.');
        const pMajor = parseInt(parts[0]);
        const pMinor = parts.length > 1 ? parseInt(parts[1]) : 0;

        if (index.currentHead === index.latestVersion) {
          nextVerNum = (pMajor + 1).toString();
        } else {
          const allManifests = await this.getHistory(); // Warning: performance check needed
          let maxMinor = pMinor;
          for (const m of allManifests) {
            const mParts = m.versionNumber.split('.');
            const mMajor = parseInt(mParts[0]);
            const mMinor = mParts.length > 1 ? parseInt(mParts[1]) : 0;
            if (mMajor === pMajor) {
              if (mMinor > maxMinor) maxMinor = mMinor;
            }
          }
          nextVerNum = `${pMajor}.${maxMinor + 1}`;
        }
      }
    }

    const versionId = `v${Date.now()}`;
    const manifest: VersionManifest = {
      id: versionId,
      versionNumber: nextVerNum,
      label,
      timestamp: new Date().toISOString(),
      files: fileHashes,
      fileIds: fileIds,
      parentId: parentId || null
    };

    await this.writeJson(path.join(this.versionsPath, `${versionId}.json`), manifest);

    Object.assign(index.objects, newObjects);
    for (const hash of Object.values(fileHashes)) {
      if (index.objects[hash]) index.objects[hash].refCount++;
    }

    index.latestVersion = versionId;
    index.currentHead = versionId;
    await this.writeIndex(index);

    return versionId;
  }

  /**
   * Restore the working directory to a specific version.
   */
  /**
   * Restore the working directory to a specific version.
   */
  async restore(versionId: string): Promise<void> {
    const manifestPath = path.join(this.versionsPath, `${versionId}.json`);
    if (!existsSync(manifestPath)) {
      throw new Error(`Version ${versionId} not found.`);
    }

    const manifest: VersionManifest = await this.readJson(manifestPath);

    // 1. If this is a scoped snapshot (folder snapshot), we must CLEAN the directory first
    // Remove files that exist in the directory but are NOT in the snapshot manifest.
    if (manifest.scope) {
      const scopePath = path.resolve(this.projectRoot, manifest.scope === '.' ? '' : manifest.scope);

      if (existsSync(scopePath)) {
        // Recursive deletion helper
        const cleanDir = async (dir: string) => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name === '.draft') continue; // NEVER touch .draft

            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(this.projectRoot, fullPath); // Forward slashes on Windows?
            // normalize relative path to match manifest keys
            const normPath = this.normalizePath(relativePath);

            if (entry.isDirectory()) {
              await cleanDir(fullPath);
              // If directory is empty after cleaning, remove it? 
              // Only if it's not the scope itself and not in manifests?
              // For now let's just clean files. Empty dirs might be annoying but safe.
              const remaining = await fs.readdir(fullPath);
              if (remaining.length === 0 && fullPath !== scopePath) {
                await fs.rmdir(fullPath);
              }
            } else {
              // It's a file. Check if it exists in the manifest.
              // We check by Path AND by ID if possible.
              // But strictly speaking, if a file is at "src/foo.ts" and manifest doesn't have "src/foo.ts",
              // then "src/foo.ts" is an untracked file added AFTER the snapshot.
              // In a true "restore to state", it should be removed.

              if (!manifest.files[normPath]) {
                // Double check: maybe it was renamed? 
                // If it was renamed, the OLD path (normPath) wouldn't be in manifest.
                // The NEW path would be.
                // So if normPath is not in manifest, it's an extra file. Delete it.
                console.log(`[Restore] Removing untracked file: ${normPath}`);
                await fs.unlink(fullPath);
              }
            }
          }
        };

        await cleanDir(scopePath);
      }
    }

    for (const [relativePath, hash] of Object.entries(manifest.files)) {
      // Determine the actual destination path
      // If the file has been renamed, use the current path instead of the old one
      let actualPath: string | null = null;
      let foundMetadata = false;

      // Check if we have a file ID for this file in the manifest
      if (manifest.fileIds && manifest.fileIds[relativePath]) {
        const fileId = manifest.fileIds[relativePath];

        // Search through all metadata to find the current path for this file ID
        const metadataDir = path.join(this.draftPath, 'metadata');
        if (existsSync(metadataDir)) {
          try {
            const metaFiles = await fs.readdir(metadataDir);
            for (const metaFile of metaFiles) {
              if (!metaFile.endsWith('.json')) continue;

              try {
                const meta = await this.readJson(path.join(metadataDir, metaFile));
                // Ignore metadata that points to a renamed file (historical record)
                if (meta && meta.id === fileId && meta.path && !meta.renamedTo) {
                  // Found the current path for this file
                  actualPath = meta.path;
                  foundMetadata = true;
                  break;
                }
              } catch (e) {
                // Skip invalid metadata files
                continue;
              }
            }
          } catch (e) {
            console.error(`Error searching metadata for file ID ${fileId}:`, e);
          }
        }
      }

      // If no file ID or couldn't find by ID, check if metadata exists for the original path
      if (!foundMetadata) {
        let meta = await this.getMetadata(relativePath);

        // Follow rename chain
        let depth = 0;
        const MAX_DEPTH = 50;
        while (meta && meta.renamedTo && depth < MAX_DEPTH) {
          meta = await this.getMetadata(meta.renamedTo);
          depth++;
        }

        if (meta && meta.path) {
          // File still exists with original path or has metadata
          actualPath = meta.path;
          foundMetadata = true;
        }
      }

      // IMPORTANT: Skip files that have no current metadata
      // This prevents recreating files that were renamed/deleted
      if (!foundMetadata || !actualPath) {
        console.log(`Skipping ${relativePath} - no current metadata found (likely renamed or deleted)`);
        continue;
      }

      const destPath = path.join(this.projectRoot, actualPath);
      const blobPath = path.join(this.objectsPath, hash);

      if (!existsSync(blobPath)) {
        console.error(`Missing blob for ${relativePath} (Hash: ${hash})`);
        continue;
      }

      // Check content before expensive restore
      let currentHash = '';
      if (existsSync(destPath)) {
        currentHash = await this.hashFile(destPath);
      }

      if (currentHash !== hash) {
        await fs.mkdir(path.dirname(destPath), { recursive: true });

        // Decompress and Restore
        // Check if object is compressed via Index or just try decompress
        const index = await this.readIndex();
        const objMeta = index.objects[hash];

        // If metadata says compressed, OR if we want to be robust (try decompress)
        // For now, let's implement extraction with decompression support
        await this.restoreBlobToFile(blobPath, destPath, objMeta?.isCompressed);
      }
    }

    const index = await this.readIndex();
    index.currentHead = versionId;
    await this.writeIndex(index);
  }

  /**
   * Delete a version and garbage collect unused blobs.
   */
  async deleteVersion(versionId: string): Promise<void> {
    const manifestPath = path.join(this.versionsPath, `${versionId}.json`);
    if (!existsSync(manifestPath)) {
      throw new Error(`Version ${versionId} not found.`);
    }

    const manifest: VersionManifest = await this.readJson(manifestPath);
    const index: VersionIndex = await this.readIndex();

    await fs.unlink(manifestPath);

    for (const hash of Object.values(manifest.files)) {
      if (index.objects[hash]) {
        index.objects[hash].refCount--;

        if (index.objects[hash].refCount <= 0) {
          const blobPath = path.join(this.objectsPath, hash);
          try {
            if (existsSync(blobPath)) {
              await fs.unlink(blobPath);
            }
          } catch (e) {
            console.error(`Failed to GC blob ${hash}`, e);
          }
          delete index.objects[hash];
        }
      }
    }

    if (index.latestVersion === versionId) {
      const history = await this.getHistory();
      index.latestVersion = history.length > 0 ? history[0].id : null;
    }

    await this.writeIndex(index);
  }

  /**
   * Rename a version's label.
   */
  async renameVersion(versionId: string, newLabel: string): Promise<void> {
    const manifestPath = path.join(this.versionsPath, `${versionId}.json`);
    if (!existsSync(manifestPath)) {
      throw new Error(`Version ${versionId} not found.`);
    }

    const manifest: VersionManifest = await this.readJson(manifestPath);
    manifest.label = newLabel;
    await this.writeJson(manifestPath, manifest);
  }

  /**
   * Get history of versions.
   */
  async getHistory(filterFile?: string): Promise<VersionManifest[]> {
    if (!existsSync(this.versionsPath)) return [];

    const files = await fs.readdir(this.versionsPath);
    const manifests: VersionManifest[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await this.readJson(path.join(this.versionsPath, file));
          manifests.push(content);
        } catch (e) {
          console.error(`Failed to read version file ${file}`, e);
        }
      }
    }

    manifests.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let index: VersionIndex | null = null;
    try {
      index = await this.readIndex();
    } catch (e) { /* ignore */ }

    for (let i = 0; i < manifests.length; i++) {
      if (!manifests[i].versionNumber) {
        manifests[i].versionNumber = (i + 1).toString();
      }

      let totalSize = 0;
      let totalCompressedSize = 0;
      if (index && index.objects) {
        for (const hash of Object.values(manifests[i].files)) {
          if (index.objects[hash]) {
            totalSize += index.objects[hash].size;
            totalCompressedSize += (index.objects[hash].compressedSize || index.objects[hash].size);
          }
        }
      }
      // @ts-ignore
      manifests[i].totalSize = totalSize;
      // @ts-ignore
      manifests[i].totalCompressedSize = totalCompressedSize;
    }

    let result = manifests;

    if (filterFile) {
      const target = this.normalizePath(filterFile);
      const meta = await this.getMetadata(target);
      let targetId = meta?.id || null;

      // Collect all related paths from the target file's metadata
      const allRelatedPaths = new Set<string>();
      if (meta) {
        if (meta.path) allRelatedPaths.add(this.normalizePath(meta.path));
        if (meta.renamedTo) allRelatedPaths.add(this.normalizePath(meta.renamedTo));
        if (meta.previousPaths) {
          meta.previousPaths.forEach((p: string) => allRelatedPaths.add(this.normalizePath(p)));
        }
      }

      // Robust directory detection
      let isDirectory = false;
      try {
        const stats = await fs.stat(path.join(this.projectRoot, target));
        isDirectory = stats.isDirectory();
      } catch {
        // If not physical, check if any version manifest has it as a folder prefix
        // or if we have historical paths that were folders
        const searchTargets = new Set<string>([target, ...allRelatedPaths]);
        if (meta?.previousPaths) meta.previousPaths.forEach((p: string) => searchTargets.add(this.normalizePath(p)));

        outer: for (const m of result) {
          if (!m.files) continue;
          for (const fPath of Object.keys(m.files)) {
            for (const st of searchTargets) {
              if (fPath.startsWith(st + '/')) {
                isDirectory = true;
                break outer;
              }
            }
          }
        }
      }

      const searchPaths = new Set<string>([target, target.toLowerCase(), ...allRelatedPaths]);
      if (meta?.previousPaths) {
        meta.previousPaths.forEach((p: string) => {
          const n = this.normalizePath(p);
          searchPaths.add(n);
          searchPaths.add(n.toLowerCase());
        });
      }
      // Add lowercase versions of all related paths
      allRelatedPaths.forEach(p => searchPaths.add(p.toLowerCase()));

      result = result.filter(m => {
        // 0. Match by Scope (Priority for Folder Snapshots)
        if (m.scope) {
          const normScope = this.normalizePath(m.scope);
          // Check if the scope matches the target OR any of its historical paths (searchPaths)
          if (searchPaths.has(normScope) || searchPaths.has(normScope.toLowerCase())) return true;

          // Fallback for root
          if (target === '' && normScope === '.') return true;
        }

        if (!m.files) return false;

        // 1. Match by ID (Best for post-ID commits)
        if (targetId && m.fileIds) {
          if (Object.values(m.fileIds).includes(targetId)) return true;
        }

        // 2. Match by any current or historical path
        for (const fPath of Object.keys(m.files)) {
          const norm = this.normalizePath(fPath);

          // Exact match (current or historical)
          if (searchPaths.has(norm) || searchPaths.has(norm.toLowerCase())) return true;

          // Directory match (if any file in version is inside the target folder)
          if (isDirectory) {
            // FIX: Ensure searchPaths includes the folder properly (without trailing slash)
            // norm.startsWith('src/') works if sPath is 'src'
            for (const sPath of searchPaths) {
              if (norm.startsWith(sPath + '/')) return true;
            }
          }
        }

        return false;
      });

      // Re-calculate size to reflect ONLY the relevant files
      const index = await this.readJson(path.join(this.draftPath, 'index.json')).catch(() => null);
      if (index && index.objects) {
        for (const m of result) {
          let relevantSize = 0;
          let relevantCompressedSize = 0;
          if (!m.files) continue;

          for (const [fPath, fHash] of Object.entries(m.files)) {
            const norm = this.normalizePath(fPath);
            let isMatch = false;

            // ID check
            if (targetId && m.fileIds && m.fileIds[fPath] === targetId) {
              isMatch = true;
            }

            // Path check
            if (!isMatch) {
              if (searchPaths.has(norm) || searchPaths.has(norm.toLowerCase())) {
                isMatch = true;
              } else if (isDirectory) {
                for (const sPath of searchPaths) {
                  if (norm.startsWith(sPath + '/')) {
                    isMatch = true;
                    break;
                  }
                }
              }
            }

            if (isMatch && index.objects[fHash]) {
              relevantSize += index.objects[fHash].size;
              relevantCompressedSize += (index.objects[fHash].compressedSize || index.objects[fHash].size);
            }
          }

          // @ts-ignore
          m.totalSize = relevantSize;
          // @ts-ignore
          m.totalCompressedSize = relevantCompressedSize;
        }
      }
    }

    return result.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get the active version number for a specific file.
   */
  async getLatestVersionForFile(relativePath: string): Promise<string | null> {
    const history = await this.getHistory(relativePath);
    if (history.length === 0) return null;

    const currentHead = await this.getCurrentHead();
    let activeIdx = -1;
    if (currentHead) {
      activeIdx = history.findIndex(h => h.id === currentHead);
    }

    const indexToUse = activeIdx === -1 ? 0 : activeIdx;
    const versionNum = history.length - indexToUse;

    return versionNum.toString();
  }

  /**
   * Extract a specific file from a version to a destination.
   */
  async extractFile(versionId: string, relativeFilePath: string, destPath: string): Promise<void> {
    const manifestPath = path.join(this.versionsPath, `${versionId}.json`);
    if (!existsSync(manifestPath)) {
      throw new Error(`Version ${versionId} not found.`);
    }

    const manifest: VersionManifest = await this.readJson(manifestPath);
    let hash = manifest.files[relativeFilePath];
    const target = relativeFilePath.replace(/\\/g, '/');

    if (!hash) {
      const foundKey = Object.keys(manifest.files).find(k => k.replace(/\\/g, '/') === target);
      if (foundKey) {
        hash = manifest.files[foundKey];
      } else {
        const lowerTarget = target.toLowerCase();
        const foundKeyCI = Object.keys(manifest.files).find(k => k.replace(/\\/g, '/').toLowerCase() === lowerTarget);
        if (foundKeyCI) hash = manifest.files[foundKeyCI];
      }
    }

    if (!hash) {
      throw new Error(`File ${relativeFilePath} not found in ${versionId}.`);
    }

    const blobPath = path.join(this.objectsPath, hash);
    if (!existsSync(blobPath)) {
      throw new Error(`Blob missing for ${relativeFilePath} (Hash: ${hash})`);
    }

    await fs.mkdir(path.dirname(destPath), { recursive: true });

    // Decompress/Copy
    const index = await this.readIndex();
    const objMeta = index.objects[hash];
    await this.restoreBlobToFile(blobPath, destPath, objMeta?.isCompressed);
  }

  /**
   * Get the current head version ID.
   */
  async getCurrentHead(): Promise<string | null> {
    const index = await this.readIndex();
    return index.currentHead;
  }

  // --- Helpers ---

  async hashFile(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    await pipeline(stream, hash);
    return hash.digest('hex');
  }

  /**
   * Core function to add a file to CAS. 
   * Hashes original content, compresses, and stores in objects/.
   */
  private async addFileToCAS(filePath: string): Promise<{ hash: string, originalSize: number, compressedSize: number }> {
    const hash = await this.hashFile(filePath);
    const blobPath = path.join(this.objectsPath, hash);
    const stats = await fs.stat(filePath);

    // If already exists, return info (we assume it's valid if hash matches)
    if (existsSync(blobPath)) {
      const blobStats = await fs.stat(blobPath);
      return {
        hash,
        originalSize: stats.size,
        compressedSize: blobStats.size
      };
    }

    // Compress and write
    await this.compressFileToBlob(filePath, blobPath);
    const blobStats = await fs.stat(blobPath);

    return {
      hash,
      originalSize: stats.size,
      compressedSize: blobStats.size
    };
  }

  private async compressFileToBlob(src: string, dest: string): Promise<void> {
    const source = createReadStream(src);
    const destination = createWriteStream(dest);
    const brotli = createBrotliCompress(); // High default compression
    await pipeline(source, brotli, destination);
  }

  private async restoreBlobToFile(srcBlob: string, destFile: string, isCompressed?: boolean): Promise<void> {
    if (isCompressed) {
      const source = createReadStream(srcBlob);
      const destination = createWriteStream(destFile);
      const brotli = createBrotliDecompress();
      await pipeline(source, brotli, destination);
    } else {
      // Fallback for legacy uncompressed blobs
      await fs.copyFile(srcBlob, destFile);
    }
  }

  private async readIndex(): Promise<VersionIndex> {
    if (!existsSync(this.indexPath)) {
      return { objects: {}, latestVersion: null, currentHead: null };
    }
    return this.readJson(this.indexPath);
  }

  private async writeIndex(index: VersionIndex): Promise<void> {
    await this.writeJson(this.indexPath, index);
  }

  private async readJson(path: string): Promise<any> {
    const data = await fs.readFile(path, 'utf-8');
    return JSON.parse(data);
  }

  private async writeJson(file: string, data: any): Promise<void> {
    const tempFile = `${file}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
    await fs.rename(tempFile, file);
  }

  /**
   * Get storage usage report.
   */
  /**
   * Get storage usage report.
   */
  async getStorageReport(): Promise<any> {
    const history = await this.getHistory();
    const index = await this.readIndex();

    const files: Record<string, {
      path: string;
      versionCount: number;
      explicitCount: number;
      snapshotCount: number;
      latestDate: string;
      latestVersionId: string;
      uniqueBlobs: Set<string>;
    }> = {};

    const folderMap: Record<string, {
      scope: string;
      versionCount: number;
      latestDate: string;
      totalSize: number;
      totalCompressedSize: number;
      fileCount: number;
    }> = {};

    for (const v of history) {
      if (!v.files) continue; // Safety check
      this.processManifestFiles(v, files);

      // Process Snapshot (Folder Version)
      if (v.scope) {
        let snapSize = 0;
        let snapCompressedSize = 0;

        for (const hash of Object.values(v.files)) {
          if (index.objects[hash]) {
            snapSize += index.objects[hash].size;
            snapCompressedSize += (index.objects[hash].compressedSize || index.objects[hash].size);
          }
        }

        if (!folderMap[v.scope]) {
          folderMap[v.scope] = {
            scope: v.scope,
            versionCount: 0,
            latestDate: v.timestamp,
            totalSize: 0,
            totalCompressedSize: 0,
            fileCount: 0
          };
        }

        const f = folderMap[v.scope];
        f.versionCount++;
        f.totalSize += snapSize;
        f.totalCompressedSize += snapCompressedSize;

        // Update latest info
        if (new Date(v.timestamp) >= new Date(f.latestDate) || f.versionCount === 1) {
          f.latestDate = v.timestamp;
          f.fileCount = Object.keys(v.files).length;
        }
      }
    }

    const snapshots = Object.values(folderMap);

    const fileReports = Object.values(files).map(f => {
      let size = 0;
      let compressedSize = 0;
      f.uniqueBlobs.forEach(hash => {
        if (index.objects[hash]) {
          size += index.objects[hash].size;
          compressedSize += (index.objects[hash].compressedSize || index.objects[hash].size);
        }
      });
      return {
        path: f.path,
        versionCount: f.versionCount,
        explicitCount: f.explicitCount,
        snapshotCount: f.snapshotCount,
        latestDate: f.latestDate,
        totalHistorySize: size,
        totalCompressedSize: compressedSize
      };
    });

    let totalSize = 0;
    let totalCompressedSize = 0;

    if (index.objects) {
      for (const obj of Object.values(index.objects)) {
        totalSize += obj.size;
        totalCompressedSize += (obj.compressedSize || obj.size);
      }
    }

    return {
      totalSize,
      totalCompressedSize,
      compressionRatio: totalSize > 0 ? (totalCompressedSize / totalSize).toFixed(2) : 1,
      fileCount: fileReports.length,
      files: fileReports.sort((a, b) => b.totalHistorySize - a.totalHistorySize),
      snapshots: snapshots.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime())
    };
  }

  private processManifestFiles(v: VersionManifest, files: Record<string, any>) {
    for (const [filePath, hash] of Object.entries(v.files)) {
      const normPath = this.normalizePath(filePath);
      if (normPath.startsWith('.draft/') || normPath === ('.draft')) continue;

      if (!files[normPath]) {
        files[normPath] = {
          path: normPath,
          versionCount: 0,
          explicitCount: 0,
          snapshotCount: 0,
          latestDate: v.timestamp,
          latestVersionId: v.id,
          uniqueBlobs: new Set()
        };
      }

      files[normPath].versionCount++;
      if (v.scope) {
        files[normPath].snapshotCount++;
      } else {
        files[normPath].explicitCount++;
      }
      files[normPath].uniqueBlobs.add(hash);

      if (new Date(v.timestamp) > new Date(files[normPath].latestDate)) {
        files[normPath].latestDate = v.timestamp;
        files[normPath].latestVersionId = v.id;
      }
    }
  }

  /**
   * Validate storage integrity.
   * Checks for missing blobs, orphaned metadata, and verifies ID links.
   */
  async validateIntegrity(): Promise<{ valid: boolean, errors: string[] }> {
    const errors: string[] = [];
    const index = await this.readIndex();

    // Check blobs
    if (index.objects) {
      for (const [hash, meta] of Object.entries(index.objects)) {
        const blobPath = path.join(this.objectsPath, hash);
        if (!existsSync(blobPath)) {
          errors.push(`Missing blob: ${hash} (referenced by ${meta.path})`);
        }
      }
    }

    // Check versions
    const history = await this.getHistory();
    for (const v of history) {
      for (const [fPath, hash] of Object.entries(v.files)) {
        if (index.objects && !index.objects[hash]) {
          errors.push(`Version ${v.id} references unknown hash ${hash} for file ${fPath}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

}
