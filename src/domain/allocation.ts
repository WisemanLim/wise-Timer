import type { Exam, Section } from './types'

// 시간 배분 검증·편집 규칙 (F2). 모든 함수는 순수 함수 — 입력 exam 을 변경하지 않는다.

export interface Issue {
  level: 'error' | 'warning'
  sectionId: string
  partIds: string[]
  message: string
}

const EPS = 1e-9
const round = (n: number) => Math.round(n * 100) / 100
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export const constraintKey = (sectionId: string, index: number) => `${sectionId}:${index}`

export function checkSection(s: Section): Issue[] {
  const issues: Issue[] = []
  const total = sum(s.parts.map((p) => p.minutes))
  if (total > s.minutes + EPS)
    issues.push({ level: 'error', sectionId: s.id, partIds: s.parts.map((p) => p.id),
      message: `${s.name}: 파트 합계 ${round(total)}분이 섹션 시간 ${s.minutes}분을 초과합니다` })
  else if (total < s.minutes - EPS)
    issues.push({ level: 'warning', sectionId: s.id, partIds: [],
      message: `${s.name}: 미배정 ${round(s.minutes - total)}분 (파트 합계 ${round(total)}분)` })

  for (const c of s.constraints ?? []) {
    const parts = s.parts.filter((p) => c.parts.includes(p.id))
    const minutes = sum(parts.map((p) => p.minutes))
    if (c.type === 'sumMax' && minutes > c.minutes + EPS)
      issues.push({ level: 'error', sectionId: s.id, partIds: c.parts, message: `${c.label} — 현재 ${round(minutes)}분` })
    if (c.type === 'maxSecPerQuestion') {
      const q = sum(parts.map((p) => p.questions ?? 0))
      const perQ = q ? (minutes * 60) / q : 0
      if (perQ > c.seconds + EPS)
        issues.push({ level: 'warning', sectionId: s.id, partIds: c.parts, message: `${c.label} — 현재 문항당 ${Math.round(perQ)}초` })
    }
  }
  return issues
}

export function checkAllocation(exam: Exam, includedIds?: string[]): Issue[] {
  return exam.sections.filter((s) => !includedIds || includedIds.includes(s.id)).flatMap(checkSection)
}

/** 파트 시간 변경. linkedKeys 에 포함된 연동 제약(파트 2개)은 다른 파트를 합계 유지로 자동 조정 */
export function setPartMinutes(exam: Exam, sectionId: string, partId: string, minutes: number, linkedKeys: string[] = []): Exam {
  return mapSection(exam, sectionId, (s) => {
    const values = new Map(s.parts.map((p) => [p.id, p.id === partId ? minutes : p.minutes]))
    ;(s.constraints ?? []).forEach((c, i) => {
      if (c.type !== 'sumMax' || !c.linkable || c.parts.length !== 2 || !linkedKeys.includes(constraintKey(s.id, i))) return
      if (!c.parts.includes(partId)) return
      const other = c.parts.find((id) => id !== partId)!
      values.set(other, Math.max(0.5, round(c.minutes - minutes)))
    })
    return { ...s, parts: s.parts.map((p) => ({ ...p, minutes: values.get(p.id)! })) }
  })
}

/** 연동을 켤 때: 마지막 파트를 조정해 합계 = 제약 minutes */
export function applyLink(exam: Exam, sectionId: string, index: number): Exam {
  const s = exam.sections.find((x) => x.id === sectionId)
  const c = s?.constraints?.[index]
  if (!s || !c || c.type !== 'sumMax' || c.parts.length !== 2) return exam
  const first = s.parts.find((p) => p.id === c.parts[0])!
  return setPartMinutes(exam, sectionId, first.id, first.minutes, [constraintKey(sectionId, index)])
}

export function setSectionMinutes(exam: Exam, sectionId: string, minutes: number): Exam {
  return mapSection(exam, sectionId, (s) => ({ ...s, minutes }))
}

function mapSection(exam: Exam, sectionId: string, fn: (s: Section) => Section): Exam {
  return { ...exam, sections: exam.sections.map((s) => (s.id === sectionId ? fn(s) : s)) }
}
