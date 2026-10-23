import type { Exam, Section } from './types'

// 타이머 엔진 (F3·F4). 순수 함수 + 절대 시각(epoch ms) 기반:
// 경과 = now − 시작 − 일시정지 누계 → 백그라운드 탭·절전으로 interval 이 늦어져도 오차가 누적되지 않는다.

export interface SectionRecord {
  sectionId: string
  startedAt: number
  endedAt: number
  pausedMs: number
  /** 파트 완료 시각 (섹션 경과 ms), parts 순서 */
  marks: number[]
  answered: number
  endedEarly: boolean
}

export interface RunState {
  status: 'ready' | 'running' | 'paused' | 'between' | 'done'
  /** plan.sections 내 현재(또는 다음 시작 대기) 섹션 */
  idx: number
  startedAt: number
  pausedAt: number | null
  pausedMs: number
  marks: number[]
  answered: number
  records: SectionRecord[]
}

export interface Plan {
  exam: Exam
  sections: Section[]
}

export const makePlan = (exam: Exam, sectionIds: string[]): Plan => ({
  exam,
  sections: exam.sections.filter((s) => sectionIds.includes(s.id)),
})

export const initRun = (): RunState => ({
  status: 'ready', idx: 0, startedAt: 0, pausedAt: null, pausedMs: 0, marks: [], answered: 0, records: [],
})

const MIN = 60_000
export const durationMs = (s: Section) => s.minutes * MIN
/** 파트별 계획 종료 시각 (섹션 경과 ms, 누적) */
export const cumEnds = (s: Section) => {
  let t = 0
  return s.parts.map((p) => (t += p.minutes * MIN))
}
export const sectionQuestions = (s: Section) => s.parts.reduce((t, p) => t + (p.questions ?? 0), 0)

export function elapsedMs(st: RunState, now: number) {
  if (st.status !== 'running' && st.status !== 'paused') return 0
  return Math.max(0, (st.pausedAt ?? now) - st.startedAt - st.pausedMs)
}

const fresh = (st: RunState, idx: number, startedAt: number): RunState => ({
  ...st, status: 'running', idx, startedAt, pausedAt: null, pausedMs: 0, marks: [], answered: 0,
})

/** ready·between → running */
export function start(plan: Plan, st: RunState, now: number): RunState {
  if (st.status !== 'ready' && st.status !== 'between') return st
  if (!plan.sections[st.idx]) return st
  return fresh(st, st.idx, now)
}

export function pause(plan: Plan, st: RunState, now: number): RunState {
  if (st.status !== 'running' || plan.sections[st.idx].mode === 'forced') return st
  return { ...st, status: 'paused', pausedAt: now }
}

export function resume(st: RunState, now: number): RunState {
  if (st.status !== 'paused' || st.pausedAt === null) return st
  return { ...st, status: 'running', pausedMs: st.pausedMs + (now - st.pausedAt), pausedAt: null }
}

/** 자기 페이스 섹션: 현재 파트 완료 표시 (사용자 진행 포인터 +1) */
export function completePart(plan: Plan, st: RunState, now: number): RunState {
  const s = plan.sections[st.idx]
  if (st.status !== 'running' || s.mode !== 'self' || st.marks.length >= s.parts.length) return st
  return { ...st, marks: [...st.marks, elapsedMs(st, now)] }
}

export function addAnswered(plan: Plan, st: RunState, delta: number): RunState {
  const s = plan.sections[st.idx]
  if ((st.status !== 'running' && st.status !== 'paused') || s.mode !== 'self') return st
  const answered = Math.min(sectionQuestions(s), Math.max(0, st.answered + delta))
  return answered === st.answered ? st : { ...st, answered }
}

function record(st: RunState, sectionId: string, endedAt: number, endedEarly: boolean): SectionRecord {
  return { sectionId, startedAt: st.startedAt, endedAt, pausedMs: st.pausedMs, marks: st.marks, answered: st.answered, endedEarly }
}

/** 섹션 종료 후 다음 상태: 다음 섹션이 auto 면 endedAt 에 즉시 시작, manual 이면 대기, 없으면 done */
function advance(plan: Plan, st: RunState, endedAt: number, endedEarly: boolean): RunState {
  const s = plan.sections[st.idx]
  const records = [...st.records, record(st, s.id, endedAt, endedEarly)]
  const next = st.idx + 1
  if (!plan.sections[next]) return { ...st, status: 'done', records, pausedAt: null }
  if (plan.sections[next].start === 'manual')
    return { ...st, status: 'between', idx: next, records, pausedAt: null, marks: [], answered: 0, pausedMs: 0 }
  return fresh({ ...st, records }, next, endedAt)
}

/** 시간 경과 반영. 여러 섹션이 한꺼번에 지났어도(절전 복귀) 계획 시각 기준으로 정확히 넘어간다 */
export function tick(plan: Plan, st: RunState, now: number): RunState {
  let cur = st
  while (cur.status === 'running') {
    const s = plan.sections[cur.idx]
    const end = cur.startedAt + cur.pausedMs + durationMs(s)
    if (now < end) break
    cur = advance(plan, cur, end, false)
  }
  return cur
}

/** 섹션 조기 종료 (자기 페이스로 먼저 끝냈을 때) */
export function finishSection(plan: Plan, st: RunState, now: number): RunState {
  if (st.status !== 'running' && st.status !== 'paused') return st
  const resumed = resume(st, now)
  return advance(plan, resumed, now, true)
}

/** 시험 전체 종료 */
export function finishAll(plan: Plan, st: RunState, now: number): RunState {
  if (st.status === 'done') return st
  if (st.status === 'running' || st.status === 'paused') {
    const resumed = resume(st, now)
    const s = plan.sections[st.idx]
    return { ...resumed, status: 'done', records: [...st.records, record(resumed, s.id, now, true)] }
  }
  return { ...st, status: 'done' }
}

// ---------- 화면용 파생 값 ----------

export interface View {
  section: Section
  elapsed: number
  remaining: number
  /** 계획상 현재 파트 (시간 기준) */
  plannedIdx: number
  plannedRemaining: number
  /** 사용자 진행 파트 (forced = plannedIdx) */
  myIdx: number
  /** + 지연 / − 여유 (ms). 계획 구간 안이면 0 */
  delta: number
  /** forced: 예상 문항 번호 */
  expectedQuestion: number | null
  questions: number
  answered: number
  /** 남은 문항 기준 필요 페이스 (초/문항), 검토 구간 예약 시간 제외 */
  neededSecPerQ: number | null
}

export function derive(plan: Plan, st: RunState, now: number): View | null {
  const section = plan.sections[st.idx]
  if (!section || (st.status !== 'running' && st.status !== 'paused')) return null
  const ends = cumEnds(section)
  const total = durationMs(section)
  const elapsed = Math.min(elapsedMs(st, now), total)
  let plannedIdx = ends.findIndex((e) => elapsed < e)
  if (plannedIdx < 0) plannedIdx = section.parts.length - 1
  const plannedRemaining = Math.max(0, ends[plannedIdx] - elapsed)

  const myIdx = section.mode === 'forced' ? plannedIdx : Math.min(st.marks.length, section.parts.length - 1)
  const allDone = section.mode === 'self' && st.marks.length >= section.parts.length
  const myStart = myIdx === 0 ? 0 : ends[myIdx - 1]
  const delta = allDone ? 0 : elapsed > ends[myIdx] ? elapsed - ends[myIdx] : elapsed < myStart ? elapsed - myStart : 0

  let expectedQuestion: number | null = null
  const pp = section.parts[plannedIdx]
  if (section.mode === 'forced' && pp.range && pp.questions) {
    const partStart = plannedIdx === 0 ? 0 : ends[plannedIdx - 1]
    const frac = (elapsed - partStart) / (ends[plannedIdx] - partStart)
    expectedQuestion = Math.min(pp.range[1], pp.range[0] + Math.floor(frac * pp.questions))
  }

  const questions = sectionQuestions(section)
  const remaining = total - elapsed
  const reviewLeft = section.parts.reduce((t, p, i) => {
    if (p.kind !== 'review') return t
    const start = i === 0 ? 0 : ends[i - 1]
    return t + Math.max(0, ends[i] - Math.max(elapsed, start))
  }, 0)
  const left = questions - st.answered
  const neededSecPerQ = section.mode === 'self' && questions > 0 && left > 0 ? Math.max(0, remaining - reviewLeft) / 1000 / left : null

  return { section, elapsed, remaining, plannedIdx, plannedRemaining, myIdx, delta, expectedQuestion, questions, answered: st.answered, neededSecPerQ }
}
