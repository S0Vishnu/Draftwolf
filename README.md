# DraftWolf 🌪️
### *Because "final_final_v2.docx" is a lie we tell ourselves.*

Welcome to **DraftWolf**, the desktop application that understands your commitment issues with file versions. Built with the holy trinity of **React**, **TypeScript**, and **Electron**, this tool is designed to save you from yourself.

## 🤔 Why purely? Why does this exist?

We've all been there. You have a folder that looks like a graveyard of good intentions:
- `script.txt`
- `script_old.txt`
- `script_final.txt`
- `script_final_ACTUALLY_FINAL.txt`
- `script_final_ACTUALLY_FINAL_UseThisOne.txt`

**DraftWolf** gently takes that chaos, pats it on the head, and organizes it into a sleek, version-controlled system that doesn't require a degree in Rocket Surgery (or `git`). It’s local version control for the rest of us.

## ✨ Features (The Good Stuff)

### 🕰️ Time Travel (Version Control)
Go back in time to when your ideas were fresh and you hadn't accidentally deleted that crucial paragraph. Our **Semantic Branching** logic handles the messy stuff—if you restore an old version and edit it, we don't just overwrite history; we branch it off like a multiverse timeline. You're welcome, Doctor Strange.

### 🕵️ Inspector Gadget... Panel
Click a file. Boom. History. Details. Metadata. It's like an X-Ray for your documents. You can see every iteration of your genius (or lack thereof).

### 📎 Attachments & Previews
Drag, drop, and stare. We support attachments so you can keep your reference images right next to your drafts. We even have a full-screen preview because squinting is bad for your eyes.

### 🎨 Beautiful UI (Glassmorphism & Vibes)
We didn't just make it work; we made it look expensive. Smooth gradients, glassmorphism, and dark mode because we know you code in the dark like a hacker in a 90s movie.

## 🛠️ The "Under the Hood" (Tech Stack)

We threw a bunch of buzzwords into a blender and this came out perfectly:
- **React** – Because we like components.
- **TypeScript** – Because we hate runtime errors (mostly).
- **Vite** – Fast. Like, "did it happen yet?" fast.
- **Electron** – Because web apps deserve to be desktop apps too.
- **Zustand** – State management that doesn't require a boilerplate sacrifice.
- **Tailwind CSS** – Making things pretty without writing `style.css` 500 times.
- **Three.js** – Just in case we need a spinning donut later.

## 🏎️ How to Drive This Beast

### Prerequisite
Have `npm` installed. If you don't, ask your local nerd or Google it.

### 1. Install the goop
```bash
npm install
```

### 2. Copy the secrets
```bash
cp .env.example .env
```
*(If you don't have secrets, just pretend you do. It adds mystery.)*

### 3. Fire it up
**For the Browser (Standard Web Mode):**
```bash
npm run dev
```
*Great for quick UI checks and spotting typos.*

**For the Desktop Experience (The Real Deal):**
```bash
npm run electron:dev
```
*This is the intended experience. Immerse yourself.*

## 📦 Building for Production (Shipping It)
When you're ready to show the world (or just move the .exe to another folder):

- **Windows:** `npm run electron:build:win`
- **Mac:** `npm run electron:build:mac` (Look at you, fancy.)
- **Linux:** `npm run electron:build:linux` (We verify your distro choice.)

---
*Made with ❤️, ☕, and a severe dislike for lost data.*
