// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// 환경변수로 사이트 URL 설정 가능 (기본값: finlog.site)
const siteUrl = process.env.SITE_URL || 'https://finlog.site';

// https://astro.build/config
export default defineConfig({
  site: siteUrl,

  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/mypage') &&
        !page.includes('/reset-password') &&
        !page.includes('/community') &&
        !page.includes('/write') &&
        !page.includes('/404'),
    }),
    mdx(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
