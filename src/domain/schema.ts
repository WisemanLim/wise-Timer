import type { Constraint, Exam, Part, Section } from './types'

// 프리셋 JSON 구조 검증 (내장 프리셋 로드·사용자 JSON 가져오기 공용). 의존성 없이 최소 검증.

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const isPosNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

export interface ParseResult {
  exam?: Exam
  errors: string[]
}

export function parseExam(raw: unknown): ParseResult {
  const errors: string[] = []
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`)

  if (!isObj(raw)) return { errors: ['root: 객체가 아님'] }
  if (!isStr(raw.id)) err('id', '문자열 필요')
  if (!isStr(raw.name)) err('name', '문자열 필요')
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) {
    err('sections', '1개 이상 필요')
    return { errors }
  }

  const sectionIds = new Set<string>()
  raw.sections.forEach((s: unknown, si: number) => {
    const sp = `sections[${si}]`
    if (!isObj(s)) return err(sp, '객체가 아님')
    if (!isStr(s.id)) err(`${sp}.id`, '문자열 필요')
    else if (sectionIds.has(s.id)) err(`${sp}.id`, `중복 "${s.id}"`)
    else sectionIds.add(s.id)
    if (!isStr(s.name)) err(`${sp}.name`, '문자열 필요')
    if (s.mode !== 'forced' && s.mode !== 'self') err(`${sp}.mode`, '"forced" | "self"')
    if (s.start !== undefined && s.start !== 'auto' && s.start !== 'manual') err(`${sp}.start`, '"auto" | "manual"')
    if (!isPosNum(s.minutes)) err(`${sp}.minutes`, '양수 필요')
    if (!Array.isArray(s.parts) || s.parts.length === 0) return err(`${sp}.parts`, '1개 이상 필요')

    const partIds = new Set<string>()
    s.parts.forEach((p: unknown, pi: number) => {
      const pp = `${sp}.parts[${pi}]`
      if (!isObj(p)) return err(pp, '객체가 아님')
      if (!isStr(p.id)) err(`${pp}.id`, '문자열 필요')
      else if (partIds.has(p.id)) err(`${pp}.id`, `중복 "${p.id}"`)
      else partIds.add(p.id)
      if (!isStr(p.name)) err(`${pp}.name`, '문자열 필요')
      if (!isPosNum(p.minutes)) err(`${pp}.minutes`, '양수 필요')
      if (p.questions !== undefined && !(Number.isInteger(p.questions) && (p.questions as number) > 0))
        err(`${pp}.questions`, '양의 정수 필요')
      if (
        p.range !== undefined &&
        !(Array.isArray(p.range) && p.range.length === 2 && p.range.every(Number.isInteger) && p.range[0] <= p.range[1])
      )
        err(`${pp}.range`, '[시작, 끝] 정수 필요')
      if (p.kind !== undefined && p.kind !== 'review') err(`${pp}.kind`, '"review" 만 허용')
    })

    if (s.constraints !== undefined) {
      if (!Array.isArray(s.constraints)) return err(`${sp}.constraints`, '배열 필요')
      s.constraints.forEach((c: unknown, ci: number) => {
        const cp = `${sp}.constraints[${ci}]`
        if (!isObj(c)) return err(cp, '객체가 아님')
        if (!Array.isArray(c.parts) || c.parts.length === 0) err(`${cp}.parts`, '1개 이상 필요')
        else c.parts.forEach((id) => partIds.has(id as string) || err(`${cp}.parts`, `알 수 없는 파트 "${id}"`))
        if (!isStr(c.label)) err(`${cp}.label`, '문자열 필요')
        if (c.type === 'sumMax') {
          if (!isPosNum(c.minutes)) err(`${cp}.minutes`, '양수 필요')
        } else if (c.type === 'maxSecPerQuestion') {
          if (!isPosNum(c.seconds)) err(`${cp}.seconds`, '양수 필요')
        } else err(`${cp}.type`, '"sumMax" | "maxSecPerQuestion"')
      })
    }
  })

  if (errors.length) return { errors }
  return { exam: normalize(raw as unknown as Exam), errors }
}

/** 알려진 필드만 남긴 깊은 복사 (가져온 JSON 의 잉여 필드 제거) */
function normalize(e: Exam): Exam {
  const part = (p: Part): Part => ({
    id: p.id, name: p.name, minutes: p.minutes,
    ...(p.desc && { desc: p.desc }),
    ...(p.questions && { questions: p.questions }),
    ...(p.range && { range: [p.range[0], p.range[1]] as [number, number] }),
    ...(p.kind && { kind: p.kind }),
  })
  const constraint = (c: Constraint): Constraint => ({ ...c, parts: [...c.parts] })
  const section = (s: Section): Section => ({
    id: s.id, name: s.name, mode: s.mode, minutes: s.minutes, start: s.start ?? 'auto',
    ...(s.note && { note: s.note }),
    parts: s.parts.map(part),
    ...(s.constraints && { constraints: s.constraints.map(constraint) }),
  })
  return {
    id: e.id, name: e.name,
    ...(e.category && { category: e.category }),
    ...(e.description && { description: e.description }),
    ...(e.source && { source: { ...e.source, urls: [...(e.source.urls ?? [])] } }),
    sections: e.sections.map(section),
  }
}
