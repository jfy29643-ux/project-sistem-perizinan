import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api/login': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true
      },
      '/api': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true
      }
    }
  }
});