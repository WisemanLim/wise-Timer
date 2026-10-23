import { expect, test, type Page } from '@playwright/test'

const MIN = 60_000

async function rcSession(page: Page, partEnds: number[], unanswered: string) {
  await page.getByRole('button', { name: /TOEIC Listening & Reading/ }).click()
  await page.getByLabel('LC (듣기) 포함').uncheck()
  await page.getByRole('button', { name: /^시작/ }).click()
  await page.getByRole('button', { name: '시작', exact: true }).click()
  let t = 0
  for (const at of partEnds) {
    await page.clock.fastForward((at - t) * MIN)
    t = at
    await page.keyboard.press('n')
  }
  await page.clock.fastForward((75 - t) * MIN + 1000)
  await expect(page.getByText('TOEIC Listening & Reading — 결과')).toBeVisible()
  await page.getByLabel('미완료 문항 수').fill(unanswered)
  await page.getByRole('button', { name: '기록 저장' }).click()
  await expect(page.getByRole('button', { name: '기록 저장됨' })).toBeDisabled()
}

test('E5-E1 F6: 2회 세션 → 파트별 표 → 기록·지난 회차 비교', async ({ page }) => {
  await page.clock.install()
  await page.goto('./')

  await rcSession(page, [13, 22, 50, 74], '4') // 1회차: P5 +2, P6 +1, P7단일 +1, P7다중 0 → 초과 4:00, 검토 4분 늦게
  await expect(page.getByText('검토 시작: 계획 70:00 · 실제 74:00 (+4:00)')).toBeVisible()
  await page.screenshot({ path: 'test/e2e/.results/e5-result.png', fullPage: true })
  await page.getByRole('button', { name: '처음으로' }).click()

  await rcSession(page, [11, 19, 46, 69], '0') // 2회차: 초과 0
  await expect(page.getByText('지난 회차 4:00')).toBeVisible()
  await page.getByRole('button', { name: '기록 보기' }).click()

  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('-4:00') // 지난 회차 대비
  await expect(rows.nth(1)).toContainText('4:00')
  await page.screenshot({ path: 'test/e2e/.results/e5-history.png', fullPage: true })
})
