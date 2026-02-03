# 🔌 Draftflow Plugin System

Complete guide to the Draftflow plugin architecture that allows users to install extensions like Wolfbrain.

---

## 📋 **Table of Contents**

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [How It Works](#how-it-works)
4. [Creating a Plugin](#creating-a-plugin)
5. [Plugin Registry](#plugin-registry)
6. [User Experience](#user-experience)
7. [API Reference](#api-reference)
8. [Wolfbrain as a Plugin](#wolfbrain-as-a-plugin)

---

## **Overview**

The Draftflow Plugin System allows users to:
- ✅ Browse available extensions
- ✅ Install/uninstall plugins with one click
- ✅ Enable/disable plugins without uninstalling
- ✅ Automatically check for updates
- ✅ Manage plugin permissions

**Key Benefits:**
- No code copying required
- Plugins are downloaded from GitHub releases
- Users choose what to install
- Smaller base application size
- Independent update cycles

---

## **Architecture**

### **System Components:**

```
┌─────────────────────────────────────────────────────────┐
│                    DRAFTFLOW CORE                       │
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │         Plugin Manager                        │    │
│  │  • Discovers installed plugins                │    │
│  │  • Loads plugin modules                       │    │
│  │  • Manages lifecycle (activate/deactivate)    │    │
│  │  • Checks for updates                         │    │
│  └───────────────────────────────────────────────┘    │
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │         Plugin Installer                      │    │
│  │  • Downloads from GitHub releases             │    │
│  │  • Extracts ZIP files                         │    │
│  │  • Manages installation/uninstallation        │    │
│  └───────────────────────────────────────────────┘    │
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │         Plugin IPC                            │    │
│  │  • Exposes plugin API to renderer             │    │
│  │  • Handles install/uninstall requests         │    │
│  │  • Manages enable/disable operations          │    │
│  └───────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              USER DATA DIRECTORY                        │
│  %APPDATA%/Draftflow/                                   │
│                                                         │
│  ├── plugins/                                           │
│  │   ├── wolfbrain/          ← Installed plugin        │
│  │   │   ├── manifest.json                             │
│  │   │   ├── index.js                                  │
│  │   │   └── dist/                                     │
│  │   └── other-plugin/                                 │
│  │                                                      │
│  └── plugins-config.json      ← Plugin settings        │
└─────────────────────────────────────────────────────────┘
```

---

## **How It Works**

### **1. Plugin Discovery**

When Draftflow starts:

```javascript
// electron/main/plugin-manager.ts
async init() {
  // 1. Scan plugins directory
  const pluginDirs = readdirSync(this.pluginsDir);
  
  // 2. Load each plugin's manifest.json
  for (const pluginId of pluginDirs) {
    const manifest = JSON.parse(readFileSync('manifest.json'));
    this.plugins.set(pluginId, { manifest, ... });
  }
  
  // 3. Activate enabled plugins
  await this.activateEnabledPlugins();
}
```

### **2. Plugin Installation**

User clicks "Install Wolfbrain":

```javascript
// 1. Download from GitHub release
await fetch('https://github.com/.../wolfbrain-plugin.zip');

// 2. Extract to plugins directory
await extractZip(zipPath, '%APPDATA%/Draftflow/plugins/wolfbrain/');

// 3. Load plugin
await pluginManager.init();

// 4. Activate plugin
await pluginManager.activatePlugin('wolfbrain');
```

### **3. Plugin Activation**

```javascript
async activatePlugin(pluginId) {
  const plugin = this.plugins.get(pluginId);
  
  // 1. Load the plugin module
  const module = require(plugin.manifest.main);
  
  // 2. Call activate hook
  if (module.activate) {
    await module.activate();
  }
  
  // 3. Register IPC handlers if provided
  if (module.ipcHandlers) {
    for (const [channel, handler] of Object.entries(module.ipcHandlers)) {
      ipcMain.handle(channel, handler);
    }
  }
}
```

---

## **Creating a Plugin**

### **Step 1: Create Plugin Structure**

```
my-plugin/
├── manifest.json          ← Plugin metadata
├── index.js              ← Entry point
├── dist/                 ← Bundled code
│   └── plugin.js
└── assets/
    └── icon.png
```

### **Step 2: Create `manifest.json`**

```json
{
  "id": "my-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "Does amazing things",
  "author": "Your Name",
  "homepage": "https://github.com/you/my-plugin",
  "repository": "https://github.com/you/my-plugin",
  "main": "index.js",
  "renderer": "dist/MyPluginComponent.js",
  "styles": "dist/styles.css",
  "permissions": ["filesystem", "window-management"],
  "category": "productivity",
  "tags": ["utility", "productivity"]
}
```

### **Step 3: Create `index.js`**

```javascript
// Plugin entry point
module.exports = {
  // Called when plugin is activated
  activate: async () => {
    console.log('My plugin activated!');
  },
  
  // Called when plugin is deactivated
  deactivate: async () => {
    console.log('My plugin deactivated!');
  },
  
  // React component (if plugin has UI)
  Component: require('./dist/MyPluginComponent').default,
  
  // Window configuration (if plugin needs separate window)
  createWindow: () => ({
    width: 800,
    height: 600,
    frame: false,
    route: '/my-plugin'
  }),
  
  // IPC handlers (if plugin needs backend logic)
  ipcHandlers: {
    'my-plugin:doSomething': async (event, data) => {
      return { success: true, result: 'Done!' };
    }
  }
};
```

### **Step 4: Package as ZIP**

```bash
# Create release package
zip -r my-plugin.zip manifest.json index.js dist/ assets/
```

### **Step 5: Create GitHub Release**

1. Create a release on GitHub
2. Upload `my-plugin.zip` as an asset
3. Note the download URL

---

## **Plugin Registry**

### **Registry Format**

Create a `registry.json` file:

```json
{
  "version": "1.0.0",
  "plugins": [
    {
      "id": "my-plugin",
      "name": "My Awesome Plugin",
      "description": "Does amazing things",
      "version": "1.0.0",
      "author": "Your Name",
      "homepage": "https://github.com/you/my-plugin",
      "repository": "https://github.com/you/my-plugin",
      "downloadUrl": "https://github.com/you/my-plugin/releases/latest/download/my-plugin.zip",
      "category": "productivity",
      "tags": ["utility"],
      "verified": true
    }
  ]
}
```

### **Host Registry**

Option 1: GitHub Pages
```
https://yourusername.github.io/draftflow-plugins/registry.json
```

Option 2: GitHub Raw
```
https://raw.githubusercontent.com/you/draftflow-plugins/main/registry.json
```

### **Configure Registry URL**

In `electron/main/plugin-manager.ts`:

```typescript
private registryUrl = 'https://your-registry-url/registry.json';
```

---

## **User Experience**

### **Installing a Plugin**

```typescript
// In React component
const installPlugin = async () => {
  const result = await window.api.plugins.install(
    { pluginId: 'wolfbrain' },
    'https://github.com/.../wolfbrain-plugin.zip'
  );
  
  if (result.success) {
    toast.success('Plugin installed!');
  }
};
```

### **Browsing Available Plugins**

```typescript
const [registry, setRegistry] = useState(null);

useEffect(() => {
  const loadPlugins = async () => {
    const result = await window.api.plugins.fetchRegistry();
    if (result.success) {
      setRegistry(result.registry);
    }
  };
  loadPlugins();
}, []);
```

### **Managing Installed Plugins**

```typescript
const [plugins, setPlugins] = useState([]);

const loadPlugins = async () => {
  const result = await window.api.plugins.getAll();
  if (result.success) {
    setPlugins(result.plugins);
  }
};

const togglePlugin = async (pluginId, enabled) => {
  if (enabled) {
    await window.api.plugins.enable(pluginId);
  } else {
    await window.api.plugins.disable(pluginId);
  }
  loadPlugins();
};
```

---

## **API Reference**

### **Renderer API** (`window.api.plugins`)

```typescript
// Get all installed plugins
getAll(): Promise<{ success: boolean; plugins?: Plugin[] }>

// Get specific plugin
get(pluginId: string): Promise<{ success: boolean; plugin?: Plugin }>

// Fetch available plugins from registry
fetchRegistry(): Promise<{ success: boolean; registry?: PluginRegistry }>

// Install a plugin
install(options: PluginInstallOptions, downloadUrl: string): Promise<{ success: boolean }>

// Uninstall a plugin
uninstall(pluginId: string): Promise<{ success: boolean }>

// Enable a plugin
enable(pluginId: string): Promise<{ success: boolean }>

// Disable a plugin
disable(pluginId: string): Promise<{ success: boolean }>

// Check for updates
checkUpdates(): Promise<{ success: boolean; updates?: PluginUpdateInfo[] }>

// Update a plugin
update(pluginId: string, downloadUrl: string): Promise<{ success: boolean }>
```

---

## **Wolfbrain as a Plugin**

### **Converting Wolfbrain to a Plugin**

#### **1. Create Plugin Structure**

```
WolfBrain/
├── manifest.json
├── index.js
├── dist/
│   ├── WolfbrainPage.js
│   └── wolfbrain.css
└── assets/
    └── icon.png
```

#### **2. Create `manifest.json`**

```json
{
  "id": "wolfbrain",
  "name": "Wolfbrain",
  "version": "1.0.0",
  "description": "Infinite canvas moodboard",
  "author": "S0Vishnu",
  "repository": "https://github.com/S0Vishnu/WolfBrain",
  "main": "index.js",
  "permissions": ["filesystem", "window-management"],
  "category": "design"
}
```

#### **3. Create `index.js`**

```javascript
const { BrowserWindow, ipcMain } = require('electron');

let wolfbrainWindow = null;

module.exports = {
  activate: () => {
    console.log('[Wolfbrain] Plugin activated');
  },
  
  createWindow: () => ({
    width: 1000,
    height: 700,
    frame: false,
    route: '/wolfbrain'
  }),
  
  ipcHandlers: {
    'wolfbrain:open': async () => {
      // Create window logic
    },
    'wolfbrain:save-as': async (event, content) => {
      // Save logic
    }
  }
};
```

#### **4. Package and Release**

```bash
# Build the plugin
npm run build

# Package
zip -r wolfbrain-plugin.zip manifest.json index.js dist/

# Upload to GitHub release
```

---

## **Next Steps**

1. ✅ **Plugin system is set up** in Draftflow
2. ⏳ **Convert Wolfbrain** to plugin format
3. ⏳ **Create plugin registry** repository
4. ⏳ **Build UI** for plugin management in Draftflow
5. ⏳ **Test** installation flow

---

**Last Updated**: February 3, 2026  
**Version**: 1.0.0
