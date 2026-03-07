# DraftWolf Feasibility: Unity & Unreal Engine Projects

**Date:** February 14, 2026 (updated March 2, 2026)  
**Version:** 1.1.10 (Local-First Architecture)

---

## 1. Executive Summary

DraftWolf's local-first, snapshot-based version control model is **highly feasible for solo and small-team game development workflows** in both Unity and Unreal Engine. Its Content-Addressable Storage (CAS) with Brotli compression, folder-level snapshots, and binary-friendly design directly address the pain points of versioning game projects — large binary assets, coupled file dependencies, and the need for a simple, non-destructive workflow.

This document analyzes how DraftWolf's current architecture maps to real-world Unity and Unreal project structures, identifies where it excels, and outlines the gaps that need to be addressed for production-grade engine support.

---

## 2. Game Engine Project Anatomy

### 2.1 Unity Project Structure

```
MyUnityProject/
├── Assets/                    # ← Core creative content (models, textures, scripts, prefabs)
│   ├── Materials/             #   .mat files (binary, small)
│   ├── Models/                #   .fbx, .blend (binary, large — 10MB–500MB+)
│   ├── Prefabs/               #   .prefab (YAML text, medium)
│   ├── Scenes/                #   .unity (YAML text, large — 1MB–50MB)
│   ├── Scripts/               #   .cs files (text, small)
│   └── Textures/              #   .png, .psd, .tga (binary, large — 5MB–200MB+)
├── Packages/                  # Package manifest (text, small)
├── ProjectSettings/           # .asset files (YAML text, small)
├── Library/                   # ⚠️ GENERATED — must be excluded (10GB+)
├── Temp/                      # ⚠️ GENERATED — must be excluded
├── Logs/                      # ⚠️ GENERATED — must be excluded
├── obj/                       # ⚠️ GENERATED — must be excluded
└── UserSettings/              # Per-user layout prefs (optional exclude)
```

**Key Characteristics:**
| Property | Value |
| :--- | :--- |
| Typical project size (without Library/) | 1GB – 50GB |
| Library/ cache size | 5GB – 30GB |
| Dominant file types | .fbx, .png, .psd, .tga, .unity, .prefab, .mat, .cs |
| Binary-to-text ratio | ~70% binary / 30% text |
| File coupling | High (Materials → Textures → Models → Prefabs → Scenes) |

### 2.2 Unreal Engine Project Structure

```
MyUnrealProject/
├── Content/                   # ← Core creative content (.uasset, .umap)
│   ├── Blueprints/            #   .uasset (binary, 50KB–5MB)
│   ├── Maps/                  #   .umap (binary, 10MB–500MB+)
│   ├── Materials/             #   .uasset (binary)
│   ├── Meshes/                #   .uasset, .fbx (binary, large)
│   └── Textures/              #   .uasset (binary, large)
├── Source/                    # C++ source files (text, small)
├── Config/                    # .ini files (text, small)
├── Intermediate/              # ⚠️ GENERATED — must be excluded (20GB+)
├── Saved/                     # ⚠️ GENERATED — must be excluded
├── Binaries/                  # ⚠️ GENERATED — must be excluded
├── DerivedDataCache/          # ⚠️ GENERATED — must be excluded (10GB+)
└── .vs/ or .idea/             # IDE cache — must be excluded
```

**Key Characteristics:**
| Property | Value |
| :--- | :--- |
| Typical project size (without generated) | 5GB – 200GB |
| Generated folder sizes | 20GB – 100GB+ |
| Dominant file types | .uasset, .umap (opaque binary) |
| Binary-to-text ratio | ~95% binary / 5% text |
| File coupling | Extreme (Unreal packages embed references internally) |

---

## 3. Feasibility Analysis: DraftWolf vs Engine Requirements

### 3.1 ✅ Where DraftWolf Excels

#### Folder Snapshots — Perfect for Coupled Assets
Game engine assets are deeply interdependent. A character prefab in Unity references a mesh, which references materials, which reference textures. Changing any single file can break the chain.

DraftWolf's **folder-level snapshot** model is a natural fit:
- Snapshot an entire `Assets/Characters/Knight/` folder atomically.
- Guarantees that the mesh, materials, and textures are always captured together.
- Restore returns the entire folder to a known-good state — no partial corruption.

> **Verdict:** DraftWolf's snapshot model is *more intuitive* than Perforce changelists or Git commits for artists working on coupled asset bundles.

#### Content-Addressable Storage (CAS) — Efficient for Iterative Art
Game art goes through many iterations with small changes (e.g., texture tweaks, UV adjustments). DraftWolf's SHA-256 CAS with deduplication means:
- If 8 out of 10 files in a folder snapshot are unchanged, only 2 new blobs are stored.
- Brotli compression reduces binary storage by 20–60% depending on file type.

| File Type | Typical Size | Brotli Compression Ratio |
| :--- | :--- | :--- |
| .png (textures) | 5–50MB | 5–15% reduction (already compressed) |
| .psd (layered) | 50–500MB | 30–50% reduction |
| .fbx (models) | 10–200MB | 40–60% reduction |
| .unity (scenes) | 1–50MB | 60–80% reduction (YAML text) |
| .uasset (UE) | 1–500MB | 15–40% reduction |
| .cs / .cpp (code) | 1–100KB | 70–85% reduction |

> **Verdict:** CAS deduplication is extremely effective for the iterative nature of game art pipelines.

#### Zero-Config Setup — Ideal for Solo/Indie Devs
Unlike Perforce (requires a server) or even Git LFS (requires a remote), DraftWolf works instantly:
1. Open folder in DraftWolf.
2. Start snapshotting.

No `.gitattributes`, no LFS configuration, no server provisioning. This is a major selling point for:
- Solo indie developers
- Game jam participants
- Freelance 3D artists
- Students learning game development

#### Visual Diff for Binaries
DraftWolf already supports image and 3D visual diff. This directly serves the game dev workflow where `.png`, `.jpg`, `.fbx`, and `.blend` files are the primary work products.

### 3.2 ⚠️ Feasible with Caveats

#### Project Size Concerns
| Scenario | Feasibility | Notes |
| :--- | :--- | :--- |
| Small Unity project (<5GB) | ✅ Excellent | Snapshots are fast, storage is manageable |
| Medium Unity project (5–20GB) | ✅ Good | CAS deduplication keeps `.draft` size reasonable |
| Large UE project (20–100GB) | ⚠️ Moderate | Full-folder snapshots become slow; need partial workspace support |
| AAA UE project (100GB+) | ❌ Not ready | Requires streaming/partial workspace, which is not yet implemented |

#### Generated Folder Exclusion
Both engines produce massive generated caches (`Library/`, `Intermediate/`, `DerivedDataCache/`). These **must never be versioned**.

**Current State:** DraftWolf excludes `.draft` but does not have a configurable ignore/exclude system (equivalent to `.gitignore`).

**Required:** A `.draftignore` file or built-in rules to automatically exclude:

```
# Unity
Library/
Temp/
Logs/
obj/
Build/
UserSettings/

# Unreal
Intermediate/
Saved/
Binaries/
DerivedDataCache/
.vs/
```

> **Impact:** Without this, DraftWolf will attempt to snapshot 30GB+ of regeneratable cache, making it impractical for any real engine project. **This is the single most critical gap.**

#### Large File Performance
DraftWolf currently reads, hashes (SHA-256), and compresses (Brotli) files sequentially. For a 500MB `.umap` file:
- Hashing: ~2–5 seconds
- Compression: ~10–30 seconds
- Total per large file: ~15–35 seconds

For a folder with 50 large assets, a snapshot could take **5–15 minutes**. This is acceptable for explicit "save my work" snapshots but too slow for automatic background monitoring.

**Mitigation strategies (future):**
- Chunked hashing with early-exit if hash prefix matches
- Parallel compression using worker threads
- Incremental snapshots (only re-hash files with changed `mtime`)

### 3.3 ❌ Current Gaps for Engine Projects

| Gap | Impact | Priority |
| :--- | :--- | :--- |
| **~~No `.draftignore`~~** | ✅ **Implemented** — `.draftignore` file in `.draft/` with .gitignore syntax, 7 presets (Unreal, Unity, Godot, Node.js, Python, Blender, OS). Patterns are enforced during `createSnapshot` and `commit`. | ✅ Done |
| **No partial workspace** | Cannot version just `Content/Characters/` without including all of `Content/` | 🟡 High |
| **No engine plugins** | Users must alt-tab to DraftWolf to snapshot. Kills flow. | 🟡 High |
| **No cloud sync** | Solo-only. Teams can't share snapshots. | 🟡 High |
| **No file locking** | Two artists can edit the same `.uasset` simultaneously without warning | 🟡 High |
| **Large file streaming** | Files >1GB may cause memory pressure during hashing/compression | 🟠 Medium |
| **No `.meta` file awareness (Unity)** | Unity pairs every asset with a `.meta` file. DraftWolf should treat them as linked. | 🟠 Medium |

---

## 4. Engine-Specific Considerations

### 4.1 Unity-Specific

#### `.meta` File Pairing
Unity generates a `.meta` file for every asset. These contain the asset's GUID and import settings. If a `.meta` file is lost or mismatched, Unity re-imports the asset, potentially breaking all references.

**Recommendation:** DraftWolf should treat `{file}` + `{file}.meta` as an atomic pair. When restoring a snapshot, both files must be restored together. This is already naturally handled by folder snapshots, but should be explicitly enforced for single-file versions.

#### Force Text Serialization
Unity projects using "Force Text" serialization (recommended) store `.unity`, `.prefab`, `.asset`, and `.mat` files as YAML. These compress extremely well with Brotli (60–80% reduction) and are theoretically diffable.

**Opportunity:** DraftWolf could offer a "Unity Scene Diff" view that parses YAML to show which GameObjects changed between snapshots.

#### Asset Database Refresh
After restoring a snapshot, Unity's `AssetDatabase` must be refreshed. This happens automatically when Unity detects file changes, but could be slow for large projects.

**Plugin opportunity:** A Unity Editor plugin could call `AssetDatabase.Refresh()` after DraftWolf signals a restore completion.

### 4.2 Unreal-Specific

#### Opaque Binary Formats
Unreal's `.uasset` and `.umap` files are proprietary binary formats. They cannot be diffed textually. DraftWolf's visual diff (image/3D) won't apply to most Unreal assets.

**Impact:** Version comparison for Unreal is limited to "this snapshot vs that snapshot" at the folder level, without file-level insight. This matches Perforce's behavior for binary files.

#### One-File-Per-Asset (OFPA) / World Partition
Unreal Engine 5 introduced **One File Per Actor (OFPA)** and **World Partition**, which split large maps into thousands of small `.uasset` files instead of one giant `.umap`.

**Impact on DraftWolf:**
- ✅ Positive: Many small files means better CAS deduplication.
- ⚠️ Caveat: A single `Content/Maps/` folder could contain 10,000+ files, making snapshot scanning slower.

#### Derived Data Cache
Unreal's `DerivedDataCache/` (DDC) can be 50GB+ and is entirely regeneratable. It **must** be excluded.

---

## 5. Recommended Adoption Path

### Phase 1: Solo Artist / Indie Developer (Now)
**Target:** Individual developers or tiny teams (1–3 people) working on small-to-medium Unity or UE projects.

**What works today:**
- Open the project's asset folder (e.g., `Assets/` or `Content/`) in DraftWolf
- Take folder snapshots of specific asset groups (e.g., `Characters/`, `Levels/Level1/`)
- Use visual diff to compare texture iterations
- Use "Time Travel" to restore a working state after breaking changes

**Workaround for missing `.draftignore`:** Point DraftWolf at `Assets/` or `Content/` specifically, not the project root. This naturally excludes generated folders.

### Phase 2: Small Team Ready (After Critical Gaps)
**Required features:**
1. `.draftignore` file support
2. File locking (Firestore-backed)
3. Cloud sync for shared snapshots

### Phase 3: Studio Adoption (Future)
**Required features:**
1. Engine plugins (Unity Editor window, UE Editor plugin)
2. Partial workspace / virtual file system
3. Team permissions & ACLs
4. Performance optimization for 100GB+ projects

---

## 6. Competitive Positioning

| Use Case | Best Tool | DraftWolf Fit |
| :--- | :--- | :--- |
| Solo indie dev, art-heavy project | **DraftWolf** | ✅ Perfect — simple, local, visual |
| Small Unity team (3–5 people) | Plastic SCM | ⚠️ Feasible after cloud + locking |
| Small UE team (3–5 people) | Perforce / Plastic | ⚠️ Feasible after cloud + locking |
| AAA studio (50+ people) | Perforce | ❌ Not feasible — needs enterprise infra |
| Game jam (48-hour event) | **DraftWolf** | ✅ Perfect — zero setup, instant |
| Freelance 3D artist | **DraftWolf** | ✅ Perfect — no server needed |
| University game dev course | **DraftWolf** | ✅ Perfect — free, simple, educational |

---

## 7. Conclusion

DraftWolf is **already usable** for Unity and Unreal Engine projects when pointed at the correct asset subdirectories. Its folder snapshot model, CAS deduplication, and visual diff capabilities are genuinely well-suited to the game development workflow.

The **single most critical blocker** for wider adoption is the lack of a `.draftignore` system. Without it, users must manually avoid snapshotting the project root, which is error-prone and unintuitive.

Once `.draftignore` support, file locking, and cloud sync are implemented, DraftWolf becomes a compelling alternative to Plastic SCM for small teams — with the advantage of zero-config setup and a dramatically better user experience.

**Bottom line:** DraftWolf's architecture is fundamentally sound for game engine projects. The gaps are feature-level, not architectural. The path from "usable for solo devs" to "competitive for small studios" is clear and achievable.
