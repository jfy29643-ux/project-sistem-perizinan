import { defineConfig } from 'vite';

const apiProxy = {
  '/api/login': {
    target: 'http://127.0.0.1:5000',
    changeOrigin: true
  },
  '/api': {
    target: 'http://127.0.0.1:5002',
    changeOrigin: true
  }
};

export default defineConfig({
  server: {
    host: '0.0.0.0',
    strictPort: true,
    proxy: apiProxy
  },
  preview: {
    host: '0.0.0.0',
    strictPort: true,
    proxy: apiProxy
  }
});