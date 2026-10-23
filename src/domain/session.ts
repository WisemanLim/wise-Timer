import { cumEnds, durationMs, sectionQuestions, type Plan, type RunState } from './engine'
import { KEYS, load, save } from '../storage'

// 세션 기록 (F6): 파트별 계획 대비 실제. PRD §5 KPI — 파트 초과(분)·미완료 문항·검토 시작 시각·설정 소요 시간.

export interface PartResult {
  partId: string
  name: string
  plannedMs: number
  /** 실제 소요: 파트 완료(N) 기준, 섹션 종료 때 진행 중이던 파트는 종료 시각까지. 시작 못 한 파트는 null */
  actualMs: number | null
  overMs: number | null
  /** done = 완료 표시, cut = 섹션 종료로 끊김, null = 시작 못 함 */
  status: 'done' | 'cut' | null
  review: boolean
}

export interface SectionResult {
  sectionId: string
  name: string
  mode: 'forced' | 'self'
  plannedMs: number
  actualMs: number
  endedEarly: boolean
  questions: number
  answered: number
  parts: PartResult[]
  /** 검토 구간 진입: 계획 시각 vs 실제(직전 파트 완료 시각), 섹션 경과 ms */
  reviewStart: { plannedMs: number; actualMs: number | null } | null
}

export interface Session {
  id: string
  examId: string
  examName: string
  startedAt: number
  endedAt: number
  /** 시험 선택 → 시작까지 (KPI: 설정 1분 이내) */
  setupMs: number | null
  sections: SectionResult[]
  /** 사용자가 입력한 미완료 문항 수 */
  unanswered: number | null
  /** 계획 초과 합계 (양수 초과분만, 검토 구간 제외) */
  totalOverMs: number
}

export function buildSession(plan: Plan, st: RunState, setupMs: number | null): Session {
  const sections = st.records.map((rec): SectionResult => {
    const s = plan.sections.find((x) => x.id === rec.sectionId)!
    const ends = cumEnds(s)
    const sectionEnd = rec.endedAt - rec.startedAt - rec.pausedMs
    const parts = s.parts.map((p, i): PartResult => {
      const plannedMs = p.minutes * 60_000
      const prev = i === 0 ? 0 : (rec.marks[i - 1] ?? 0)
      const status = s.mode !== 'self' ? null : i < rec.marks.length ? 'done' : i === rec.marks.length ? 'cut' : null
      const actualMs = status === 'done' ? rec.marks[i] - prev : status === 'cut' ? Math.max(0, sectionEnd - prev) : null
      return { partId: p.id, name: p.name, plannedMs, actualMs, overMs: actualMs === null ? null : actualMs - plannedMs, status, review: p.kind === 'review' }
    })
    const r = s.parts.findIndex((p) => p.kind === 'review')
    const reviewStart =
      s.mode === 'self' && r > 0 ? { plannedMs: ends[r - 1], actualMs: rec.marks.length >= r ? rec.marks[r - 1] : null } : null
    return {
      sectionId: s.id, name: s.name, mode: s.mode, plannedMs: durationMs(s),
      actualMs: rec.endedAt - rec.startedAt - rec.pausedMs, endedEarly: rec.endedEarly,
      questions: sectionQuestions(s), answered: rec.answered, parts, reviewStart,
    }
  })
  // 검토(버퍼) 구간이 길어진 것은 앞 파트를 일찍 끝낸 결과이므로 초과에서 제외
  const totalOverMs = sections.flatMap((x) => x.parts).filter((p) => !p.review).reduce((t, p) => t + Math.max(0, p.overMs ?? 0), 0)
  const first = st.records[0]
  const last = st.records.at(-1)
  return {
    id: `s-${first?.startedAt ?? Date.now()}`,
    examId: plan.exam.id,
    examName: plan.exam.name,
    startedAt: first?.startedAt ?? 0,
    endedAt: last?.endedAt ?? 0,
    setupMs,
    sections,
    unanswered: null,
    totalOverMs,
  }
}

/** 자기 페이스 섹션에서 문항 카운터를 썼다면 남은 문항을 미완료 기본값으로 제안 */
export function suggestedUnanswered(s: Session): number | null {
  const self = s.sections.filter((x) => x.mode === 'self' && x.questions > 0 && x.answered > 0)
  return self.length ? self.reduce((t, x) => t + x.questions - x.answered, 0) : null
}

const MAX = 200

export const loadSessions = (): Session[] => load<Session[]>(KEYS.sessions, [])

export function saveSession(s: Session): Session[] {
  const list = [s, ...loadSessions().filter((x) => x.id !== s.id)].slice(0, MAX)
  save(KEYS.sessions, list)
  return list
}

export function deleteSession(id: string): Session[] {
  const list = loadSessions().filter((x) => x.id !== id)
  save(KEYS.sessions, list)
  return list
}

/** 같은 시험의 직전 세션 (비교용) */
export const previousOf = (list: Session[], s: Session) =>
  list.filter((x) => x.examId === s.examId && x.startedAt < s.startedAt).sort((a, b) => b.startedAt - a.startedAt)[0]
