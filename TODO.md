# DraftWolf - Roadmap & TODO

**Current Version:** 1.1.9  
**Last Updated:** February 08, 2026

---

## 🚀 Immediate Focus: Advanced Version Control (The "Snapshots" Engine)
*Focus: Supporting the complex workflow of 3D/VFX artists.*

- [ ] **Folder Versioning (Snapshots)**  
  - Treat entire folders as atomic units to preserve dependencies (e.g., `.blend` files + textures).
  - Create recursive manifests for folder states.

- [ ] **Content-Addressable Storage (CAS)**  
  - [ ] **Deduplication**: Store files by SHA-256 hash. Never store duplicate data.
  - [ ] **Compression**: Compress blobs (Zstd/Brotli) before writing to disk.
  - [ ] **Garbage Collection**: Mechanism to prune orphaned blobs.

- [ ] **UI Updates**  
  - [ ] Add "Snapshots" tab to Inspector Panel.
  - [ ] Visualization for Folder History/Timeline.
  - [ ] Storage usage stats (e.g., "Saved 2GB via compression").

---

## 🛠️ Refinement & Polish (v1.2.0 Prep)
- [ ] **Large File Handling**: Optimize performance for >1GB files (chunking/streams).
- [ ] **Onboarding**: create a "First Run" tour using `shepherd.js` or similar.
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
