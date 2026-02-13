# Case Study: Draftwolf vs. Perforce & Unity Plastic SCM

## 1. Executive Summary

**Draftwolf** is a modern, local-first version control system designed specifically for creatives, artists, and game developers who find traditional tools like Git too technical or Perforce too cumbersome. It focuses on "Folder Snapshots", an intuitive UI, and handling large binary assets without the need for a complex server setup.

**Perforce (Helix Core)** is the industry standard for AAA game development, offering centralized, server-based version control capable of handling petabytes of data and thousands of users. It is powerful but requires significant infrastructure and maintenance.

**Unity Plastic SCM** is a version control system tailored for game development, known for its visual branching and strong integration with the Unity engine. It bridges the gap between distributed (Git-like) and centralized (Perforce-like) workflows.

This case study compares Draftwolf’s current capabilities against these industry giants to identify its unique value proposition and the gaps it needs to fill to compete effectively.

---

## 2. Detailed Comparison

### Architecture & Setup
*   **Draftwolf:** Operates on a **local-first** model. It creates a hidden `.draft` folder within the project directory, managing versions and content-addressable storage locally. There is zero server setup required, making it instant to start for solo developers.
*   **Perforce:** Relies on a **Client-Server** architecture. Requires a dedicated server (Helix Core) to be set up and maintained. It is designed for centralized control.
*   **Plastic SCM:** Hybrid model supporting both distributed and centralized workflows. Can run with a local server or connect to a cloud/central server.

### User Experience (UX)
*   **Draftwolf:** Prioritizes **aesthetics and simplicity**. Uses a "Glassmorphism" design with a focus on visual feedback (folder snapshots, previews). It abstracts away complex VCS terminology (commit, stage, push) in favor of "Snapshots" and "Time Travel".
*   **Perforce:** Utilitarian and complex. The visual client (P4V) is feature-rich but has a steep learning curve. It creates a workspace mapping that can be confusing for new users.
*   **Plastic SCM:** Visual-centric. Its "Branch Explorer" provides a clear graph of project history. It is friendlier than Perforce but still exposes detailed VCS concepts.

### Versioning Model
*   **Draftwolf:** **Folder-based Snapshots**. It treats a folder structure as an atomic unit, ensuring that dependent assets (e.g., a `.blend` file and its textures) are captured together. It uses Content-Addressable Storage (CAS) for deduplication.
*   **Perforce:** **File-based w/ Changelists**. Users group file changes into numbered changelists. It relies heavily on explicit "checkout" (locking) of files before editing.
*   **Plastic SCM:** **Changeset-based**. Similar to Git but handles large binaries better. Supports "Gluon" for partial workspace loading (checking out only what you need).

---

## 3. Feature Comparison: What We Have vs. The Industry

### Local & Core Features
| Feature | Draftwolf (Current) | Perforce Helix Core | Unity Plastic SCM |
| :--- | :--- | :--- | :--- |
| **Core Architecture** | Local-Only (Folder .draft) | Client-Server | Distributed / Centralized |
| **Setup Difficulty** | Instant (Zero Config) | High (Requires Admin) | Medium (Cloud or Local) |
| **Asset Handling** | CAS + Compression (Brotli) | Git LFS Killer (Native) | Strong Large File Support |
| **Workflow Paradigm** | "Snapshots" (Folder State) | "Checkout & Submit" | "Checkin/Push" or Gluon |
| **Visual Interface** | High-Fidelity (Glassmorphism) | Functional / Enterprise | Visual Branch Explorer |
| **Smart De-duplication**| ✅ Yes (SHA-256 CAS) | ✅ Yes (Server-side) | ✅ Yes |
| **Change Detection** | ✅ Auto-Monitoring + Notification | Explicit Checkout / Reconcile | Automatic Detection |
| **Visual Diffing** | ✅ Yes (Image + 3D) | ✅ Yes (P4V/Helix Swarm) | ✅ Yes (Image/Text) |
| **Engine Plugins** | ❌ No (External App only) | ✅ Yes (Unreal, Unity, etc.) | ✅ Yes (Deep Unity Integration) |

### Cloud & Collaboration Features
| Feature | Draftwolf (Planned) | Perforce Helix Core | Unity Plastic SCM |
| :--- | :--- | :--- | :--- |
| **Cloud / Sync** | ❌ No (Local Only) | ✅ Yes (Perforce Streams) | ✅ Yes (Plastic Cloud) |
| **File Locking** | ❌ No | ✅ Yes (Checkout Locks) | ✅ Yes (Exclusive Checkout) |
| **Partial Workspace** | ❌ No (Loads full folder) | ✅ Yes (Mappings) | ✅ Yes (Gluon) |
| **Team/Permissions** | ❌ No | ✅ Yes (Granular ACLs) | ✅ Yes (User Groups) |
| **Cost** | Free (Local) | Enterprise ($$$) / Free <5 users | Subscription / Free <3 users |

---

## 4. Competitive Roadmap: Features Needed to Compete

To transition from a "local tool for freelancers" to a viable competitor against Perforce and Plastic SCM, Draftwolf needs to implement the following critical features, categorized by scope.

### Cloud Infrastructure (The "Wolf Pack")

#### 1. Cloud Synchronization & Collaboration
*   **Requirement:** Users must be able to push their local snapshots to a remote server (Firebase/AWS) to collaborate with others.
*   **Why:** Collaboration is the primary reason teams use Perforce/Plastic. Without it, Draftwolf is limited to solo use.

#### 2. Exclusive File Locking (Binary Locking)
*   **Requirement:** Implement a system to "lock" a file on the server so no one else can edit it while a user is working on it.
*   **Why:** Binary files (images, 3D models) cannot be merged textually. Locking prevents merge conflicts, which is the #1 selling point of Perforce for game studios.

#### 3. Team Permissions & ACLs
*   **Requirement:** Admin controls to define who can read/write specifically folders or projects.
*   **Why:** Studios need to protect IP and prevent contractors from accessing sensitive core code.

### Local Experience & Enhancements

#### 4. Partial Workspaces (Virtual File System)
*   **Requirement:** Allow users to download/see only the files they need, or stream files on demand, rather than syncing the entire multi-gigabyte project.
*   **Why:** Game projects can be 100GB+. Artists shouldn't need to download the entire engineer codebase to change one texture.

#### 5. Direct Engine Integrations (Plugins)
*   **Requirement:** Plugins for Unity, Unreal Engine, Blender, and Photoshop that allow users to Snapshot/Lock files directly inside their creative tools.
*   **Why:** Context switching breaks flow. Perforce and Plastic live inside the game engine; Draftwolf currently lives in its own window.
