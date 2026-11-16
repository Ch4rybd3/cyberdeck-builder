import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import pkg from './package.json'

// `base: './'` keeps every asset path relative, so the same build works on
// GitHub Pages (served from /<repo>/) and on a custom domain (served from /).
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  optimizeDeps: { exclude: ['manifold-3d'] },
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 2000 },
})
