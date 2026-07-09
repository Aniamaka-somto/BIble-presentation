import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Two renderer entry points: the operator console (control panel) and the
// output window (fullscreen display you project or capture in OBS).
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
          output: resolve(__dirname, 'src/renderer/output/index.html')
        }
      }
    },
    plugins: [react()]
  }
})
