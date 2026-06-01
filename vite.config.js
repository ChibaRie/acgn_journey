import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const browserLikeHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MyACGNJourney/0.1 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
};

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/My_ACGN_Journey/' : '/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5188,
    proxy: {
      '/api/sources/bangumi': {
        target: 'https://api.bgm.tv',
        changeOrigin: true,
        secure: true,
        headers: {
          ...browserLikeHeaders,
          'User-Agent': 'MyACGNJourney/0.1 (local Vite proxy; https://bangumi.github.io/api/)',
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
