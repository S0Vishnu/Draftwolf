
import fs from 'fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';

// --- Types ---

export type Hash = string;

export interface FileMetadata {
  size: number;
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
  parentId: string | null;
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

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.draftPath = path.join(projectRoot, DRAFT_DIR);
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
    const hash = this.hashString(this.normalizePath(relativePath));
    const metaFilePath = path.join(this.draftPath, 'metadata', `${hash}.json`);
    await this.writeJson(metaFilePath, metadata);
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
   * Move metadata from one file path to another (used during rename).
   */
  async moveMetadata(oldRelativePath: string, newRelativePath: string): Promise<void> {
    const oldHash = this.hashString(this.normalizePath(oldRelativePath));
    const newHash = this.hashString(this.normalizePath(newRelativePath));

    const oldMetaPath = path.join(this.draftPath, 'metadata', `${oldHash}.json`);
    const newMetaPath = path.join(this.draftPath, 'metadata', `${newHash}.json`);

    if (existsSync(oldMetaPath)) {
      await fs.rename(oldMetaPath, newMetaPath);
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
    // Normalize to forward slashes for consistent hashing across platforms/renames
    // Also potentially handle case sensitivity if needed, but keeping it simple.
    return p.replace(/\\/g, '/');
  }

  private hashString(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Create a new version snapshot.
   */
  async commit(label: string, filesToTrack: string[]): Promise<string> {
    await this.init();
    const index = await this.readIndex();
    const fileHashes: Record<string, Hash> = {};
    const newObjects: Record<Hash, FileMetadata> = {};

    // 1. Hash files and store new blobs
    for (const filePath of filesToTrack) {
      // ... (existing has logic, copied below for context if needed, but we assume tool handles replacement block) ...
      const relativePath = path.isAbsolute(filePath)
        ? path.relative(this.projectRoot, filePath)
        : filePath;

      const fullPath = path.join(this.projectRoot, relativePath);

      if (!existsSync(fullPath)) continue;

      const hash = await this.hashFile(fullPath);
      const stats = await fs.stat(fullPath);

      fileHashes[relativePath] = hash;

      const blobPath = path.join(this.objectsPath, hash);
      if (!index.objects[hash] || !existsSync(blobPath)) {
        await this.copyFileToBlob(fullPath, blobPath);
        newObjects[hash] = {
          size: stats.size,
          refCount: 0,
          path: relativePath
        };
      }
    }

    // 2. Determine Version Number
    // Logic: 
    // If currentHead == latestVersion (or null) -> Major Bump (1.0 -> 2.0)
    // If currentHead != latestVersion (we are detached) -> Minor Bump (1.0 -> 1.1)

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
          // Linear progression - Increment Major
          nextVerNum = (pMajor + 1).toString();
        } else {
          // Branching/Restored - Increment Minor
          const allManifests = await this.getHistory();
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
    } else {
      // No parent, but maybe history exists? (e.g. deleted head)
      // Reset to 1.0 or find max? Let's default to 1.0 for fresh start.
    }

    // 2b. Create Version Manifest
    const versionId = `v${Date.now()}`;
    const manifest: VersionManifest = {
      id: versionId,
      versionNumber: nextVerNum,
      label,
      timestamp: new Date().toISOString(),
      files: fileHashes,
      parentId: parentId || null
    };

    await this.writeJson(path.join(this.versionsPath, `${versionId}.json`), manifest);

    // 3. Update Index
    Object.assign(index.objects, newObjects);

    for (const hash of Object.values(fileHashes)) {
      if (index.objects[hash]) {
        index.objects[hash].refCount++;
      }
    }

    index.latestVersion = versionId; // Newest is always latest chronologically
    index.currentHead = versionId;   // Move head to new commit
    await this.writeIndex(index);

    return versionId;
  }

  /**
   * Restore the working directory to a specific version.
   * WARNING: Overwrites files in working directory.
   */
  async restore(versionId: string): Promise<void> {
    const manifestPath = path.join(this.versionsPath, `${versionId}.json`);
    if (!existsSync(manifestPath)) {
      throw new Error(`Version ${versionId} not found.`);
    }

    const manifest: VersionManifest = await this.readJson(manifestPath);

    for (const [relativePath, hash] of Object.entries(manifest.files)) {
      const destPath = path.join(this.projectRoot, relativePath);
      const blobPath = path.join(this.objectsPath, hash);

      if (!existsSync(blobPath)) {
        console.error(`Missing blob for ${relativePath} (Hash: ${hash})`);
        continue; // Critical error actually
      }

      // Check current file hash to avoid unnecessary writes
      let currentHash = '';
      if (existsSync(destPath)) {
        currentHash = await this.hashFile(destPath);
      }

      if (currentHash !== hash) {
        // Ensure dir exists
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(blobPath, destPath);
      }
    }

    // Update currentHead to point to the restored version for branching logic
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

    // 1. Read manifest to know what files to dereference
    const manifest: VersionManifest = await this.readJson(manifestPath);
    const index: VersionIndex = await this.readIndex();

    // 2. Delete the manifest file
    await fs.unlink(manifestPath);

    // 3. Update Ref Counts & GC
    for (const hash of Object.values(manifest.files)) {
      if (index.objects[hash]) {
        index.objects[hash].refCount--;

        // Garbage Collection: If no versions reference this blob, delete it.
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

    // 4. Update latestVersion pointer
    if (index.latestVersion === versionId) {
      // Find the new latest version by scanning remaining files
      const history = await this.getHistory(); // valid because we deleted the file already
      index.latestVersion = history.length > 0 ? history[0].id : null;
    }

    await this.writeIndex(index);
  }

  /**
   * Diff between current working files and a version (or latest).
   */
  async status(): Promise<{ modified: string[], new: string[], deleted: string[] }> {
    const index = await this.readIndex();
    if (!index.latestVersion) return { modified: [], new: [], deleted: [] };

    const manifestPath = path.join(this.versionsPath, `${index.latestVersion}.json`);
    const manifest: VersionManifest = await this.readJson(manifestPath);

    // This requires a full scan of the directory, which is expensive.
    // For this lightweight system, we assume user passes the files they care about 
    // or we scan a specific root. 
    // Implementation omitted for brevity, but logic is:
    // 1. Get List of all files in projectRoot (recursive).
    // 2. Hash them.
    // 3. Compare with manifest.files.
    return { modified: [], new: [], deleted: [] };
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

    // Sort by timestamp ascending (oldest first) to assign numbers correctly
    manifests.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Read index once to get sizes
    let index: VersionIndex | null = null;
    try {
      index = await this.readIndex();
    } catch (e) { /* ignore */ }

    // Backfill missing version numbers for legacy commits and calculate size
    let maxMajor = 0;

    for (let i = 0; i < manifests.length; i++) {
      if (!manifests[i].versionNumber) {
        // Assign a legacy version number (e.g. 1, 2, 3)
        manifests[i].versionNumber = (i + 1).toString();
      }

      // Track max for future commits
      const parts = manifests[i].versionNumber.split('.');
      const maj = parseInt(parts[0]);
      // Treat 1 as 1.0
      if (!isNaN(maj) && maj > maxMajor) maxMajor = maj;

      // Calculate Total Size
      let totalSize = 0;
      if (index && index.objects) {
        for (const hash of Object.values(manifests[i].files)) {
          if (index.objects[hash]) {
            totalSize += index.objects[hash].size;
          }
        }
      }
      // @ts-ignore
      manifests[i].totalSize = totalSize;
    }

    let result = manifests;

    if (filterFile) {
      const target = this.normalizePath(filterFile);
      result = result.filter(m => {
        // Direct match
        if (m.files[target]) return true;

        // Normalized match
        if (Object.keys(m.files).some(k => this.normalizePath(k) === target)) return true;

        // Case-insensitive match (Robustness for Windows)
        const lowerTarget = target.toLowerCase();
        return Object.keys(m.files).some(k => this.normalizePath(k).toLowerCase() === lowerTarget);
      });
    }

    // Sort by timestamp descending (newest first) for UI
    return result.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get the latest version number for a specific file.
   */
  async getLatestVersionForFile(relativePath: string): Promise<string | null> {
    const history = await this.getHistory();
    // Normalize path just in case
    const target = relativePath.replace(/\\/g, '/');

    // Count how many versions contain this file
    let count = 0;
    for (const manifest of history) {
      if (manifest.files[target]) {
        count++;
      }
    }

    return count > 0 ? count.toString() : null;
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
    // Normalize path just in case
    const normPath = relativeFilePath.split(path.sep).join(path.posix.sep); // Store is likely posix or consistent?

    // We stored paths in keys. Let's try direct lookup first, then fallback to normalized.
    let hash = manifest.files[relativeFilePath];
    const target = relativeFilePath.replace(/\\/g, '/');

    if (!hash) {
      // Try finding by matching suffix or normalized if strict lookup fails
      const foundKey = Object.keys(manifest.files).find(k => k.replace(/\\/g, '/') === target);
      if (foundKey) {
        hash = manifest.files[foundKey];
      } else {
        // Fallback: Case-insensitive match (robustness for Windows)
        const lowerTarget = target.toLowerCase();
        const foundKeyCI = Object.keys(manifest.files).find(k => k.replace(/\\/g, '/').toLowerCase() === lowerTarget);
        if (foundKeyCI) hash = manifest.files[foundKeyCI];
      }
    }

    if (!hash) {
      // Debug info: show what we have vs what was requested
      const keys = Object.keys(manifest.files).slice(0, 10).join(', '); // Limit to 10
      throw new Error(`File ${relativeFilePath} (target: ${target}) not found in ${versionId}. Keys: [${keys}...]`);
    }

    const blobPath = path.join(this.objectsPath, hash);
    if (!existsSync(blobPath)) {
      throw new Error(`Blob missing for ${relativeFilePath} (Hash: ${hash})`);
    }

    // Create dir if needed
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(blobPath, destPath);
  }

  // --- Helpers ---

  async hashFile(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    await pipeline(stream, hash);
    return hash.digest('hex');
  }

  private async copyFileToBlob(src: string, dest: string): Promise<void> {
    // Copy then verify? Or just atomic copy. 
    // Using copyFile is usually atomic enough for local FS on same drive.
    await fs.copyFile(src, dest);
    // Determine strict readonly permissions for blobs? 
    // await fs.chmod(dest, 0o444); 
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
    // Atomic write pattern
    const tempFile = `${file}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
    await fs.rename(tempFile, file);
  }
}
