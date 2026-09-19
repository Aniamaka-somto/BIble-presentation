import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Three renderer entry points: the operator console (control panel), the
// output window (fullscreen display you project or capture in OBS), and the
// settings screens (blocking modal windows for display/output/settings).
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: {
          operator: resolve(__dirname, 'src/renderer/operator/index.html'),
          output: resolve(__dirname, 'src/renderer/output/index.html'),
          settings: resolve(__dirname, 'src/renderer/settings/index.html')
        }
      }
    },
    plugins: [react()]
  }
})
