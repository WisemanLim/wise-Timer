import { describe, expect, it } from 'vitest'
import { BUILTIN_PRESETS } from '../../src/domain/presets'
import { applyLink, checkAllocation, constraintKey, setPartMinutes, setSectionMinutes } from '../../src/domain/allocation'
import AllocationEditor from '../../src/components/AllocationEditor'
import type { Exam } from '../../src/domain/types'
import { render } from './render'

const toeic = () => structuredClone(BUILTIN_PRESETS.find((e) => e.id === 'toeic-lr')!)
const rcPart = (e: Exam, id: string) => e.sections[1].parts.find((p) => p.id === id)!.minutes
const LINK = constraintKey('rc', 0)

describe('E2 배분 검증 규칙 (F2)', () => {
  it('E2-01 기본 TOEIC 배분은 오류·경고 없음', () => {
    expect(checkAllocation(toeic())).toEqual([])
  })

  it('E2-02 RC 파트 합계 > 75분 → 오류(시작 차단)', () => {
    const e = setPartMinutes(toeic(), 'rc', 'p7s', 30) // 11+8+30+24+5 = 78
    const errs = checkAllocation(e).filter((i) => i.level === 'error')
    expect(errs.map((i) => i.message)).toContain('RC (읽기): 파트 합계 78분이 섹션 시간 75분을 초과합니다')
  })

  it('E2-03 RC 파트 합계 < 75분 → 미배정 경고', () => {
    const e = setPartMinutes(toeic(), 'rc', 'review', 3)
    expect(checkAllocation(e)).toEqual([expect.objectContaining({ level: 'warning', message: 'RC (읽기): 미배정 2분 (파트 합계 73분)' })])
  })

  it('E2-04 Part 5+6 > 20분 → 오류 (연동 꺼짐)', () => {
    let e = setPartMinutes(toeic(), 'rc', 'p5', 13) // 13+8 = 21
    e = setPartMinutes(e, 'rc', 'p7s', 25) // 섹션 합계는 맞춤: 13+8+25+24+5 = 75
    expect(checkAllocation(e)).toEqual([expect.objectContaining({ level: 'error', partIds: ['p5', 'p6'], message: 'Part 5+6 ≤ 20분 (문항당 20~30초) — 현재 21분' })])
  })

  it('E2-05 연동 켜기 → P5 11 이면 P6 9 (합 20)', () => {
    const e = applyLink(toeic(), 'rc', 0)
    expect([rcPart(e, 'p5'), rcPart(e, 'p6')]).toEqual([11, 9])
  })

  it('E2-06 연동 중 P5 12 → P6 8, P5 13 → P6 7 (PRD 예시)', () => {
    const a = setPartMinutes(toeic(), 'rc', 'p5', 12, [LINK])
    expect([rcPart(a, 'p5'), rcPart(a, 'p6')]).toEqual([12, 8])
    const b = setPartMinutes(toeic(), 'rc', 'p5', 13, [LINK])
    expect([rcPart(b, 'p5'), rcPart(b, 'p6')]).toEqual([13, 7])
    const c = setPartMinutes(toeic(), 'rc', 'p6', 6, [LINK])
    expect([rcPart(c, 'p5'), rcPart(c, 'p6')]).toEqual([14, 6])
  })

  it('E2-07 Part 7 문항당 1분 초과 → 경고(차단 아님)', () => {
    let e = setPartMinutes(toeic(), 'rc', 'p7s', 31)
    e = setSectionMinutes(e, 'rc', 79) // 11+8+31+24+5 = 79, 55분/54문항 = 61초
    expect(checkAllocation(e)).toEqual([expect.objectContaining({ level: 'warning', message: 'Part 7 문항당 최대 1분 — 현재 문항당 61초' })])
  })

  it('E2-08 포함하지 않은 섹션은 검증 제외', () => {
    const e = setPartMinutes(toeic(), 'rc', 'p7s', 40)
    expect(checkAllocation(e, ['lc'])).toEqual([])
  })

  it('E2-09 원본 프리셋 불변', () => {
    const e = toeic()
    setPartMinutes(e, 'rc', 'p5', 15, [LINK])
    expect(rcPart(e, 'p5')).toBe(11)
  })
})

describe('E2 배분 편집 화면', () => {
  const setup = async () => {
    let started: { exam: Exam; ids: string[] } | null = null
    const r = await render(<AllocationEditor exam={toeic()} onBack={() => {}} onStart={(exam, ids) => (started = { exam, ids })} />)
    return { r, started: () => started as { exam: Exam; ids: string[] } | null }
  }

  it('E2-10 F2 수용 기준: 연동 켜고 P5 12 → P6 8 자동, RC 합계 초과 시 시작 차단', async () => {
    const { r } = await setup()
    await r.click(r.el.querySelector<HTMLInputElement>('section:nth-of-type(2) label input[type=checkbox]'))
    await r.change(r.input('RC (읽기) Part 5 시간'), '12')
    expect(r.input('RC (읽기) Part 6 시간').value).toBe('8')
    // 12+8+27+24+5 = 76 > 75
    expect(r.text()).toContain('오류: RC (읽기): 파트 합계 76분이 섹션 시간 75분을 초과합니다')
    expect(r.button(/^시작/).disabled).toBe(true)
    await r.change(r.input('RC (읽기) Part 7 단일 시간'), '26')
    expect(r.button(/^시작/).disabled).toBe(false)
    r.unmount()
  })

  it('E2-11 시작 → 편집된 배분·포함 섹션 전달, LC 제외 가능', async () => {
    const { r, started } = await setup()
    await r.click(r.input('LC (듣기) 포함'))
    expect(r.button(/^시작/).textContent).toContain('75분')
    await r.click(r.button(/^시작/))
    expect(started()!.ids).toEqual(['rc'])
    r.unmount()
  })

  it('E2-12 마지막 남은 섹션은 해제 불가', async () => {
    const { r } = await setup()
    await r.click(r.input('LC (듣기) 포함'))
    expect(r.input('RC (읽기) 포함').disabled).toBe(true)
    r.unmount()
  })

  it('E2-13 기본값으로 되돌리기', async () => {
    const { r } = await setup()
    await r.change(r.input('RC (읽기) 마킹·검토 시간'), '3')
    expect(r.text()).toContain('주의: RC (읽기): 미배정 2분')
    await r.click(r.button('기본값으로 되돌리기'))
    expect(r.input('RC (읽기) 마킹·검토 시간').value).toBe('5')
    expect(r.text()).not.toContain('미배정')
    r.unmount()
  })
})
