import { useState } from 'react'
import { fmtDuration as fmtClock } from '../domain/format'
import { loadSessions, previousOf, saveSession, suggestedUnanswered, type Session } from '../domain/session'

const signed = (ms: number) => (Math.round(ms / 1000) > 0 ? `+${fmtClock(ms)}` : Math.round(ms / 1000) < 0 ? fmtClock(ms) : '±0:00')
const tone = (ms: number | null) => {
  const sec = ms === null ? 0 : Math.round(ms / 1000)
  return ms === null || sec === 0 ? '' : sec > 0 ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-green-800 dark:text-green-400'
}

/** 세션 결과 표 (종료 직후·기록 상세 공용) */
export function SessionTables({ session }: { session: Session }) {
  return (
    <div className="space-y-4">
      {session.sections.map((s) => (
        <section key={s.sectionId} className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="font-semibold">
            {s.name} — 실제 {fmtClock(s.actualMs)} / 계획 {fmtClock(s.plannedMs)}
            {s.endedEarly && <span className="ml-2 text-sm font-normal">(조기 종료)</span>}
          </h3>
          {s.mode === 'forced' ? (
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">강제 진행 섹션 — 파트별 기록 없음</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <caption className="sr-only">{s.name} 파트별 계획 대비 실제</caption>
              <thead>
                <tr className="text-left text-slate-600 dark:text-slate-400">
                  <th className="py-1 font-medium">파트</th>
                  <th className="text-right font-medium">계획</th>
                  <th className="text-right font-medium">실제</th>
                  <th className="text-right font-medium">차이</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {s.parts.map((p) => (
                  <tr key={p.partId} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-1">{p.name}</td>
                    <td className="text-right">{fmtClock(p.plannedMs)}</td>
                    <td className="text-right">
                      {p.actualMs === null ? '시작 못 함' : fmtClock(p.actualMs)}
                      {p.status === 'cut' && !p.review && <span className="text-xs text-slate-600 dark:text-slate-400"> (시간 종료)</span>}
                    </td>
                    <td className={`text-right ${p.review ? '' : tone(p.overMs)}`}>{p.overMs === null ? '—' : signed(p.overMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {s.reviewStart && (
            <p className="mt-2 text-sm">
              검토 시작: 계획 {fmtClock(s.reviewStart.plannedMs)} · 실제{' '}
              {s.reviewStart.actualMs === null ? (
                <strong className="text-red-700 dark:text-red-400">진입 못 함</strong>
              ) : (
                <>
                  {fmtClock(s.reviewStart.actualMs)}{' '}
                  <span className={tone(s.reviewStart.actualMs - s.reviewStart.plannedMs)}>
                    ({signed(s.reviewStart.actualMs - s.reviewStart.plannedMs)})
                  </span>
                </>
              )}
            </p>
          )}
          {s.mode === 'self' && s.answered > 0 && (
            <p className="text-sm">문항 카운터: {s.answered} / {s.questions}</p>
          )}
        </section>
      ))}
    </div>
  )
}

export default function ResultView({ session, onHome, onHistory }: { session: Session; onHome: () => void; onHistory: () => void }) {
  const [unanswered, setUnanswered] = useState(() => {
    const v = suggestedUnanswered(session)
    return v === null ? '' : String(v)
  })
  const [saved, setSaved] = useState(false)
  const prev = previousOf(loadSessions(), session)

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">{session.examName} — 결과</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="계획 초과 합계" value={fmtClock(session.totalOverMs)} sub={prev ? `지난 회차 ${fmtClock(prev.totalOverMs)}` : undefined} />
        <Stat label="설정 소요 (선택→시작)" value={session.setupMs === null ? '—' : fmtClock(session.setupMs)} sub="목표 1:00 이내" />
        <Stat label="미완료 문항" value={unanswered === '' ? '—' : unanswered} sub={prev?.unanswered != null ? `지난 회차 ${prev.unanswered}` : '목표 0'} />
      </div>

      <SessionTables session={session} />

      <form
        className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault()
          saveSession({ ...session, unanswered: unanswered === '' ? null : Number(unanswered) })
          setSaved(true)
        }}
      >
        <label className="flex flex-col text-sm">
          미완료 문항 수
          <input
            type="number"
            min={0}
            step={1}
            value={unanswered}
            onChange={(e) => setUnanswered(e.target.value)}
            className="mt-1 w-28 rounded border border-slate-400 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <button type="submit" disabled={saved} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400 dark:disabled:bg-slate-600">
          {saved ? '기록 저장됨' : '기록 저장'}
        </button>
        <button type="button" onClick={onHistory} className="rounded-lg border border-slate-400 px-4 py-2 dark:border-slate-600">
          기록 보기
        </button>
        <button type="button" onClick={onHome} className="rounded-lg border border-slate-400 px-4 py-2 dark:border-slate-600">
          처음으로
        </button>
      </form>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm text-slate-700 dark:text-slate-300">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-600 dark:text-slate-400">{sub}</p>}
    </div>
  )
}
