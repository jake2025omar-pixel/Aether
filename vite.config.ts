import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      // Keep the initial shell small while preserving the full 3D runtime in
      // a cacheable chunk that is loaded only after the consent gate.
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('three') || id.includes('@pixiv/three-vrm')) return 'three-runtime';
            if (id.includes('firebase')) return 'firebase-runtime';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('motion')) return 'motion-runtime';
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-runtime';
            return 'vendor';
          },
        },
      },
      // The remaining 3D runtime is intentionally isolated in its own chunk.
      chunkSizeWarningLimit: 1200,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Allow all hosts in AI Studio dev environment
      allowedHosts: true as const,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
