import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5190,
    watch: {
      usePolling: true,
      interval: 500,
      ignored: ['**/old/**', '**/dist/**']
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  }
});
