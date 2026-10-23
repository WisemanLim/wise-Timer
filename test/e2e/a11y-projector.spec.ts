import { expect, test, type Page } from '@playwright/test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const MIN = 60_000

/** axe-core 주입 후 WCAG 2.x A/AA (KWCAG 2.2 대응) 위반 목록 */
async function axe(page: Page, label: string) {
  await page.addScriptTag({ path: require.resolve('axe-core') })
  const violations = await page.evaluate(async () => {
    // @ts-expect-error 주입된 전역
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
    return r.violations.map((v: { id: string; nodes: { target: string[] }[] }) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  })
  return violations.map((v: string) => `[${label}] ${v}`)
}

async function walk(page: Page) {
  const all: string[] = []
  await page.clock.install()
  await page.goto('./')
  all.push(...(await axe(page, '선택')))
  await page.getByRole('button', { name: /TOEIC Listening & Reading/ }).click()
  await page.getByLabel('RC (읽기) Part 5 시간').fill('14') // 오류 상태 포함
  all.push(...(await axe(page, '편집(오류)')))
  await page.getByRole('button', { name: '기본값으로 되돌리기' }).click()
  await page.getByLabel('LC (듣기) 포함').uncheck()
  await page.getByRole('button', { name: /^시작/ }).click()
  all.push(...(await axe(page, '시작 대기')))
  await page.getByRole('button', { name: '시작', exact: true }).click()
  await page.clock.fastForward(12 * MIN)
  all.push(...(await axe(page, '실행')))
  await page.keyboard.press('p')
  all.push(...(await axe(page, '프로젝터')))
  await page.keyboard.press('p')
  await page.clock.fastForward(64 * MIN)
  all.push(...(await axe(page, '결과')))
  await page.getByRole('button', { name: '기록 저장' }).click()
  await page.getByRole('button', { name: '기록 보기' }).click()
  all.push(...(await axe(page, '기록')))
  return all
}

test.describe('E6 접근성·프로젝터 (실제 Chrome)', () => {
  test('E6-E1 axe WCAG 2.2 AA 위반 0 — 라이트', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    expect(await walk(page)).toEqual([])
  })

  test('E6-E2 axe WCAG 2.2 AA 위반 0 — 다크', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    expect(await walk(page)).toEqual([])
  })

  test('E6-E3 F7 프로젝터: 남은 시간 ≥ 화면 높이 25%, 현재 파트 ≥ 48px, 고대비(검정 배경)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.clock.install()
    await page.goto('./')
    await page.getByRole('button', { name: /TOEIC Listening & Reading/ }).click()
    await page.getByRole('button', { name: /^시작/ }).click()
    await page.getByRole('button', { name: '시작', exact: true }).click()
    await page.getByRole('button', { name: '프로젝터 모드 (P)' }).click()
    const clock = page.getByLabel(/^남은 시간/)
    const size = await clock.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(size).toBeGreaterThanOrEqual(720 * 0.25)
    const part = page.getByTestId('projector-part')
    await expect(part).toHaveText('Part 1 · 4:00')
    expect(await part.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(48)
    for (const el of [clock, part]) {
      const box = (await el.boundingBox())!
      expect(box.y + box.height, '화면 안에 보여야 함').toBeLessThanOrEqual(720)
    }
    const bg = await page.locator('.fixed.inset-0').evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).toBe('rgb(0, 0, 0)')
    await page.screenshot({ path: 'test/e2e/.results/e6-projector.png' })
    // 설정 기억: 새로고침 후 이어하기 → 프로젝터 유지
    await page.reload()
    await page.getByRole('button', { name: '이어하기' }).click()
    await expect(page.getByRole('button', { name: '일반 화면 (P)' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('E6-E4 키보드만으로 전체 흐름 (Tab/Enter/Space/N/J)', async ({ page }) => {
    await page.clock.install()
    await page.goto('./')
    await page.keyboard.press('Tab') // wise-Timer
    await page.keyboard.press('Tab') // 기록
    await page.keyboard.press('Tab') // TOEIC 카드
    await expect(page.getByRole('button', { name: /TOEIC Listening & Reading/ })).toBeFocused()
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
    expect(outline).toBe('solid') // 초점 표시
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: /^시작/ }).focus()
    await page.keyboard.press('Enter')
    await page.locator('body').click({ position: { x: 1, y: 1 } })
    await page.keyboard.press('Space')
    await expect(page.getByLabel('남은 시간 45:00')).toBeVisible()
    await page.clock.fastForward(45 * MIN)
    await page.keyboard.press('j')
    await page.keyboard.press('n')
    await expect(page.getByText('99')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Part 6 완료 (N)' })).toBeVisible()
  })
})
