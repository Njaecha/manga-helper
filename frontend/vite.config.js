import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],

  server: {
    port: 5173,
    proxy: {
      // Proxy API requests to backend (keep the /api prefix)
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      // Direct backend endpoints (without /api prefix)
      '/detect': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/analyze': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/translate': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },

  build: {
    // Optimize build output
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor code into separate chunk
          vendor: ['svelte', 'axios'],
          konva: ['konva', 'svelte-konva']
        }
      }
    },
    // Increase chunk size warning limit for Konva
    chunkSizeWarningLimit: 1000
  },

  optimizeDeps: {
    include: ['svelte', 'axios', 'konva', 'svelte-konva']
  }
})
