/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages(프로젝트 사이트)는 https://<user>.github.io/<repo>/ 하위에서 서빙된다.
// VITE_BASE 로 경로를 주입한다: local dev = "/", Pages/prod = "/<repo>/" (끝 슬래시 필수).
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png'],
      manifest: {
        name: 'wise-Timer — 시험 시간 배분 타이머',
        short_name: 'wise-Timer',
        description: '시험 프리셋 기반 파트별 시간 배분 카운트다운 타이머',
        lang: 'ko',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        theme_color: '#1d4ed8',
        background_color: '#ffffff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,woff2,mp3}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['test/unit/**/*.test.{ts,tsx}'],
  },
})
