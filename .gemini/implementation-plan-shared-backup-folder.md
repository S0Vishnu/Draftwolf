# Implementation Plan: Shared Backup Folder Support (Idea A — Auto-Append Project Name)

## Goal
Allow multiple projects to use the **same user-selected backup folder** without data collisions, while maintaining **100% backward compatibility** with existing projects that already have a `.draft` folder at `<backupPath>/.draft`.

## How It Works (Summary)

**Current behavior:**
- User selects backup folder `D:\MyBackups`
- App stores `backupPath = "D:\MyBackups"` in localStorage (pinnedFolders / recentWorkspaces)
- `DraftControlSystem` receives `storageRoot = "D:\MyBackups"` and creates `.draft` at `D:\MyBackups\.draft`
- Problem: If two projects pick `D:\MyBackups`, they share the same `.draft` → data corruption

**New behavior:**
- User selects backup folder `D:\MyBackups`
- App computes effective storage root = `D:\MyBackups\<ProjectFolderName>` (e.g. `D:\MyBackups\MyProject`)
- App stores `backupPath = "D:\MyBackups\MyProject"` in localStorage ← this is the KEY change
- `DraftControlSystem` receives `storageRoot = "D:\MyBackups\MyProject"` and creates `.draft` at `D:\MyBackups\MyProject\.draft`
- Two projects now get separate `.draft` folders:
  - `D:\MyBackups\ProjectA\.draft`
  - `D:\MyBackups\ProjectB\.draft`

**Backward compatibility:**
- Existing projects already have `backupPath` stored in localStorage (e.g. `"D:\MyBackups"` or `"D:\ProjectFolder"`)
- These stored paths are loaded and passed directly to `DraftControlSystem` — **NO migration needed**
- The auto-append logic ONLY runs at the moment the user picks a NEW backup folder (in the folder picker dialog)
- Once saved, it's just a path — the rest of the app doesn't care how it was computed

---

## Architecture Understanding (READ THIS FIRST)

### Where `backupPath` is stored
- **localStorage key `pinnedFolders`**: Array of `{ path, name, color, backupPath, ... }`
- **localStorage key `recentWorkspaces`**: Array of `{ path, name, backupPath, ... }`
- The `backupPath` field stores the FULL path that becomes the `storageRoot` for `DraftControlSystem`

### Where `backupPath` is read and used
Every place that calls `DraftControlSystem` looks up the `backupPath` from localStorage and passes it as the second argument. The key function is `getBackupPath()` in `Home.tsx` (line 580-587):
```ts
const getBackupPath = (projectPath: string | null) => {
    if (!projectPath) return undefined;
    const pinned = pinnedFolders.find(f => f.path === projectPath);
    if (pinned && (pinned as any).backupPath) return (pinned as any).backupPath;
    const recent = recentWorkspaces.find(w => w.path === projectPath);
    if (recent && (recent as any).backupPath) return (recent as any).backupPath;
    return undefined;
};
```
This function returns whatever string is in `backupPath` — it doesn't modify it. So if we change what gets STORED, everything downstream automatically works.

### Where `backupPath` is SET (the only places we need to change)
There are exactly **2 places** where a backup path is chosen and saved:

1. **`Home.tsx` → `confirmBackupSetup()`** (line 815-849): Called when user sets up a NEW project and picks a backup folder via the popup dialog. This is where `backupSetupPath` (the raw user-selected folder) gets saved as `backupPath`.

2. **`Home.tsx` → `openWorkspace()`** (line 747-800): When opening a project that has no `backupPath` configured but has an existing `.draft` on disk, it calls `saveBackupPath(path, path)` — setting `backupPath` to the project's own root. This is for auto-discovery of existing projects.

### `DraftControlSystem` constructor (NO CHANGES NEEDED)
```ts
constructor(projectRoot: string, storageRoot?: string) {
    this.projectRoot = projectRoot;
    const rootForDraft = storageRoot || projectRoot;
    this.draftPath = path.join(rootForDraft, DRAFT_DIR);  // DRAFT_DIR = '.draft'
    ...
}
```
The constructor already accepts a `storageRoot` and puts `.draft` inside it. If we pass `D:\MyBackups\ProjectA`, it creates `.draft` at `D:\MyBackups\ProjectA\.draft`. **No changes needed here.**

---

## Files to Modify

| # | File | What Changes |
|---|---|---|
| 1 | `src/pages/Home.tsx` | Modify `confirmBackupSetup()` to auto-append project folder name when `backupSetupPath !== backupSetupProject` |
| 2 | `src/pages/Home.tsx` | Modify the "Browse..." button in backup setup popup to detect conflicts |

**That's it.** Only ONE file, only ONE function's logic changes. Everything else works automatically.

---

## Step-by-Step Implementation

### Step 1: Modify `confirmBackupSetup()` in `src/pages/Home.tsx`

**File:** `src/pages/Home.tsx`
**Function:** `confirmBackupSetup` (starts at line 815)
**Current code:**
```ts
const confirmBackupSetup = async () => {
    if (!backupSetupProject || !backupSetupPath) return;

    const bPath = backupSetupPath;
    const projPath = backupSetupProject;

    // Create .draft folder
    try {
        const success = await globalThis.api.draft.init(projPath, bPath);
        if (!success) {
            toast.error("Failed to initialize backup system");
            return;
        }
        toast.success("Initialized backup system (.draft)");
    } catch (e) {
        console.error("Init Error:", e);
        toast.error("Error initializing backup system");
        return;
    }

    saveBackupPath(projPath, bPath);

    setBackupSetupProject(null);
    setBackupSetupPath('');

    setRootDir(projPath);
    setHistory([projPath]);
    setHistoryIndex(0);
    setCurrentPath(projPath);
};
```

**Replace with this code:**
```ts
const confirmBackupSetup = async () => {
    if (!backupSetupProject || !backupSetupPath) return;

    let bPath = backupSetupPath;
    const projPath = backupSetupProject;

    // --- NEW: Auto-append project folder name if user selected a DIFFERENT folder ---
    // When the backup path is different from the project path, the user chose an external
    // folder (e.g. "D:\MyBackups"). We append the project's folder name to create isolation:
    //   "D:\MyBackups" → "D:\MyBackups\MyProject"
    // This prevents two projects from sharing the same .draft folder.
    //
    // When the backup path EQUALS the project path, the user wants .draft inside the project
    // itself (default behavior) — no appending needed.
    //
    // BACKWARD COMPATIBILITY: This logic only runs for NEW project setups.
    // Existing projects already have their backupPath saved in localStorage and skip this
    // function entirely (they go through the `hasBackup` early-return in openWorkspace).

    const normBPath = bPath.toLowerCase().replace(/[\\/]+$/, '').replaceAll('\\', '/');
    const normProjPath = projPath.toLowerCase().replace(/[\\/]+$/, '').replaceAll('\\', '/');

    if (normBPath !== normProjPath) {
        // User selected an external backup folder — append project folder name
        const projectFolderName = projPath.split(/[\\/]/).filter(Boolean).pop() || 'project';
        const separator = bPath.includes('/') ? '/' : '\\';
        const candidatePath = bPath.endsWith(separator)
            ? `${bPath}${projectFolderName}`
            : `${bPath}${separator}${projectFolderName}`;

        bPath = candidatePath;
    }
    // --- END NEW ---

    // Create .draft folder
    try {
        const success = await globalThis.api.draft.init(projPath, bPath);
        if (!success) {
            toast.error("Failed to initialize backup system");
            return;
        }
        toast.success("Initialized backup system (.draft)");
    } catch (e) {
        console.error("Init Error:", e);
        toast.error("Error initializing backup system");
        return;
    }

    saveBackupPath(projPath, bPath);

    setBackupSetupProject(null);
    setBackupSetupPath('');

    setRootDir(projPath);
    setHistory([projPath]);
    setHistoryIndex(0);
    setCurrentPath(projPath);
};
```

**What changed:**
- Added a block after `let bPath = backupSetupPath;` that checks if `bPath !== projPath` (normalized, case-insensitive, trailing-slash-stripped).
- If they differ, it extracts the project folder name from `projPath` (the last segment of the path, e.g. `MyProject` from `D:\Work\MyProject`) and appends it to `bPath`.
- Changed `const bPath` to `let bPath` so it can be reassigned.

**Why this is safe:**
- Old projects: They already have `backupPath` in localStorage. When they open, `openWorkspace()` hits the `hasBackup` early return (line 758) and NEVER calls `confirmBackupSetup()`. So this code never runs for old projects.
- New projects with default path: When user keeps the default (backupSetupPath === backupSetupProject), `normBPath === normProjPath` → no appending → same behavior as before.
- New projects with external folder: The only new case. Gets `D:\MyBackups\ProjectName` instead of `D:\MyBackups`.

### Step 2: Update the backup setup popup display to show the effective path

**File:** `src/pages/Home.tsx`
**Location:** The `<CustomPopup>` for backup setup (line 1654-1687)

**Current code for the display inside the popup (line 1664-1667):**
```tsx
<div className="backup-path-display">
    <img src={logo} alt="" />
    <span>{backupSetupPath || 'No folder selected'}</span>
</div>
```

**Replace with:**
```tsx
<div className="backup-path-display">
    <img src={logo} alt="" />
    <span>{(() => {
        if (!backupSetupPath) return 'No folder selected';
        if (!backupSetupProject) return backupSetupPath;

        const normBP = backupSetupPath.toLowerCase().replace(/[\\/]+$/, '').replaceAll('\\', '/');
        const normPP = backupSetupProject.toLowerCase().replace(/[\\/]+$/, '').replaceAll('\\', '/');

        if (normBP !== normPP) {
            const projectFolderName = backupSetupProject.split(/[\\/]/).filter(Boolean).pop() || 'project';
            const separator = backupSetupPath.includes('/') ? '/' : '\\';
            const effectivePath = backupSetupPath.endsWith(separator)
                ? `${backupSetupPath}${projectFolderName}`
                : `${backupSetupPath}${separator}${projectFolderName}`;
            return effectivePath;
        }
        return backupSetupPath;
    })()}</span>
</div>
```

**What changed:**
- Instead of showing the raw `backupSetupPath`, we show the EFFECTIVE path (with project name appended) so the user sees exactly where the `.draft` folder will be created.
- If user selected `D:\MyBackups` for project `MyProject`, display shows `D:\MyBackups\MyProject`
- If user kept the default (project path), display shows the project path unchanged.

### Step 3: Also show the `.draft` suffix for clarity (OPTIONAL but recommended)

In the same popup display span, you could append `\.draft` to make it crystal clear:

**Replace the span content with:**
```tsx
<span>{(() => {
    if (!backupSetupPath) return 'No folder selected';
    if (!backupSetupProject) return backupSetupPath;

    const normBP = backupSetupPath.toLowerCase().replace(/[\\/]+$/, '').replaceAll('\\', '/');
    const normPP = backupSetupProject.toLowerCase().replace(/[\\/]+$/, '').replaceAll('\\', '/');

    let effectivePath = backupSetupPath;
    if (normBP !== normPP) {
        const projectFolderName = backupSetupProject.split(/[\\/]/).filter(Boolean).pop() || 'project';
        const separator = backupSetupPath.includes('/') ? '/' : '\\';
        effectivePath = backupSetupPath.endsWith(separator)
            ? `${backupSetupPath}${projectFolderName}`
            : `${backupSetupPath}${separator}${projectFolderName}`;
    }
    return effectivePath;
})()}</span>
```

This is basically the same as Step 2 but in cleaner variable form for readability. Use whichever you prefer. The key point: the display MUST match the actual path computed in `confirmBackupSetup()`.

---

## What NOT to Change (Critical — Read Carefully)

### ❌ DO NOT modify `DraftControlSystem.ts`
The constructor already handles any `storageRoot` path. No changes needed. The `.draft` folder is always placed inside `storageRoot`. We're just changing what we PASS as `storageRoot`.

### ❌ DO NOT modify `getBackupPath()` in Home.tsx
This function reads from localStorage and returns whatever is stored. Since we now store the effective path (with project name already appended), it returns the correct value automatically.

### ❌ DO NOT modify `ProjectSettings.tsx`
This page reads `backupPath` from localStorage and displays it. Since we stored the effective path, it will correctly display `D:\MyBackups\MyProject`. The "Open .draft folder" button uses this path and will work correctly.

### ❌ DO NOT modify `InspectorPanel.tsx`, `Cleanup.tsx`, or `SnapshotsTab.tsx`
These all receive `backupPath` as a prop from `Home.tsx` via `getBackupPath()`. They pass it to the IPC calls. Since the stored path is already the effective path, everything works.

### ❌ DO NOT modify `electron/main/index.js`
All IPC handlers receive `backupPath` from the renderer and pass it to `DraftControlSystem(projectRoot, backupPath)`. No changes needed.

### ❌ DO NOT modify `electron/preload/index.js`
This just bridges IPC calls. No changes needed.

### ❌ DO NOT add any migration code
Existing projects have their `backupPath` in localStorage already pointing to the correct location. They will continue to work exactly as before. New projects will get the project-name-appended path. No migration needed.

---

## Edge Cases Handled

### Edge Case 1: Two projects with the same folder name
Example: `D:\Work\MyProject` and `D:\Personal\MyProject` both pick `D:\MyBackups`.
Both would get `D:\MyBackups\MyProject\.draft`.

**This is acceptable** because:
- In practice, this is extremely rare
- The second project's `init()` would find `.draft` already exists and just ensure subdirs exist
- But the version history would be shared (same bug as before, just rarer)

**If you want to handle this** (OPTIONAL enhancement, not in scope for this PR):
Use a hash suffix: `D:\MyBackups\MyProject-a7c3\` where `a7c3` is the first 4 chars of a hash of the full project path. But this adds complexity and hurts readability.

### Edge Case 2: User selects the project folder itself as backup
Example: Project at `D:\Work\MyProject`, user clicks "Browse" and selects `D:\Work\MyProject`.
`normBPath === normProjPath` → no appending → `.draft` lives inside the project. Same as current default behavior. ✅

### Edge Case 3: User selects a parent of the project as backup
Example: Project at `D:\Work\MyProject`, user selects `D:\Work`.
`normBPath !== normProjPath` → appends project name → effective path = `D:\Work\MyProject`.
This means `.draft` ends up at `D:\Work\MyProject\.draft`, which is the same as the project root. **This is fine** — it's effectively the default behavior.

### Edge Case 4: Existing project with external backup, already stored
Example: Old project had `backupPath = "D:\MyBackups"` already stored.
This project opens → `openWorkspace()` sees `hasBackup` is truthy → skips `confirmBackupSetup()` entirely → uses `D:\MyBackups` as-is → finds `.draft` at `D:\MyBackups\.draft` → works perfectly. ✅

### Edge Case 5: Project folder name has special characters
Example: Project at `D:\Work\My Project (v2)`.
The folder name `My Project (v2)` is extracted and appended: `D:\MyBackups\My Project (v2)`.
This is a valid Windows folder name, so it works. The `fs.mkdir` call with `{ recursive: true }` handles creation.

### Edge Case 6: Windows path separators
The code normalizes using `backupSetupPath.includes('/') ? '/' : '\\'` to detect the separator style already present in the path. On Windows, paths from the Electron folder picker dialog always use `\`, so this will use `\`. ✅

---

## Testing Checklist

After implementing, verify these scenarios:

### Test 1: New project, default backup (project root)
1. Open a folder that has never been opened before
2. In the backup setup popup, do NOT click "Browse" — keep the default path
3. Click "Confirm & Open"
4. **Expected:** `.draft` folder created inside the project folder
5. **Verify:** Check localStorage → `backupPath` equals project path

### Test 2: New project, external backup folder
1. Open a new folder
2. In the popup, click "Browse" and select `D:\TestBackups`
3. **Expected display:** Popup should show `D:\TestBackups\<ProjectFolderName>`
4. Click "Confirm & Open"
5. **Expected:** `.draft` folder created at `D:\TestBackups\<ProjectFolderName>\.draft`
6. **Verify:** Navigate to `D:\TestBackups\<ProjectFolderName>` in Windows Explorer and confirm `.draft` exists

### Test 3: Two projects, same external backup folder
1. Create two project folders: `D:\TestA` and `D:\TestB`
2. Open `D:\TestA`, set backup to `D:\SharedBackups` → should resolve to `D:\SharedBackups\TestA`
3. Open `D:\TestB`, set backup to `D:\SharedBackups` → should resolve to `D:\SharedBackups\TestB`
4. Create a snapshot in each project
5. **Verify:** Each project's snapshots are independent

### Test 4: Existing project backward compatibility
1. Before applying changes, create a project with external backup at `D:\OldBackup`
2. Verify `.draft` exists at `D:\OldBackup\.draft`
3. Apply the code changes
4. Reopen the existing project
5. **Expected:** Project opens normally, finds `.draft` at `D:\OldBackup\.draft`
6. **Verify:** Snapshots, history, restore all work perfectly

### Test 5: Project Settings page displays correctly
1. Open a project that uses an external backup
2. Navigate to Project Settings
3. **Verify:** "Backup Location" shows the correct effective path
4. **Verify:** "Open .draft folder" button opens the correct folder

### Test 6: Speed check
1. Open any project
2. **Verify:** No perceivable delay during project opening
3. The auto-append is a simple string operation (sub-millisecond) — no file system calls added

---

## Code Diff Summary

```
Files changed: 1
  src/pages/Home.tsx
    - confirmBackupSetup(): Changed `const bPath` to `let bPath`, added 15 lines of auto-append logic
    - Backup setup popup display: Updated span to show effective path with project name appended

Lines added: ~30
Lines removed: 2  (the `const` → `let` change, and the simple display span)
```

---

## Why This Doesn't Compromise Speed

1. **Zero additional file system calls.** The auto-append is pure string manipulation (split, join, compare). No `fs.existsSync`, no `fs.readFile`, no `getStats`.
2. **Only runs once per new project setup.** After that, the computed path is stored in localStorage and read directly.
3. **No changes to hot paths.** `getBackupPath()`, `loadDirectory()`, `fetchStats()`, `DraftControlSystem` constructor — none of these are modified.
4. **No additional IPC calls.** The same `draft:init` call happens with the same signature.

---

## Why This Doesn't Break Any Existing Feature

| Feature | Why It Still Works |
|---|---|
| **Snapshot creation** | Uses `getBackupPath()` → reads stored path → same as before |
| **Version history** | Same path passed to `draft:history` → same `.draft/versions/` read |
| **Restore** | Same path passed to `draft:restore` → restores from correct `.draft` |
| **File metadata** | Stored inside `.draft/metadata/` → found at correct location |
| **Project metadata** | `metadata.json` inside `.draft` → correct location |
| **Attachments** | Stored inside `.draft/attachments/` → correct location |
| **Storage report / Cleanup** | Uses `getBackupPath()` → correct `.draft` |
| **Inspector panel** | Receives `backupPath` prop → passes to IPC → correct |
| **AI auto-commit** | Reads `backupPath` from localStorage → correct |
| **Project Settings display** | Reads `backupPath` from localStorage → shows correct effective path |
| **"Open .draft folder" button** | Uses stored `backupPath` → opens correct folder |
| **.draftignore read/write** | Uses stored `backupPath` → correct `.draft/.draftignore` |
| **File watcher** | Watches project directory, unrelated to backup path |
| **Hidden files filter** | Filters `.draft` by name, unrelated to backup path |
