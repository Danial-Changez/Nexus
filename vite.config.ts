import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  // In development, run the Express server too (npm run start) and let Vite forward API calls to it
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    outDir: 'dist',
  },
})
