import type { Exam } from '../domain/types'
import { examMinutes, examQuestions } from '../domain/presets'
import { fmtMinutes } from '../domain/format'

interface Props {
  builtins: Exam[]
  custom: Exam[]
  onPick: (exam: Exam, isCustom: boolean) => void
  /** 사용자 프리셋 관리 (E4) — 없으면 섹션 숨김 */
  customActions?: React.ReactNode
  renderCustomMenu?: (exam: Exam) => React.ReactNode
}

export default function ExamPicker({ builtins, custom, onPick, customActions, renderCustomMenu }: Props) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="builtin-h">
        <h2 id="builtin-h" className="text-lg font-semibold">시험 선택</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">시험을 고르면 파트별 시간 배분 기본값이 채워집니다.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {builtins.map((e) => (
            <li key={e.id}>
              <ExamCard exam={e} onPick={() => onPick(e, false)} />
            </li>
          ))}
        </ul>
      </section>

      {customActions !== undefined && (
        <section aria-labelledby="custom-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="custom-h" className="text-lg font-semibold">내 프리셋</h2>
            <div className="flex gap-2">{customActions}</div>
          </div>
          {custom.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              저장된 프리셋이 없습니다. 배분을 수정한 뒤 "내 프리셋으로 저장"을 누르세요.
            </p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {custom.map((e) => (
                <li key={e.id}>
                  <ExamCard exam={e} onPick={() => onPick(e, true)} menu={renderCustomMenu?.(e)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function ExamCard({ exam, onPick, menu }: { exam: Exam; onPick: () => void; menu?: React.ReactNode }) {
  const assumed = exam.source?.status === 'assumed'
  return (
    <div className="h-full rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={onPick}
        className="w-full rounded text-left"
        aria-describedby={`${exam.id}-meta`}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="font-semibold text-blue-800 underline-offset-2 hover:underline dark:text-blue-300">{exam.name}</span>
          {exam.category && (
            <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {exam.category}
            </span>
          )}
        </span>
        <span id={`${exam.id}-meta`} className="mt-1 block text-sm text-slate-700 dark:text-slate-300">
          {fmtMinutes(examMinutes(exam))}
          {examQuestions(exam) > 0 && ` · ${examQuestions(exam)}문항`} · {exam.sections.map((s) => s.name).join(' → ')}
        </span>
        {exam.description && <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">{exam.description}</span>}
        {assumed && (
          <span className="mt-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
            시간 정보 확인 필요 (가정치)
          </span>
        )}
      </button>
      {menu && <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">{menu}</div>}
    </div>
  )
}
