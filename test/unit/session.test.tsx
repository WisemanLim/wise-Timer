import { beforeEach, describe, expect, it } from 'vitest'
import { BUILTIN_PRESETS } from '../../src/domain/presets'
import { addAnswered, completePart, finishAll, initRun, makePlan, start, tick } from '../../src/domain/engine'
import { buildSession, loadSessions, previousOf, saveSession, suggestedUnanswered } from '../../src/domain/session'
import ResultView from '../../src/components/ResultView'
import HistoryView from '../../src/components/HistoryView'
import { render } from './render'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 23)
const plan = makePlan(BUILTIN_PRESETS.find((e) => e.id === 'toeic-lr')!, ['lc', 'rc'])

/** LC 45분 → RC: P5 12분, P6 7분, P7단일 28분, P7다중 23분 완료 → 검토 → 시간 종료 */
function runFull(offset = 0) {
  const t = T0 + offset
  let st = start(plan, initRun(), t)
  st = tick(plan, st, t + 45 * MIN)
  const rc = t + 45 * MIN
  st = addAnswered(plan, st, 97)
  for (const at of [12, 19, 47, 70]) st = completePart(plan, st, rc + at * MIN)
  st = tick(plan, st, rc + 75 * MIN)
  return st
}

beforeEach(() => localStorage.clear())

describe('E5 세션 기록 (F6)', () => {
  it('E5-01 파트별 계획 대비 실제(±) 계산', () => {
    const s = buildSession(plan, runFull(), 40_000)
    const rc = s.sections[1]
    expect(rc.parts.map((p) => [p.partId, p.actualMs! / MIN, p.overMs! / MIN, p.status])).toEqual([
      ['p5', 12, 1, 'done'], ['p6', 7, -1, 'done'], ['p7s', 28, 1, 'done'], ['p7m', 23, -1, 'done'], ['review', 5, 0, 'cut'],
    ])
    expect(s.totalOverMs).toBe(2 * MIN)
    expect(s.setupMs).toBe(40_000)
    // 검토가 계획보다 길어도(일찍 끝냄) 초과 합계에 넣지 않음
    let st = start(plan, initRun(), T0)
    st = tick(plan, st, T0 + 45 * MIN)
    for (const at of [11, 19, 46, 69]) st = completePart(plan, st, T0 + (45 + at) * MIN)
    expect(buildSession(plan, tick(plan, st, T0 + 120 * MIN), null).totalOverMs).toBe(0)
  })

  it('E5-02 검토 시작 시각: 계획 70분 vs 실제 70분 (±0)', () => {
    const rc = buildSession(plan, runFull(), null).sections[1]
    expect(rc.reviewStart).toEqual({ plannedMs: 70 * MIN, actualMs: 70 * MIN })
  })

  it('E5-03 강제 진행 섹션은 파트 기록 없음, 섹션 실제 시간만', () => {
    const lc = buildSession(plan, runFull(), null).sections[0]
    expect(lc.parts.every((p) => p.actualMs === null)).toBe(true)
    expect(lc.actualMs).toBe(45 * MIN)
    expect(lc.reviewStart).toBeNull()
  })

  it('E5-04 검토 진입 못 함 → actualMs null, 문항 카운터 → 미완료 제안', () => {
    let st = start(plan, initRun(), T0)
    st = tick(plan, st, T0 + 45 * MIN)
    st = addAnswered(plan, st, 90)
    st = completePart(plan, st, T0 + 45 * MIN + 15 * MIN)
    st = finishAll(plan, st, T0 + 120 * MIN)
    const s = buildSession(plan, st, null)
    expect(s.sections[1].reviewStart!.actualMs).toBeNull()
    expect(s.sections[1].parts.map((p) => p.status)).toEqual(['done', 'cut', null, null, null])
    expect(s.sections[1].parts[1].actualMs).toBe(60 * MIN) // 15분 → 75분 종료까지 P6 진행 (계획 8분, +52분)
    expect(suggestedUnanswered(s)).toBe(10)
  })

  it('E5-05 저장·직전 회차 비교·최신순', () => {
    const a = buildSession(plan, runFull(0), null)
    const b = buildSession(plan, runFull(24 * 60 * MIN), null)
    saveSession(a)
    const list = saveSession(b)
    expect(list.map((x) => x.id)).toEqual([b.id, a.id])
    expect(previousOf(list, b)!.id).toBe(a.id)
    expect(previousOf(list, a)).toBeUndefined()
  })

  it('E5-06 F6 수용 기준 (UI): 결과 표 표시 → 미완료 입력 → 저장 → 기록 목록', async () => {
    const session = buildSession(plan, runFull(), 40_000)
    const r = await render(<ResultView session={session} onHome={() => {}} onHistory={() => {}} />)
    const t = r.text()
    expect(t).toContain('계획 초과 합계2:00')
    expect(t).toContain('Part 511:0012:00+1:00') // 파트·계획·실제·차이 행
    expect(t).toContain('마킹·검토5:005:00±0:00') // 시간 종료로 끝난 검토 구간
    const diffCells = [...r.el.querySelectorAll('tbody tr td:last-child')]
    expect(diffCells.find((c) => c.textContent === '±0:00')!.className).not.toMatch(/red|green/) // 0 은 중립색
    expect(t).toContain('검토 시작: 계획 70:00 · 실제 70:00 (±0:00)')
    expect(r.input('미완료 문항 수').value).toBe('3') // 100 − 97
    await r.change(r.input('미완료 문항 수'), '0')
    await r.click(r.button('기록 저장'))
    expect(r.button('기록 저장됨').disabled).toBe(true)
    expect(loadSessions()[0]).toMatchObject({ unanswered: 0, totalOverMs: 2 * MIN })
    r.unmount()

    const h = await render(<HistoryView onBack={() => {}} />)
    expect(h.text()).toContain('TOEIC Listening & Reading')
    await h.click(h.button('TOEIC Listening & Reading'))
    expect(h.text()).toContain('Part 7 다중')
    await h.click(h.button('TOEIC Listening & Reading 기록 삭제'))
    await h.click(h.button('삭제 확인'))
    expect(h.text()).toContain('저장된 기록이 없습니다')
    h.unmount()
  })
})

describe('E5 기록 표기', () => {
  it('E5-07 fmtDuration: 반올림 (74:00.005 → 74:00), 음수, 0 근처', async () => {
    const { fmtDuration } = await import('../../src/domain/format')
    expect([fmtDuration(74 * MIN + 5), fmtDuration(74 * MIN + 600), fmtDuration(-4 * MIN - 5), fmtDuration(-200)]).toEqual(['74:00', '74:01', '-4:00', '0:00'])
  })
})
