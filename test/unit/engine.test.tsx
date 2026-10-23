import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { BUILTIN_PRESETS } from '../../src/domain/presets'
import {
  addAnswered, completePart, derive, finishAll, finishSection, initRun, makePlan, pause, resume, start, tick, type RunState,
} from '../../src/domain/engine'
import TimerView from '../../src/components/TimerView'
import { render } from './render'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 23, 0, 0, 0)
const exam = (id: string) => BUILTIN_PRESETS.find((e) => e.id === id)!
const toeicPlan = (ids = ['lc', 'rc']) => makePlan(exam('toeic-lr'), ids)
const begin = (plan = toeicPlan()) => start(plan, initRun(), T0)

describe('E3 타이머 엔진 (F3·F4)', () => {
  it('E3-01 시작 → LC Part 1, 남은 45:00', () => {
    const plan = toeicPlan()
    const v = derive(plan, begin(plan), T0)!
    expect(v.section.id).toBe('lc')
    expect(v.remaining).toBe(45 * MIN)
    expect(v.section.parts[v.plannedIdx].name).toBe('Part 1')
  })

  it('E3-02 LC 예상 위치: 4분 → Part 2 시작(7번), 13분 → Part 3 (32번)', () => {
    const plan = toeicPlan()
    const st = begin(plan)
    expect(derive(plan, st, T0 + 4 * MIN)!).toMatchObject({ plannedIdx: 1, expectedQuestion: 7 })
    expect(derive(plan, st, T0 + 13 * MIN)!).toMatchObject({ plannedIdx: 2, expectedQuestion: 32 })
    expect(derive(plan, st, T0 + 44.99 * MIN)!.expectedQuestion).toBe(100)
  })

  it('E3-03 LC 강제 진행: 일시정지·파트 완료·문항 카운트 무시', () => {
    const plan = toeicPlan()
    const st = begin(plan)
    expect(pause(plan, st, T0 + MIN)).toBe(st)
    expect(completePart(plan, st, T0 + MIN)).toBe(st)
    expect(addAnswered(plan, st, 1)).toBe(st)
  })

  it('E3-04 LC 45분 종료 → RC 자동 시작 (드리프트 없음: 정확히 T0+45분)', () => {
    const plan = toeicPlan()
    const st = tick(plan, begin(plan), T0 + 45 * MIN + 1234)
    expect(st).toMatchObject({ status: 'running', idx: 1, startedAt: T0 + 45 * MIN })
    expect(st.records[0]).toMatchObject({ sectionId: 'lc', endedAt: T0 + 45 * MIN, endedEarly: false })
    expect(derive(plan, st, T0 + 45 * MIN + 1234)!.remaining).toBe(75 * MIN - 1234)
  })

  it('E3-05 F3 수용 기준: RC Part 5 11분 경과 → 계획 파트 Part 6, 남은 8:00', () => {
    const plan = toeicPlan(['rc'])
    const st = begin(plan)
    const v = derive(plan, st, T0 + 11 * MIN)!
    expect(v.section.parts[v.plannedIdx]).toMatchObject({ name: 'Part 6', questions: 16 })
    expect(v.plannedRemaining).toBe(8 * MIN)
  })

  it('E3-06 파트 완료 포인터·지연/앞섬 계산', () => {
    const plan = toeicPlan(['rc'])
    let st = begin(plan)
    // P5 를 12분에 완료 → 11분 계획 대비 1분 지연 상태였음
    expect(derive(plan, st, T0 + 12 * MIN)!.delta).toBe(1 * MIN)
    st = completePart(plan, st, T0 + 12 * MIN)
    expect(st.marks).toEqual([12 * MIN])
    const v = derive(plan, st, T0 + 12 * MIN)!
    expect([v.myIdx, v.delta]).toEqual([1, 0]) // P6 계획 구간(11~19분) 안
    // P6 를 15분에 완료 → P7 단일 계획 시작(19분)보다 4분 앞섬
    st = completePart(plan, st, T0 + 15 * MIN)
    expect(derive(plan, st, T0 + 15 * MIN)!.delta).toBe(-4 * MIN)
  })

  it('E3-07 일시정지 시간은 경과에서 제외', () => {
    const plan = toeicPlan(['rc'])
    let st = begin(plan)
    st = pause(plan, st, T0 + 10 * MIN)
    expect(derive(plan, st, T0 + 30 * MIN)!.elapsed).toBe(10 * MIN)
    st = resume(st, T0 + 30 * MIN)
    expect(derive(plan, st, T0 + 31 * MIN)!.elapsed).toBe(11 * MIN)
    expect(tick(plan, st, T0 + 75 * MIN + 20 * MIN).status).toBe('done') // 일시정지 20분만큼 늦게 종료
    expect(tick(plan, st, T0 + 75 * MIN + 20 * MIN - 1).status).toBe('running')
  })

  it('E3-08 문항 카운터·필요 페이스(검토 5분 제외)', () => {
    const plan = toeicPlan(['rc'])
    let st = begin(plan)
    expect(derive(plan, st, T0)!.neededSecPerQ).toBeCloseTo((70 * 60) / 100)
    st = addAnswered(plan, st, 30)
    expect(derive(plan, st, T0 + 10 * MIN)!.neededSecPerQ).toBeCloseTo((60 * 60) / 70)
    expect(addAnswered(plan, st, 500).answered).toBe(100)
    expect(addAnswered(plan, st, -500).answered).toBe(0)
  })

  it('E3-09 manual 섹션: 이전 종료 후 대기(between) → 시작', () => {
    const plan = makePlan(exam('csat'), ['korean', 'math'])
    let st = tick(plan, begin(plan), T0 + 80 * MIN)
    expect(st).toMatchObject({ status: 'between', idx: 1 })
    st = start(plan, st, T0 + 100 * MIN)
    expect(st).toMatchObject({ status: 'running', idx: 1, startedAt: T0 + 100 * MIN })
  })

  it('E3-10 절전 복귀: 여러 섹션 경과를 한 번에 정확히 처리', () => {
    const plan = toeicPlan()
    const st = tick(plan, begin(plan), T0 + 500 * MIN)
    expect(st.status).toBe('done')
    expect(st.records.map((r) => [r.sectionId, r.endedAt - T0])).toEqual([['lc', 45 * MIN], ['rc', 120 * MIN]])
  })

  it('E3-11 섹션 조기 종료·시험 종료 기록', () => {
    const plan = toeicPlan(['rc'])
    let st = begin(plan)
    st = finishSection(plan, st, T0 + 70 * MIN)
    expect(st.status).toBe('done')
    expect(st.records[0]).toMatchObject({ endedAt: T0 + 70 * MIN, endedEarly: true })
    const st2 = finishAll(plan, pause(plan, begin(plan), T0 + MIN), T0 + 2 * MIN)
    expect(st2.records[0]).toMatchObject({ pausedMs: MIN, endedEarly: true })
  })
})

describe('E3 실행 화면', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })
  afterEach(() => vi.useRealTimers())

  const mount = async (initial: RunState = initRun(), ids = ['lc', 'rc']) => {
    const changes: RunState[] = []
    let done: RunState | null = null
    const r = await render(
      <TimerView plan={toeicPlan(ids)} initial={initial} onChange={(s) => changes.push(s)} onDone={(s) => (done = s)} onAbort={() => {}} />,
    )
    const advance = (ms: number) => act(async () => vi.advanceTimersByTime(ms))
    return { r, changes, advance, done: () => done as RunState | null }
  }
  const banner = (r: Awaited<ReturnType<typeof mount>>['r']) => r.el.querySelector('[role=status]')!.textContent

  it('E3-12 시작 → LC 남은 45:00·강제 진행 안내, 일시정지 버튼 없음 (F4)', async () => {
    const { r } = await mount()
    await r.click(r.button('시작'))
    expect(r.text()).toContain('45:00')
    expect(r.text()).toContain('강제 진행')
    expect(banner(r)).toContain('LC (듣기) 시작 — Part 1 · 6문항')
    expect(() => r.button(/일시정지/)).toThrow()
    r.unmount()
  })

  it('E3-13 LC 45분 → RC 자동 전환 알림', async () => {
    const { r, advance } = await mount()
    await r.click(r.button('시작'))
    await advance(45 * MIN + 500)
    expect(banner(r)).toContain('RC (읽기) 시작 — Part 5 · 30문항')
    expect(r.button(/일시정지/)).toBeTruthy()
    r.unmount()
  })

  it('E3-14 F3 수용 기준 (UI): Part 5 11분 경과 → "Part 6 · 16문항 · 남은 8:00" 알림', async () => {
    const { r, advance } = await mount(initRun(), ['rc'])
    await r.click(r.button('시작'))
    await advance(11 * MIN + 100)
    expect(banner(r)).toContain('Part 6 시작 시각 — Part 6 · 16문항')
    expect(banner(r)).toMatch(/남은 (8:00|7:59)/)
    expect(banner(r)).toContain('(현재 Part 5 진행 중)')
    r.unmount()
  })

  it('E3-15 N 키 파트 완료, J 키 문항 +1, Space 일시정지', async () => {
    const { r, advance } = await mount(initRun(), ['rc'])
    await r.click(r.button('시작'))
    await advance(5 * MIN)
    const key = (k: string, code = '') => act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, bubbles: true })))
    await key('n')
    expect(r.text()).toContain('Part 6 완료 (N)')
    await key('j')
    await key('j')
    expect(r.text()).toContain('98 / 100')
    await key(' ', 'Space')
    expect(r.text()).toContain('일시정지')
    expect(r.button('재개 (Space)')).toBeTruthy()
    r.unmount()
  })

  it('E3-16 상태 전이마다 onChange(저장용), 종료 시 onDone', async () => {
    const { r, advance, changes, done } = await mount(initRun(), ['rc'])
    await r.click(r.button('시작'))
    expect(changes.at(-1)!.status).toBe('running')
    await advance(75 * MIN + 300)
    expect(done()!.status).toBe('done')
    r.unmount()
  })

  it('E3-17 저장된 상태로 이어하기: 경과 시간 반영', async () => {
    const plan = toeicPlan(['rc'])
    const saved = start(plan, initRun(), T0 - 30 * MIN) // 30분 전에 시작
    const { r } = await mount(saved, ['rc'])
    expect(r.text()).toContain('45:00')
    r.unmount()
  })

  it('E3-18 시험 종료 2단계 확인', async () => {
    const { r, done } = await mount(initRun(), ['rc'])
    await r.click(r.button('시작'))
    await r.click(r.button('시험 종료'))
    await r.click(r.button('종료 확인'))
    expect(done()!.records).toHaveLength(1)
    r.unmount()
  })
})

describe('E3 시계 표기', () => {
  it('E3-19 fmtClock: 60분 이상도 분:초, 초 올림, 음수', async () => {
    const { fmtClock } = await import('../../src/domain/format')
    expect([fmtClock(75 * MIN), fmtClock(64 * MIN), fmtClock(8 * MIN - 100), fmtClock(0), fmtClock(-61_000)]).toEqual(['75:00', '64:00', '8:00', '0:00', '-1:01'])
  })
})
