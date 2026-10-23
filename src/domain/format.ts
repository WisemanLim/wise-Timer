/** ms → "m:ss" (시험 시계 관례: 60분 이상도 "75:00"). 음수는 "-" 접두. 남은 시간 표시용으로 초 올림. */
export function fmtClock(ms: number): string {
  const total = Math.ceil(Math.abs(ms) / 1000)
  const body = `${Math.floor(total / 60)}:${pad(total % 60)}`
  return ms < 0 ? `-${body}` : body
}

/** 소요·차이 기록용 ms → "m:ss" (초 반올림, 카운트다운용 fmtClock 과 달리 올림하지 않음) */
export function fmtDuration(ms: number): string {
  const total = Math.round(Math.abs(ms) / 1000)
  const body = `${Math.floor(total / 60)}:${pad(total % 60)}`
  return ms < 0 && total > 0 ? `-${body}` : body
}

/** 분(소수 허용) → "11분" / "7분 30초" */
export function fmtMinutes(min: number): string {
  const sec = Math.round(min * 60)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m}분 ${s}초` : `${m}분`
}

const pad = (n: number) => String(n).padStart(2, '0')
