// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// 환경변수로 사이트 URL 설정 가능 (기본값: finlog.kr)
const siteUrl = process.env.SITE_URL || 'https://finlog.kr';

// https://astro.build/config
export default defineConfig({
  site: siteUrl,

  integrations: [
    sitemap(),
    mdx(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
