// localStorage 래퍼. 개인 브라우저에만 저장(서버 전송 없음). 접근 실패(사파리 사생활 보호 등)는 무시.

const PREFIX = 'wise-timer:'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(PREFIX + key)
    else localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* 저장 불가 — 앱은 계속 동작 */
  }
}

export const KEYS = {
  run: 'run',
  custom: 'custom-presets',
  sessions: 'sessions',
  prefs: 'prefs',
} as const
