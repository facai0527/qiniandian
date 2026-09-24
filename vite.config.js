import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // CI supplies the real Pages subpath; keep the established local preview URL.
  base: process.env.QND_BASE_PATH || '/qiniandian/',
  build: {
    rollupOptions: {
      input: {
        story: fileURLToPath(new URL('./index.html', import.meta.url)),
        history: fileURLToPath(new URL('./history.html', import.meta.url)),
      },
    },
  },
})
