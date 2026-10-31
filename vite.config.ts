import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import piholeProxy from './server/pihole-proxy.ts'
import mediaProxy from './server/media-proxy.ts'

export default defineConfig({
  plugins: [svelte(), piholeProxy(), mediaProxy()],
  build: {
    outDir: 'dist',
  },
})
