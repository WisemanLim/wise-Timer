import { defineConfig } from '@playwright/test'

// E2E: 호스트의 설치된 Chrome 사용(브라우저 다운로드 없음). GitHub Pages 와 같은 /wise-Timer/ 경로의 프로덕션 빌드를 검증.
const BASE = '/wise-Timer/'

export default defineConfig({
  testDir: 'test/e2e',
  outputDir: 'test/e2e/.results',
  reporter: [['list']],
  use: {
    channel: 'chrome',
    baseURL: `http://127.0.0.1:4173${BASE}`,
    locale: 'ko-KR',
  },
  webServer: {
    command: 'pnpm build && pnpm preview --strictPort',
    env: { VITE_BASE: BASE },
    url: `http://127.0.0.1:4173${BASE}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
