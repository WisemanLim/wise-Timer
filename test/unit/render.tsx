// 테스트용 최소 렌더 헬퍼 (testing-library 미사용)
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export interface Rendered {
  el: HTMLElement
  root: Root
  text: () => string
  click: (target: Element | null | undefined) => Promise<void>
  button: (label: string | RegExp) => HTMLButtonElement
  input: (label: string | RegExp) => HTMLInputElement
  change: (input: HTMLInputElement, value: string) => Promise<void>
  unmount: () => void
}

export async function render(ui: ReactElement): Promise<Rendered> {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => root.render(ui))
  const match = (s: string | null | undefined, l: string | RegExp) =>
    s != null && (typeof l === 'string' ? s.trim() === l : l.test(s))
  return {
    el,
    root,
    text: () => el.textContent ?? '',
    click: async (t) => {
      if (!t) throw new Error('click target not found')
      await act(async () => (t as HTMLElement).click())
    },
    button: (l) => {
      const b = [...el.querySelectorAll('button')].find((x) => match(x.textContent, l) || match(x.getAttribute('aria-label'), l))
      if (!b) throw new Error(`button not found: ${l}`)
      return b
    },
    input: (l) => {
      const i = [...el.querySelectorAll('input')].find((x) => match(x.getAttribute('aria-label'), l) || (x.labels && [...x.labels].some((lb) => match(lb.textContent, l))))
      if (!i) throw new Error(`input not found: ${l}`)
      return i as HTMLInputElement
    },
    change: async (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      await act(async () => {
        setter.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    },
    unmount: () => {
      act(() => root.unmount())
      el.remove()
    },
  }
}
