# DraftWolf - Roadmap & TODO

**Current Version:** 1.1.9  
**Last Updated:** February 13, 2026

---

## 🚀 Immediate Focus: Advanced Version Control (The "Snapshots" Engine)
*Focus: Supporting the complex workflow of 3D/VFX artists.*

- [x] **Folder Versioning (Snapshots)**  
  - Treat entire folders as atomic units to preserve dependencies (e.g., `.blend` files + textures).
  - Create recursive manifests for folder states.

- [x] **Content-Addressable Storage (CAS)**  
  - [x] **Deduplication**: Store files by SHA-256 hash. Never store duplicate data.
  - [x] **Compression**: Compress blobs (Zstd/Brotli) before writing to disk.
  - [x] **Garbage Collection**: Mechanism to prune orphaned blobs.

- [x] **UI Updates**  
  - [x] Add "Snapshots" tab to Inspector Panel.
  - [x] Visualization for Folder History/Timeline.
  - [x] Storage usage stats (e.g., "Saved 2GB via compression").

---

## 🛠️ Refinement & Polish (v1.2.0 Prep)
- [x] **Background File Monitoring**: Recursive chokidar watcher with change buffer, configurable interval, native OS notifications with actions (Version, Snooze, Dismiss).
- [x] **Save Location for Versions**: Prompt user to pick a `.draft` storage location; changeable in Settings.
- [x] **`.draftignore` Support**: Ignore patterns (`.gitignore` syntax) to exclude files from snapshots. Configurable via Project Settings UI with 7 built-in presets.
- [ ] **Exclusive File Locking**: Implement file locking to prevent concurrent edits in team workflows.
- [ ] **Partial Workspace**: Allow versioning a subset of the workspace instead of the full tree.
- [x] **Visual Diff for Binaries**: Side-by-side comparison for images (Slider, Overlay) and 3D models (Synced Camera).
- [ ] **Large File Handling**: Optimize performance for >1GB files (chunking/streams).
- [ ] **Onboarding**: Create a "First Run" tour using `shepherd.js` or similar.
- [ ] **Settings**: Add configuration for storage location and compression intensity.

---

## 📢 Marketing & Launch Base
- [ ] **Landing Page**: Deploy initial version with clearer value prop ("Git for Creatives").
- [ ] **Demo Video**: Record 60s "Problem vs Solution" clip.
- [ ] **Community**: Start engaging in r/blender and r/gamedev.

---

## 🔮 Future Backlog
- **Cloud Integration**: Firebase Storage sync & selective backup.
- **Team Features**: Shared workspaces & activity feeds.
- **AI Suite**: 
  - Visual Semantic Search ("Find the red sword").
  - Texture Generation (Prompt-to-Image).
- **Plugins**: Native integrations for Blender, Photoshop, and Unity.
