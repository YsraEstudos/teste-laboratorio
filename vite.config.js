import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { open: true },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: { compress: { drop_console: mode !== 'e2e', drop_debugger: true } },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react')) return 'vendor-react';
          if (id.includes('three')) return 'vendor-three';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
}));
