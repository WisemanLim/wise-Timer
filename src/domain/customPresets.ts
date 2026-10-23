import type { Exam } from './types'
import { parseExam } from './schema'
import { KEYS, load, save } from '../storage'

// 사용자 프리셋 (F5): 브라우저 localStorage 저장 + JSON 내보내기/가져오기.

export function loadCustom(): Exam[] {
  // 저장 데이터도 스키마 검증 — 손상된 항목은 건너뜀
  return load<unknown[]>(KEYS.custom, []).flatMap((raw) => parseExam(raw).exam ?? [])
}

export function saveCustomList(list: Exam[]) {
  save(KEYS.custom, list)
}

const newId = (taken: Set<string>) => {
  let id = `custom-${Date.now().toString(36)}`
  for (let i = 2; taken.has(id); i++) id = `custom-${Date.now().toString(36)}-${i}`
  return id
}

/** 새 사용자 프리셋으로 추가 (id 새로 발급) */
export function addCustom(list: Exam[], exam: Exam, name: string): Exam[] {
  const item: Exam = { ...structuredClone(exam), id: newId(new Set(list.map((e) => e.id))), name: name.trim() || exam.name }
  delete item.source // 사용자 배분은 공식 출처와 분리
  return [...list, item]
}

export function replaceCustom(list: Exam[], exam: Exam): Exam[] {
  return list.map((e) => (e.id === exam.id ? structuredClone(exam) : e))
}

export function removeCustom(list: Exam[], id: string): Exam[] {
  return list.filter((e) => e.id !== id)
}

/** JSON 텍스트 가져오기: 검증 통과 시 새 id 로 추가. 실패하면 오류 목록 */
export function importCustom(list: Exam[], text: string): { list: Exam[]; errors: string[]; added?: Exam } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { list, errors: ['JSON 형식이 아닙니다'] }
  }
  const { exam, errors } = parseExam(raw)
  if (!exam) return { list, errors }
  const next = addCustom(list, exam, exam.name)
  return { list: next, errors: [], added: next[next.length - 1] }
}

export const exportJson = (exam: Exam) => JSON.stringify(exam, null, 2) + '\n'

export function downloadJson(exam: Exam) {
  const url = URL.createObjectURL(new Blob([exportJson(exam)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${exam.id}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
