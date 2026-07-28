import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  server: { open: true },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: { compress: { drop_console: mode !== 'e2e', drop_debugger: true } },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('three')) return 'vendor-three';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
}));
