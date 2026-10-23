import { describe, expect, it } from 'vitest'
import { BUILTIN_PRESETS, examMinutes, examQuestions } from '../../src/domain/presets'
import { parseExam } from '../../src/domain/schema'
import App from '../../src/App'
import { render } from './render'

const toeic = () => BUILTIN_PRESETS.find((e) => e.id === 'toeic-lr')!

describe('E1 내장 프리셋 (F1)', () => {
  it('E1-01 내장 5종 로드·검증 통과, TOEIC 이 첫 번째', () => {
    expect(BUILTIN_PRESETS.map((e) => e.id)).toEqual(['toeic-lr', 'ielts-paper', 'toefl-ibt-2026', 'teps', 'csat'])
  })

  it('E1-02 TOEIC LC 45분: Part 1~4 문항·번호 범위', () => {
    const lc = toeic().sections[0]
    expect(lc).toMatchObject({ id: 'lc', minutes: 45, mode: 'forced' })
    expect(lc.parts.map((p) => [p.name, p.questions, p.range])).toEqual([
      ['Part 1', 6, [1, 6]],
      ['Part 2', 25, [7, 31]],
      ['Part 3', 39, [32, 70]],
      ['Part 4', 30, [71, 100]],
    ])
  })

  it('E1-03 TOEIC RC 75분: P5 11 / P6 8 / P7 단일 27 + 다중 24 / 검토 5', () => {
    const rc = toeic().sections[1]
    expect(rc).toMatchObject({ id: 'rc', minutes: 75, mode: 'self' })
    expect(rc.parts.map((p) => [p.id, p.questions ?? 0, p.minutes])).toEqual([
      ['p5', 30, 11],
      ['p6', 16, 8],
      ['p7s', 29, 27],
      ['p7m', 25, 24],
      ['review', 0, 5],
    ])
    expect(rc.parts.find((p) => p.id === 'review')!.kind).toBe('review')
  })

  it('E1-04 TOEIC 총 120분·200문항', () => {
    expect(examMinutes(toeic())).toBe(120)
    expect(examQuestions(toeic())).toBe(200)
  })

  it('E1-05 모든 내장 프리셋: 섹션 합계 = 파트 합계', () => {
    for (const e of BUILTIN_PRESETS)
      for (const s of e.sections)
        expect(s.parts.reduce((t, p) => t + p.minutes, 0), `${e.id}/${s.id}`).toBeCloseTo(s.minutes)
  })

  it('E1-06 출처 메타: 확인됨/가정 상태와 확인일', () => {
    for (const e of BUILTIN_PRESETS) {
      expect(['verified', 'assumed']).toContain(e.source?.status)
      expect(e.source?.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('E1-07 parseExam: 잘못된 JSON 거부 (경로 포함 오류)', () => {
    expect(parseExam(null).errors).toEqual(['root: 객체가 아님'])
    const bad = parseExam({ id: 'x', name: 'X', sections: [{ id: 's', name: 'S', mode: 'oops', minutes: -1, parts: [] }] })
    expect(bad.exam).toBeUndefined()
    expect(bad.errors).toEqual(expect.arrayContaining(['sections[0].mode: "forced" | "self"', 'sections[0].minutes: 양수 필요', 'sections[0].parts: 1개 이상 필요']))
    const dup = parseExam({
      id: 'x', name: 'X',
      sections: [{ id: 's', name: 'S', mode: 'self', minutes: 2, parts: [{ id: 'a', name: 'A', minutes: 1 }, { id: 'a', name: 'B', minutes: 1 }],
        constraints: [{ type: 'sumMax', parts: ['zz'], minutes: 1, label: 'L' }] }],
    })
    expect(dup.errors).toEqual(['sections[0].parts[1].id: 중복 "a"', 'sections[0].constraints[0].parts: 알 수 없는 파트 "zz"'])
  })

  it('E1-08 parseExam: 잉여 필드 제거·start 기본값 auto', () => {
    const { exam } = parseExam({ id: 'x', name: 'X', evil: '<script>', sections: [{ id: 's', name: 'S', mode: 'self', minutes: 1, parts: [{ id: 'a', name: 'A', minutes: 1, junk: 1 }] }] })
    expect(exam).toEqual({ id: 'x', name: 'X', sections: [{ id: 's', name: 'S', mode: 'self', minutes: 1, start: 'auto', parts: [{ id: 'a', name: 'A', minutes: 1 }] }] })
  })
})

describe('E1 시험 선택 화면', () => {
  it('E1-09 카드 5개 렌더, 가정 프리셋에 "확인 필요" 배지', async () => {
    const r = await render(<App />)
    expect(r.el.querySelectorAll('#builtin-h + p + ul > li')).toHaveLength(5)
    expect(r.text()).toContain('TOEIC Listening & Reading')
    expect(r.text()).toContain('120분 · 200문항')
    expect(r.el.querySelectorAll('.bg-amber-100')).toHaveLength(3) // TOEFL·TEPS·수능
    r.unmount()
  })

  it('E1-10 TOEIC 선택 → LC/RC 파트 기본값 표시', async () => {
    const r = await render(<App />)
    await r.click(r.button(/TOEIC Listening & Reading/))
    const t = r.text()
    expect(t).toContain('LC (듣기)')
    expect(t).toContain('RC (읽기)')
    expect(t).toContain('Part 7 다중')
    expect(t).toContain('마킹·검토')
    r.unmount()
  })
})
