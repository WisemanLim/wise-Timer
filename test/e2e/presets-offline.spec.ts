import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.describe('E4 사용자 프리셋·오프라인 (실제 Chrome)', () => {
  test('E4-E1 JSON 내보내기 → 가져오기 (파일)', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: /TOEIC Listening & Reading/ }).click()
    await page.getByRole('button', { name: '내 프리셋으로 저장' }).click()
    await page.getByLabel('프리셋 이름').fill('내보내기 시험')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await page.getByRole('button', { name: '시험 다시 선택' }).click()

    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '내보내기 시험 JSON 내보내기' }).click()])
    const path = await dl.path()
    expect(JSON.parse(readFileSync(path, 'utf8')).name).toBe('내보내기 시험')

    await page.getByLabel('프리셋 JSON 파일').setInputFiles(path)
    await expect(page.getByRole('button', { name: '내보내기 시험 JSON 내보내기' })).toHaveCount(2) // 원본 + 가져온 사본

    await page.getByLabel('프리셋 JSON 파일').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"id":1}') })
    await expect(page.getByRole('alert')).toContainText('가져오기 실패')
  })

  test('E4-E2 오프라인: 서비스워커 설치 후 네트워크 차단 → 새로고침 → 동작', async ({ page, context }) => {
    const external: string[] = []
    page.on('request', (r) => !r.url().startsWith('http://127.0.0.1:4173/') && !r.url().startsWith('data:') && external.push(r.url()))
    await page.goto('./')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload() // SW 제어 하에 재로딩
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

    await context.setOffline(true)
    await page.reload()
    await page.getByRole('button', { name: /TOEIC Listening & Reading/ }).click()
    await page.getByRole('button', { name: /^시작/ }).click()
    await page.getByRole('button', { name: '시작', exact: true }).click()
    await expect(page.getByLabel('남은 시간 45:00')).toBeVisible()
    await context.setOffline(false)
    expect(external).toEqual([]) // COMPLIANCE: 자기 origin 외 요청 0
  })
})
