# Feature Implementation Prompts

This document contains a set of prompts to be used in a fresh chat session to implement specific features for DraftWolf. The features are ordered from easiest to hardest to integrate.

## 1. Background File Monitoring & System Messages (Easy)
**Context:** The application already uses `chokidar` for file watching. We need to move from potential immediate actions (or no actions) to a polling-based notification system.
**Prompt:**
> I need to implement a background file monitoring system for the active project.
> 1.  Utilize the existing `chokidar` integration to watch the open workspace.
> 2.  Instead of triggering immediate actions, track changed, added, or updated files in a "Change Buffer".
> 3.  Implement a user setting for "Change Notification Interval" (default: 30 minutes).
> 4.  Create a background timer that triggers based on this interval.
> 5.  When the timer fires, if there are changes in the buffer, send a system message/notification to the user: "The following files have changed [list top 3...]. Do you want to version them now?"
> 6.  Ensure this runs unobtrusively in the background.

## 2. Custom Version Storage Location (Medium)
**Context:** Currently, `.draft` folders are likely created directly in the project root. Users need the ability to centralize or offload this storage to avoid cluttering the source directory.
**Prompt:**
> I want to separate the version history data from the source code.
> 1.  Add a new option in the 'General' Settings page: "Version Storage Path".
> 2.  This should allow the user to select a folder on their local machine.
> 3.  Refactor the backend `DraftControlSystem` (or equivalent storage service) to look for and create the `.draft` directory in this specified path.
> 4.  If the setting is empty, fallback to the default behavior (creating `.draft` inside the project root).
> 5.  Handle the migration case: If the user changes the path, ask if they want to move existing version history to the new location.

## 3. Exclusive File Locking (Medium)
**Context:** Essential for collaborative workflows, especially with binary files that cannot be merged.
**Prompt:**
> Implement an "Exclusive File Locking" feature to prevent conflicts.
> 1.  **Data Structure:** Create a mechanism to track "Locks". A lock consists of `filePath`, `userId`, and `timestamp`.
> 2.  **UI:** Add specific context menu options for files: "Lock File" and "Unlock File".
> 3.  **Visualization:** Display a "Lock" icon next to files in the file explorer that are currently locked.
> 4.  **Enforcement:**
>     *   If I lock a file, I can edit/version it.
>     *   If someone else (or another instance) holds the lock, disable the "Save Version" button for that file and show a tooltip: "Locked by [User]".
> 5.  **Backend:** Since we are using Firebase (implied by dependencies), use a Firestore collection or Realtime Database path to sync locks across users in real-time.

## 4. Visual Diff for Binaries (Hard)
**Context:** Text diffs are standard. Binary diffs (Images, 3D models) require specialized rendering. We have `three` and `@react-three/fiber` installed, enabling 3D diffs.
**Prompt:**
> I need to add "Visual Diffing" capabilities for binary files in the History view.
> 1.  **Architecture:** Create a `DiffViewer` component that accepts `oldPath` and `newPath` and switches logic based on file extension.
> 2.  **Image Diff (PNG/JPG):**
>     *   Implement a "Slider" view (slide over one image to reveal the other).
>     *   Implement a "Side-by-Side" view.
>     *   Implement an "Overlay" view (onion skinning).
> 3.  **3D Model Diff (GLB/GLTF/OBJ):**
>     *   Use `@react-three/fiber` to render the old and new models.
>     *   Provide a split-screen view where rotating one camera rotates the other (synchronized controls).
>     *   Highlight geometry changes if possible (e.g., color non-matching vertices), or simply show a clean side-by-side render.

## 5. Partial Workspace (Hardest)
**Context:** This requires a fundamental change to how the file explorer acts, separating "Known Files" from "Downloaded/Present Files".
**Prompt:**
> Implement "Partial Workspace" functionality to handle large projects where not every file needs to be local.
> 1.  **Virtual File System (UI Level):** detailed view of the project structure that includes files that might NOT exist on the local disk yet (ghost files).
> 2.  **State Management:** Track the status of every file: `Local` (on disk) vs `Remote` (in metadata/cloud but not downloaded) vs `Excluded` (partial).
> 3.  **Unload Action:** Allow users to right-click a folder and select "Unload". This deletes the local files but keeps the metadata in the explorer with a "Cloud icon".
> 4.  **Load Action:** Double-clicking a "Ghost" file should prompt to download/restore it from the version storage.
> 5.  **Watcher Integration:** Ensure `chokidar` does not freak out when files are "Unloaded" (deleted). It should recognize this is an intentional partial workspace state, not a deletion to be versioned.

---

# Additional Suggested Prompts
These are recommended features that complement the requested ones and fit the "Modern/AA" aesthetic and tech stack.

## 6. Smart Semantic Commit Grouping (AI Powered)
> "Integrate an AI step before the 'Version' prompt. When the background monitor detects changes, pass the file names and diff summaries to an LLM. Have it propose a 'Grouped' commit message and separate unrelated changes into suggested separate versions (atomic commits)."

## 7. Dependency Graph & Impact Analysis
> "Since we have `three.js`, create a 3D node graph visualization of the project files. Show how files reference each other (imports). When a file is modified, highlight the 'Blast Radius' (all files that import the modified file) in red on the graph to show potential impact."

## 8. Plugin/Add-on System Architecture
> "Design a modular Plugin System. Allow third-party developers (or us) to write small JS modules that add support for specific file types (e.g., a specific `.wav` audio visualizer for diffing, or a `.psd` parser). Create an interface `IFileViewer` that plugins can implement."
