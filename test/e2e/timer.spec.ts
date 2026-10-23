import { expect, test } from '@playwright/test'

const MIN = 60_000

test.describe('E3 타이머 실제 브라우저 (Pages 경로 /wise-Timer/)', () => {
  test('E3-E1 TOEIC 120분 흐름: LC 강제 → RC 자동 전환 → 파트 알림 → 종료', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.clock.install()
    await page.goto('./')

    await page.getByRole('button', { name: /TOEIC Listening & Reading/ }).click()
    await page.getByRole('button', { name: /^시작/ }).click()
    await page.getByRole('button', { name: '시작', exact: true }).click()

    await expect(page.getByLabel('남은 시간 45:00')).toBeVisible()
    await expect(page.getByText('강제 진행 — 방송·시험 진행에 맞춰 멈추지 않습니다')).toBeVisible()
    await expect(page.getByRole('button', { name: /일시정지/ })).toHaveCount(0)
    await page.screenshot({ path: 'test/e2e/.results/e3-lc.png', fullPage: true })

    await page.clock.fastForward(13 * MIN)
    await expect(page.getByText('예상 문항 32번')).toBeVisible()

    await page.clock.fastForward(32 * MIN)
    await expect(page.getByRole('status').first()).toContainText('RC (읽기) 시작 — Part 5 · 30문항')
    await expect(page.getByLabel('남은 시간 75:00')).toBeVisible()

    await page.keyboard.press('j')
    await page.keyboard.press('j')
    await expect(page.getByText('98')).toBeVisible()

    await page.clock.fastForward(11 * MIN)
    await expect(page.getByRole('status').first()).toContainText('Part 6 시작 시각 — Part 6 · 16문항')
    await expect(page.getByText(/계획보다 .* 늦음/)).toBeVisible()
    await page.screenshot({ path: 'test/e2e/.results/e3-rc.png', fullPage: true })

    await page.keyboard.press('n')
    await expect(page.getByRole('button', { name: 'Part 6 완료 (N)' })).toBeVisible()

    await page.clock.fastForward(64 * MIN + 1000)
    await expect(page.getByText('TOEIC Listening & Reading — 결과')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('E3-E2 새로고침 후 이어하기 (진행 상태 로컬 저장)', async ({ page }) => {
    await page.clock.install()
    await page.goto('./')
    await page.getByRole('button', { name: /TOEIC Listening & Reading/ }).click()
    await page.getByLabel('LC (듣기) 포함').uncheck()
    await page.getByRole('button', { name: /^시작/ }).click()
    await page.getByRole('button', { name: '시작', exact: true }).click()
    await page.clock.fastForward(10 * MIN)
    await page.reload()
    await expect(page.getByText('진행 중인 시험이 있습니다')).toBeVisible()
    await page.getByRole('button', { name: '이어하기' }).click()
    await expect(page.getByLabel(/^남은 시간 65:0\d$/)).toBeVisible()
  })
})
