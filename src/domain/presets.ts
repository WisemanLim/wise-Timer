import type { Exam } from './types'
import { parseExam } from './schema'

// src/presets/*.json 을 빌드 시 번들 (오프라인 동작). 파일 추가만으로 목록에 반영.
const files = import.meta.glob('../presets/*.json', { eager: true, import: 'default' })

const ORDER = ['toeic-lr', 'ielts-paper', 'toefl-ibt-2026', 'teps', 'csat']

export const BUILTIN_PRESETS: Exam[] = Object.entries(files)
  .map(([path, raw]) => {
    const { exam, errors } = parseExam(raw)
    if (!exam) throw new Error(`내장 프리셋 오류 ${path}: ${errors.join('; ')}`)
    return exam
  })
  .sort((a, b) => rank(a.id) - rank(b.id))

function rank(id: string) {
  const i = ORDER.indexOf(id)
  return i < 0 ? ORDER.length : i
}

export const examMinutes = (e: Exam) => e.sections.reduce((s, x) => s + x.minutes, 0)
export const examQuestions = (e: Exam) =>
  e.sections.reduce((s, x) => s + x.parts.reduce((t, p) => t + (p.questions ?? 0), 0), 0)
