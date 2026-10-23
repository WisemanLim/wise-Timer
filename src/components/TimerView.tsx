import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addAnswered, completePart, cumEnds, derive, durationMs, finishAll, finishSection, pause, resume, start, tick,
  type Plan, type RunState,
} from '../domain/engine'
import { fmtClock, fmtMinutes } from '../domain/format'
import { beep, keepAwake, toggleFullscreen, unlockAudio } from '../platform'
import { KEYS, load, save } from '../storage'

interface Props {
  plan: Plan
  initial: RunState
  onChange: (st: RunState) => void
  onDone: (st: RunState) => void
  onAbort: () => void
}

const TICK_MS = 250

export default function TimerView({ plan, initial, onChange, onDone, onAbort }: Props) {
  // 프로젝터 모드 (F7): 큰 숫자·고대비(검정 배경), 설정은 브라우저에 기억
  const [big, setBig] = useState(() => load<{ projector?: boolean }>(KEYS.prefs, {}).projector ?? false)
  const toggleBig = useCallback(() => {
    setBig((b) => {
      save(KEYS.prefs, { ...load<object>(KEYS.prefs, {}), projector: !b })
      return !b
    })
  }, [])
  const [st, setSt] = useState(initial)
  const [now, setNow] = useState(() => Date.now())
  const [banner, setBanner] = useState('')
  const [confirmEnd, setConfirmEnd] = useState(false)

  const apply = useCallback((fn: (s: RunState, n: number) => RunState) => {
    const n = Date.now()
    setNow(n)
    setSt((s) => fn(s, n))
  }, [])

  // 시각 갱신 + 섹션 경계 처리
  useEffect(() => {
    const id = setInterval(() => apply((s, n) => tick(plan, s, n)), TICK_MS)
    const onVis = () => {
      apply((s, n) => tick(plan, s, n))
      if (document.visibilityState === 'visible') void keepAwake(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [apply, plan])

  // 상태 전이 저장 (tick 마다 새 객체가 아니므로 전이 시에만 호출됨)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    onChange(st)
    if (st.status === 'done') {
      void keepAwake(false)
      onDone(st)
    }
  }, [st, onChange, onDone])

  const view = derive(plan, st, now)
  const section = plan.sections[st.idx]

  // 파트·섹션 전환 알림 (소리 + 화면 + aria-live)
  const sig = `${st.status}|${st.idx}|${view?.plannedIdx ?? -1}`
  const prevSig = useRef(sig)
  useEffect(() => {
    if (prevSig.current === sig) return
    const [prevStatus, prevIdx] = prevSig.current.split('|')
    prevSig.current = sig
    let msg = ''
    if (st.status === 'done') msg = '시험 종료'
    else if (st.status === 'between') msg = `${plan.sections[st.idx - 1]?.name ?? ''} 종료 — 다음: ${section.name} (준비되면 시작)`
    else if (view && (st.status === 'running' || st.status === 'paused')) {
      const p = view.section.parts[view.plannedIdx]
      const sectionChanged = String(st.idx) !== prevIdx || prevStatus === 'ready' || prevStatus === 'between'
      const partInfo = `${p.name}${p.questions ? ` · ${p.questions}문항` : ''} · 남은 ${fmtClock(view.plannedRemaining)}`
      msg = sectionChanged ? `${view.section.name} 시작 — ${partInfo}` : `${p.name} 시작 시각 — ${partInfo}`
      if (!sectionChanged && view.section.mode === 'self' && view.myIdx < view.plannedIdx)
        msg += ` (현재 ${view.section.parts[view.myIdx].name} 진행 중)`
    }
    if (prevStatus === 'paused' || st.status === 'paused') return // 일시정지 전환은 알림 없음
    if (msg) {
      setBanner(msg)
      beep(st.status === 'done' ? 3 : 2)
    }
  }, [sig, st, view, plan, section])

  const isSelf = section?.mode === 'self'
  const running = st.status === 'running'
  const paused = st.status === 'paused'

  const doStart = () => {
    unlockAudio()
    void keepAwake(true)
    apply((s, n) => start(plan, s, n))
  }
  const doToggle = () => apply((s, n) => (s.status === 'paused' ? resume(s, n) : pause(plan, s, n)))
  const doNext = () => apply((s, n) => completePart(plan, s, n))
  const doCount = (d: number) => setSt((s) => addAnswered(plan, s, d))

  // 단축키: Space 시작/일시정지, N 파트 완료, J +1 문항, Shift+J −1
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null
      if (t?.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'Space') {
        if (t?.closest('button')) return // 버튼 포커스 시 기본 동작(클릭) 유지
        e.preventDefault()
        if (st.status === 'ready' || st.status === 'between') doStart()
        else if (isSelf) doToggle()
      } else if (e.key === 'n' || e.key === 'N') doNext()
      else if (e.key === 'j' || e.key === 'J') doCount(e.shiftKey ? -1 : 1)
      else if (e.key === 'p' || e.key === 'P') toggleBig()
      else if (e.key === 'f' || e.key === 'F') void toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const totalPlanned = plan.sections.reduce((t, s) => t + s.minutes, 0)

  return (
    <div className={big ? 'dark fixed inset-0 z-50 space-y-5 overflow-auto bg-black p-4 text-white sm:p-8' : 'space-y-5'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{plan.exam.name}</h2>
          <ol className="mt-1 flex flex-wrap gap-1 text-xs" aria-label="섹션 진행">
            {plan.sections.map((s, i) => (
              <li
                key={s.id}
                aria-current={i === st.idx && st.status !== 'done' ? 'step' : undefined}
                className={`rounded px-2 py-0.5 ${
                  i < st.idx || st.status === 'done'
                    ? 'bg-slate-200 text-slate-600 line-through dark:bg-slate-800 dark:text-slate-400'
                    : i === st.idx
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {s.name} {fmtMinutes(s.minutes)}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={toggleBig} aria-pressed={big} className="rounded-lg border border-slate-400 px-3 py-1.5 text-sm dark:border-slate-500">
            {big ? '일반 화면 (P)' : '프로젝터 모드 (P)'}
          </button>
          <button type="button" onClick={() => void toggleFullscreen()} className="rounded-lg border border-slate-400 px-3 py-1.5 text-sm dark:border-slate-500">
            전체화면 (F)
          </button>
        </div>
      </div>

      <p role="status" aria-live="assertive" className={`min-h-10 rounded-lg px-4 py-2 font-medium ${banner ? 'bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100' : ''}`}>
        {banner}
      </p>

      {(st.status === 'ready' || st.status === 'between') && section && (
        <div className="rounded-xl border border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-slate-700 dark:text-slate-300">{st.status === 'ready' ? `총 ${fmtMinutes(totalPlanned)}` : '쉬는 시간'}</p>
          <p className="mt-1 text-2xl font-bold">
            {st.status === 'ready' ? '첫 섹션' : '다음 섹션'}: {section.name} · {fmtMinutes(section.minutes)}
          </p>
          <button type="button" onClick={doStart} className="mt-4 rounded-lg bg-blue-700 px-8 py-3 text-lg font-semibold text-white hover:bg-blue-800">
            {st.status === 'ready' ? '시작' : `${section.name} 시작`}
          </button>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Space 키로도 시작합니다</p>
        </div>
      )}

      {view && (
        <>
          <div className={`rounded-xl border border-slate-300 bg-white text-center dark:border-slate-700 dark:bg-slate-900 ${big ? 'p-3' : 'p-6'}`}>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {view.section.name} 남은 시간 {paused && <strong className="text-amber-800 dark:text-amber-300">· 일시정지</strong>}
            </p>
            <p
              className={`font-bold tabular-nums leading-none ${big ? 'text-[min(24vw,32vh)]' : 'text-7xl sm:text-8xl'} ${view.remaining <= 5 * 60_000 ? 'text-red-700 dark:text-red-400' : ''}`}
              aria-label={`남은 시간 ${fmtClock(view.remaining)}`}
            >
              {fmtClock(view.remaining)}
            </p>
            {big && (
              <p data-testid="projector-part" className="mt-2 text-5xl font-bold tabular-nums">
                {view.section.parts[view.plannedIdx].name} · {fmtClock(view.plannedRemaining)}
              </p>
            )}
            {view.section.mode === 'forced' && (
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">강제 진행 — 방송·시험 진행에 맞춰 멈추지 않습니다</p>
            )}
          </div>

          <PartTimeline plan={plan} st={st} elapsed={view.elapsed} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm text-slate-700 dark:text-slate-300">{view.section.mode === 'forced' ? '예상 위치' : '계획상 현재 파트'}</p>
              <p className={`font-bold ${big ? 'text-6xl' : 'text-3xl'}`}>{view.section.parts[view.plannedIdx].name}</p>
              <p className="tabular-nums">
                파트 남은 시간 <strong>{fmtClock(view.plannedRemaining)}</strong>
                {view.expectedQuestion !== null && <> · 예상 문항 <strong>{view.expectedQuestion}번</strong></>}
              </p>
            </div>

            {isSelf && (
              <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm text-slate-700 dark:text-slate-300">내 진행</p>
                <p className={`font-bold ${big ? 'text-6xl' : 'text-3xl'}`}>
                  {st.marks.length >= view.section.parts.length ? '모든 파트 완료' : view.section.parts[view.myIdx].name}
                </p>
                <p className="tabular-nums">
                  {view.delta > 0 ? (
                    <span className="font-semibold text-red-700 dark:text-red-400">계획보다 {fmtClock(view.delta)} 늦음</span>
                  ) : view.delta < 0 ? (
                    <span className="font-semibold text-green-800 dark:text-green-400">계획보다 {fmtClock(-view.delta)} 앞섬</span>
                  ) : (
                    <span>계획대로 진행 중</span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={doNext}
                  disabled={!running || st.marks.length >= view.section.parts.length}
                  className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:bg-slate-400 dark:disabled:bg-slate-600"
                >
                  {view.section.parts[view.myIdx].name} 완료 (N)
                </button>
              </div>
            )}
          </div>

          {isSelf && view.questions > 0 && (
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">남은 문항</p>
                <p className="text-3xl font-bold tabular-nums">
                  {view.questions - view.answered}
                  <span className="text-base font-normal"> / {view.questions}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => doCount(-1)} aria-label="푼 문항 1 빼기" className="rounded-lg border border-slate-400 px-3 py-2 dark:border-slate-600">
                  −1
                </button>
                <button type="button" onClick={() => doCount(1)} className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
                  +1 문항 (J)
                </button>
              </div>
              {view.neededSecPerQ !== null && (
                <p className="tabular-nums">
                  필요 페이스 <strong>{Math.floor(view.neededSecPerQ)}초/문항</strong>
                  <span className="text-sm text-slate-600 dark:text-slate-400"> (검토 시간 제외)</span>
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isSelf && (
              <button type="button" onClick={doToggle} className="rounded-lg border border-slate-400 px-4 py-2 dark:border-slate-600">
                {paused ? '재개 (Space)' : '일시정지 (Space)'}
              </button>
            )}
            <button type="button" onClick={() => apply((s, n) => finishSection(plan, s, n))} className="rounded-lg border border-slate-400 px-4 py-2 dark:border-slate-600">
              {view.section.name} 끝내기
            </button>
          </div>
        </>
      )}

      {st.status !== 'done' && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          {!confirmEnd ? (
            <button type="button" onClick={() => setConfirmEnd(true)} className="text-sm text-red-800 underline dark:text-red-300">
              시험 종료
            </button>
          ) : (
            <>
              <span className="text-sm">지금 시험을 끝낼까요?</span>
              <button
                type="button"
                onClick={() => (st.status === 'ready' ? onAbort() : apply((s, n) => finishAll(plan, s, n)))}
                className="rounded bg-red-700 px-3 py-1 text-sm font-semibold text-white"
              >
                종료 확인
              </button>
              <button type="button" onClick={() => setConfirmEnd(false)} className="rounded border border-slate-400 px-3 py-1 text-sm dark:border-slate-600">
                취소
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PartTimeline({ plan, st, elapsed }: { plan: Plan; st: RunState; elapsed: number }) {
  const s = plan.sections[st.idx]
  const total = durationMs(s)
  const ends = cumEnds(s)
  return (
    <div aria-hidden="true">
      <div className="relative flex h-10 overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
        {s.parts.map((p, i) => {
          const done = s.mode === 'self' ? i < st.marks.length : elapsed >= ends[i]
          return (
            <div
              key={p.id}
              style={{ width: `${((p.minutes * 60_000) / total) * 100}%` }}
              className={`flex items-center justify-center truncate border-r border-slate-300 px-1 text-xs last:border-r-0 dark:border-slate-700 ${
                done ? 'bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300' : 'bg-white dark:bg-slate-900'
              }`}
            >
              {p.name}
            </div>
          )
        })}
        <div className="absolute inset-y-0 w-0.5 bg-red-600" style={{ left: `${Math.min(100, (elapsed / total) * 100)}%` }} />
      </div>
    </div>
  )
}
