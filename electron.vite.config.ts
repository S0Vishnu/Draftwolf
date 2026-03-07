import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync } from 'fs'

// Simple plugin to copy static files to the main process output
function copyTrayPromptPlugin() {
    return {
        name: 'copy-tray-prompt',
        closeBundle() {
            try {
                mkdirSync(resolve('out/main'), { recursive: true })
                copyFileSync(
                    resolve('electron/main/traySnapshotPrompt.html'),
                    resolve('out/main/traySnapshotPrompt.html')
                )
                copyFileSync(
                    resolve('public/icon.png'),
                    resolve('out/main/icon.png')
                )
            } catch (e) {
                console.warn('Could not copy traySnapshotPrompt.html:', e.message)
            }
        }
    }
}

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin(), copyTrayPromptPlugin()],
        build: {
            lib: {
                entry: 'electron/main/index.js'
            }
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            lib: {
                entry: 'electron/preload/index.js'
            }
        }
    },
    renderer: {
        root: '.',
        resolve: {
            alias: {
                '@renderer': resolve('src')
            }
        },
        build: {
            rollupOptions: {
                input: 'index.html'
            }
        },
        plugins: [react()]
    }
})
