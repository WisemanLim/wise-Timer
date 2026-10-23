import { useMemo, useState } from 'react'
import type { Exam } from '../domain/types'
import { fmtMinutes } from '../domain/format'
import { applyLink, checkAllocation, constraintKey, setPartMinutes, setSectionMinutes } from '../domain/allocation'
import MinutesField from './MinutesField'

interface Props {
  exam: Exam
  onBack: () => void
  onStart: (exam: Exam, sectionIds: string[]) => void
  /** 내 프리셋 저장 (E4) */
  extraActions?: (draft: Exam) => React.ReactNode
}

export default function AllocationEditor({ exam, onBack, onStart, extraActions }: Props) {
  const [draft, setDraft] = useState<Exam>(exam)
  const [linked, setLinked] = useState<string[]>([])
  const [included, setIncluded] = useState<string[]>(exam.sections.map((s) => s.id))

  const issues = useMemo(() => checkAllocation(draft, included), [draft, included])
  const errors = issues.filter((i) => i.level === 'error')
  const badParts = new Set(errors.flatMap((i) => i.partIds))
  const changed = JSON.stringify(draft) !== JSON.stringify(exam)
  const total = draft.sections.filter((s) => included.includes(s.id)).reduce((t, s) => t + s.minutes, 0)

  const toggleLink = (sectionId: string, index: number, on: boolean) => {
    const key = constraintKey(sectionId, index)
    setLinked((l) => (on ? [...l, key] : l.filter((k) => k !== key)))
    if (on) setDraft((d) => applyLink(d, sectionId, index))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{draft.name} — 시간 배분</h2>
        <button type="button" onClick={onBack} className="text-sm text-blue-800 underline dark:text-blue-300">
          시험 다시 선택
        </button>
      </div>

      {draft.sections.map((s) => {
        const on = included.includes(s.id)
        const partSum = s.parts.reduce((t, p) => t + p.minutes, 0)
        return (
          <section
            key={s.id}
            aria-labelledby={`sec-${s.id}`}
            className={`rounded-xl border bg-white p-4 dark:bg-slate-900 ${on ? 'border-slate-300 dark:border-slate-700' : 'border-dashed border-slate-300 opacity-60 dark:border-slate-700'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`${s.name} 포함`}
                  checked={on}
                  disabled={on && included.length === 1}
                  onChange={(e) => setIncluded((xs) => (e.target.checked ? draft.sections.map((x) => x.id).filter((id) => id === s.id || xs.includes(id)) : xs.filter((id) => id !== s.id)))}
                />
                <h3 id={`sec-${s.id}`} className="font-semibold">{s.name}</h3>
                {s.mode === 'forced' && <span className="rounded bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">강제 진행</span>}
                {s.start === 'manual' && <span className="rounded bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">수동 시작</span>}
              </div>
              <MinutesField label={`${s.name} 섹션 시간`} value={s.minutes} onCommit={(m) => setDraft((d) => setSectionMinutes(d, s.id, m))} />
            </div>
            {s.note && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.note}</p>}

            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600 dark:text-slate-400">
                  <th className="py-1 font-medium">파트</th>
                  <th className="font-medium">문항</th>
                  <th className="font-medium">페이스</th>
                  <th className="text-right font-medium">{s.mode === 'forced' ? '예상 시간' : '시간'}</th>
                </tr>
              </thead>
              <tbody>
                {s.parts.map((p) => (
                  <tr key={p.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-1.5">
                      {p.name}
                      {p.desc && <span className="text-slate-600 dark:text-slate-400"> · {p.desc}</span>}
                    </td>
                    <td className="tabular-nums">{p.questions ? `${p.questions}${p.range ? ` (${p.range[0]}~${p.range[1]})` : ''}` : '—'}</td>
                    <td className="tabular-nums">{p.questions ? `${Math.round((p.minutes * 60) / p.questions)}초/문항` : ''}</td>
                    <td className="text-right">
                      <MinutesField
                        label={`${s.name} ${p.name} 시간`}
                        value={p.minutes}
                        invalid={badParts.has(p.id) && on}
                        onCommit={(m) => setDraft((d) => setPartMinutes(d, s.id, p.id, m, linked))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-300 font-medium dark:border-slate-700">
                  <td className="py-1.5">합계</td>
                  <td />
                  <td />
                  <td className="pr-8 text-right tabular-nums">{fmtMinutes(partSum)} / {fmtMinutes(s.minutes)}</td>
                </tr>
              </tfoot>
            </table>

            {(s.constraints ?? []).map((c, i) =>
              c.type === 'sumMax' && c.linkable && c.parts.length === 2 ? (
                <label key={i} className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={linked.includes(constraintKey(s.id, i))} onChange={(e) => toggleLink(s.id, i, e.target.checked)} />
                  연동: {c.label.split(' (')[0]} — 한쪽을 바꾸면 나머지가 합계 {c.minutes}분을 유지
                </label>
              ) : null,
            )}
          </section>
        )
      })}

      <div role="status" aria-live="polite" className="space-y-1">
        {issues.map((i, k) => (
          <p
            key={k}
            className={`rounded px-3 py-2 text-sm ${i.level === 'error' ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}
          >
            {i.level === 'error' ? '오류: ' : '주의: '}
            {i.message}
          </p>
        ))}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50/95 py-3 dark:border-slate-800 dark:bg-slate-950/95">
        <button
          type="button"
          disabled={errors.length > 0}
          onClick={() => onStart(draft, included)}
          className="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-600"
        >
          시작 ({fmtMinutes(total)})
        </button>
        {changed && (
          <button type="button" onClick={() => { setDraft(exam); setLinked([]) }} className="rounded-lg border border-slate-400 px-4 py-2 dark:border-slate-600">
            기본값으로 되돌리기
          </button>
        )}
        {extraActions?.(draft)}
        {errors.length > 0 && <span className="text-sm text-red-800 dark:text-red-300">오류를 해결해야 시작할 수 있습니다</span>}
      </div>
    </div>
  )
}
