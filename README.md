# 🐺 DraftWolf

### *Because "final_final_v2.docx" is a lie we tell ourselves.*

Welcome to **DraftWolf**, the desktop application that understands your commitment issues with file versions. Built with the holy trinity of **React**, **TypeScript**, and **Electron**, we're here to save your files (and your sanity) from the abyss of chaos.

---

## 🤔 Why DraftWolf?

We've all been there. Your folder looks like a graveyard of good intentions:
- `script.txt`
- `script_old.txt`
- `script_final.txt`
- `script_final_ACTUALLY_FINAL.txt`
- `script_final_ACTUALLY_FINAL_UseThisOne_PLEASE.txt`

DraftWolf takes that chaos, pats it on the head, and organizes it into a sleek, version-controlled system that doesn't require a PhD in git-fu. It’s local version control for the rest of us.

---

## ✨ Features (The Good Stuff)

### 🕰️ Time Travel (Version Control)
Go back to when your ideas were fresh. Our system handles the messy stuff—if you restore an old version and edit it, we manage the timeline so you don't lose anything. It's like having a Ctrl+Z for your entire project lifecycle.

### 🧹 Cleanup & Folder Snapshots
Files piling up? Take a **Snapshot**. We bundle your current state into a tidy package so you can clean up the clutter without losing history. It's like a save point in a video game, but for your work.

### 🔒 Exclusive File Locking
Working in a team? Don't stepping on each other's toes. Lock a file to let everyone know you're working on it. They can look, but they can't touch until you're done. (Powered by real-time updates!)

### 🤖 AI-Powered Commit Messages
Let's be honest, you're not going to write a detailed commit message. Our AI analyzes your changes and writes a witty, descriptive message for you. You're welcome.

### 🚫 Ignore Files (The ".draftignore")
Got junk files? Temporary renders? Secrets? Tell DraftWolf to ignore them with our built-in ignore patterns. Configure via **Project Settings** or edit `.draft/.draftignore` directly using `.gitignore` syntax. Choose from **7 presets** (Unreal, Unity, Godot, Node.js, Python, Blender, OS files) or add custom patterns. Ignored files are excluded from snapshots and commits automatically.

### 🕵️ Inspector Gadget... Panel
Click a file. Boom. History. Metadata. File size trends. It's an X-Ray for your documents. See every iteration of your genius (or lack thereof).

### 🔔 Smart Notifications
We watch your files in the background. If you've been working for a while, we'll gently nudge you to version your changes. No more "I forgot to save" excuses.

### 👥 Community
Sign in with email or Google to join the in-app Community: chat, polls, and shared discussions so you can connect with other DraftWolf users.

---

## 🌍 The Ecosystem

DraftWolf isn't just a standalone app; it's part of a pack.

### 🎨 Blender Plugin (External)
Direct integration with Blender. Version your `.blend` files directly from the interface without ever leaving your 3D workspace. (Located in a separate repo).

### 🖼️ Moodboard Tool (External)
A dedicated tool for gathering references and inspiration.Seamlessly links with your DraftWolf projects to keep your creative vision aligned with your files. (Located in a separate repo).

---

## 🛠️ The Tech Stack

We threw a bunch of buzzwords into a blender and this came out perfectly:
- **React** – Because components are life.
- **TypeScript** – Because we hate runtime errors (mostly).
- **Vite** – Fast. Like, "did it happen yet?" fast.
- **Electron** – Desktop power with web tech.
- **Zustand** – State management without the headache.
- **Tailwind CSS** – Pretty styles, fast.
- **Supabase** – Auth (email, Google), real-time community chat, and profiles.
- **Three.js** – For when we need to get 3D.
- **Chokidar** – Watching your files like a hawk.

---

## 📂 Project Structure

Here's a quick tour of the codebase:

- **`src/components`**: The building blocks.
  - `Toolbar.tsx`, `Sidebar.tsx`: The main UI frame.
  - `InspectorPanel.tsx`: The details view.
  - `FileList.tsx`: Where your files live.
- **`src/pages`**: The main screens.
  - `Home.tsx`: The dashboard and file browser.
  - `ProjectSettings.tsx`: Configure ignores, backup location, and other project settings.
  - `Settings.tsx`: App-wide preferences.
  - `Cleanup.tsx`: Snapshot management and storage.
  - `Community/`: In-app community (chat, polls).
  - `Login.tsx`, `OTPVerification.tsx`: Auth (Supabase).
  - `Extensions.tsx`: Extensions / add-ons.
- **`src/services`**: The logic layer.
  - `LockService.ts`: Handles file locking.
  - `AIService.ts`: Brains of the operation.
- **`src/utils`**: Helpers and utilities (shortcuts, ignore patterns).
- **`electron`**: The main process code for the desktop wrapper.

---

*Made with ❤️, ☕, and a severe dislike for lost data.*
