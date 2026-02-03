import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
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
                '@renderer': resolve('src'),
                '@': resolve('src')
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
