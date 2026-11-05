import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const APP_VERSION = packageJson.version;

const browserLikeHeaders = {
  'User-Agent':
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) acgn_journey/${APP_VERSION} Safari/537.36`,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
};

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/acgn_journey/' : '/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5188,
    proxy: {
      '/api/bangumi': {
        target: 'https://api.bgm.tv',
        changeOrigin: true,
        secure: true,
        headers: {
          ...browserLikeHeaders,
          'User-Agent': `acgn_journey/${APP_VERSION} (local Vite proxy; https://bangumi.github.io/api/)`,
        },
        rewrite: (path) => path.replace(/^\/api\/bangumi/, ''),
      },
      '/api/sources/bangumi': {
        target: 'https://api.bgm.tv',
        changeOrigin: true,
        secure: true,
        headers: {
          ...browserLikeHeaders,
          'User-Agent': `acgn_journey/${APP_VERSION} (local Vite proxy; https://bangumi.github.io/api/)`,
        },
        rewrite: (path) => path.replace(/^\/api\/sources\/bangumi/, ''),
      },
      '/api/sources/age': {
        target: 'https://www.agedm.io',
        changeOrigin: true,
        secure: true,
        headers: browserLikeHeaders,
        rewrite: (path) => path.replace(/^\/api\/sources\/age/, ''),
      },
    },
  },
});
