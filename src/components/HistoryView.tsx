import { useState } from 'react'
import { fmtDuration as fmtClock } from '../domain/format'
import { deleteSession, loadSessions, previousOf, type Session } from '../domain/session'
import { SessionTables } from './ResultView'

export default function HistoryView({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<Session[]>(loadSessions)
  const [open, setOpen] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">기록</h2>
        <button type="button" onClick={onBack} className="text-sm text-blue-800 underline dark:text-blue-300">
          처음으로
        </button>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">기록은 이 브라우저에만 저장됩니다 (서버 전송 없음).</p>
      {list.length === 0 ? (
        <p>저장된 기록이 없습니다.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600 dark:text-slate-400">
              <th className="py-1 font-medium">일시</th>
              <th className="font-medium">시험</th>
              <th className="text-right font-medium">계획 초과</th>
              <th className="text-right font-medium">지난 회차 대비</th>
              <th className="text-right font-medium">미완료</th>
              <th />
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {list.map((s) => {
              const prev = previousOf(list, s)
              const diff = prev ? s.totalOverMs - prev.totalOverMs : null
              return (
                <tr key={s.id} className="border-t border-slate-200 align-top dark:border-slate-800">
                  <td className="py-1.5">{new Date(s.startedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>
                    <button type="button" className="text-left text-blue-800 underline dark:text-blue-300" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                      {s.examName}
                    </button>
                    {open === s.id && <div className="mt-2"><SessionTables session={s} /></div>}
                  </td>
                  <td className="text-right">{fmtClock(s.totalOverMs)}</td>
                  <td className={`text-right ${diff === null ? '' : diff > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-800 dark:text-green-400'}`}>
                    {diff === null ? '—' : `${diff > 0 ? '+' : ''}${fmtClock(diff)}`}
                  </td>
                  <td className="text-right">{s.unanswered ?? '—'}</td>
                  <td className="pl-2 text-right">
                    {confirm === s.id ? (
                      <button type="button" className="rounded bg-red-700 px-2 py-0.5 text-white" onClick={() => { setList(deleteSession(s.id)); setConfirm(null) }}>
                        삭제 확인
                      </button>
                    ) : (
                      <button type="button" className="text-red-800 underline dark:text-red-300" aria-label={`${s.examName} 기록 삭제`} onClick={() => setConfirm(s.id)}>
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
