import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  define: {
    // jsmediatags: skip Node/ReactNative file readers in the browser bundle
    'process.browser': true,
  },
  resolve: {
    alias: {
      fs: path.resolve(rootDir, 'src/shims/empty.js'),
      'react-native-fs': path.resolve(rootDir, 'src/shims/empty.js'),
    },
  },
});
