import { beforeEach, describe, expect, it } from 'vitest'
import { BUILTIN_PRESETS } from '../../src/domain/presets'
import { addCustom, exportJson, importCustom, loadCustom, removeCustom, replaceCustom, saveCustomList } from '../../src/domain/customPresets'
import App from '../../src/App'
import { render } from './render'

const toeic = () => structuredClone(BUILTIN_PRESETS.find((e) => e.id === 'toeic-lr')!)

beforeEach(() => localStorage.clear())

describe('E4 사용자 프리셋 (F5)', () => {
  it('E4-01 저장: 새 id·이름, 출처 제거, 원본 불변', () => {
    const list = addCustom([], toeic(), '우리반 RC 배분')
    expect(list).toHaveLength(1)
    expect(list[0].id).toMatch(/^custom-/)
    expect(list[0]).toMatchObject({ name: '우리반 RC 배분' })
    expect(list[0].source).toBeUndefined()
    expect(toeic().source).toBeDefined()
  })

  it('E4-02 localStorage 왕복 + 손상 항목 무시', () => {
    saveCustomList(addCustom([], toeic(), 'A'))
    const raw = JSON.parse(localStorage.getItem('wise-timer:custom-presets')!)
    localStorage.setItem('wise-timer:custom-presets', JSON.stringify([...raw, { broken: true }]))
    expect(loadCustom().map((e) => e.name)).toEqual(['A'])
  })

  it('E4-03 덮어쓰기·삭제', () => {
    let list = addCustom([], toeic(), 'A')
    list = replaceCustom(list, { ...list[0], name: 'B' })
    expect(list[0].name).toBe('B')
    expect(removeCustom(list, list[0].id)).toEqual([])
  })

  it('E4-04 JSON 내보내기 → 가져오기 왕복 (id 충돌 없이 새로 발급)', () => {
    const list = addCustom([], toeic(), 'A')
    const r = importCustom(list, exportJson(list[0]))
    expect(r.errors).toEqual([])
    expect(r.list).toHaveLength(2)
    expect(r.added!.id).not.toBe(list[0].id)
    expect(r.added!.sections).toEqual(list[0].sections)
  })

  it('E4-05 잘못된 JSON 가져오기 거부', () => {
    expect(importCustom([], '{oops').errors).toEqual(['JSON 형식이 아닙니다'])
    expect(importCustom([], '{"id":"x","name":"X","sections":[]}').errors).toEqual(['sections: 1개 이상 필요'])
  })

  it('E4-06 화면: 배분 수정 → 내 프리셋 저장 → 목록 표시 → 재시작(새로고침) 후 유지 → 삭제', async () => {
    const r = await render(<App />)
    await r.click(r.button(/TOEIC Listening & Reading/))
    await r.change(r.input('RC (읽기) Part 5 시간'), '10')
    await r.click(r.button('내 프리셋으로 저장'))
    await r.change(r.input('프리셋 이름'), '우리반 RC')
    await r.click(r.button('저장'))
    expect(r.text()).toContain('"우리반 RC" 저장했습니다')
    r.unmount()

    const r2 = await render(<App />) // 새로고침 가정
    expect(r2.text()).toContain('우리반 RC')
    await r2.click(r2.button(/우리반 RC/))
    expect(r2.input('RC (읽기) Part 5 시간').value).toBe('10')
    expect(r2.button('변경 사항 저장')).toBeTruthy()
    await r2.click(r2.button('시험 다시 선택'))
    await r2.click(r2.button('우리반 RC 삭제'))
    await r2.click(r2.button('삭제 확인'))
    expect(r2.text()).toContain('저장된 프리셋이 없습니다')
    expect(loadCustom()).toEqual([])
    r2.unmount()
  })
})
