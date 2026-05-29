import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const browserLikeHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MyACGNJourney/0.1 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
};

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/My_ACGN_Journey/' : '/',
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
          'User-Agent': 'MyACGNJourney/0.1 (local Vite proxy; https://bangumi.github.io/api/)',
        },
        rewrite: (path) => path.replace(/^\/api\/bangumi/, ''),
      },
      '/api/bilibili': {
        target: 'https://api.bilibili.com',
        changeOrigin: true,
        secure: true,
        headers: {
          ...browserLikeHeaders,
          Referer: 'https://www.bilibili.com/',
          Origin: 'https://www.bilibili.com',
        },
        rewrite: (path) => path.replace(/^\/api\/bilibili/, ''),
      },
      '/api/moegirl': {
        target: 'https://zh.moegirl.org.cn',
        changeOrigin: true,
        secure: true,
        headers: browserLikeHeaders,
        rewrite: (path) => path.replace(/^\/api\/moegirl/, ''),
      },
      '/api/anilist': {
        target: 'https://graphql.anilist.co',
        changeOrigin: true,
        secure: true,
        headers: browserLikeHeaders,
        rewrite: (path) => path.replace(/^\/api\/anilist/, '') || '/',
      },
      '/api/vndb': {
        target: 'https://api.vndb.org/kana',
        changeOrigin: true,
        secure: true,
        headers: browserLikeHeaders,
        rewrite: (path) => path.replace(/^\/api\/vndb/, ''),
      },
    },
  },
});
