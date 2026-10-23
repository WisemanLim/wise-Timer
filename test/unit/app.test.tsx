import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import App from '../../src/App'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('App (scaffold smoke)', () => {
  it('renders title', async () => {
    const el = document.createElement('div')
    await act(async () => createRoot(el).render(<App />))
    expect(el.textContent).toContain('wise-Timer')
  })
})
