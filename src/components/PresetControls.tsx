import { useRef, useState } from 'react'
import type { Exam } from '../domain/types'

const btn = 'rounded-lg border border-slate-400 px-3 py-1.5 text-sm dark:border-slate-600'

/** 편집 화면: 내 프리셋으로 저장 / (사용자 프리셋이면) 변경 사항 저장 */
export function SaveControls({ draft, isCustom, onSaveNew, onOverwrite }: {
  draft: Exam
  isCustom: boolean
  onSaveNew: (draft: Exam, name: string) => void
  onOverwrite: (draft: Exam) => void
}) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState(isCustom ? draft.name : `${draft.name} (내 배분)`)
  const [msg, setMsg] = useState('')
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {isCustom && (
        <button type="button" className={btn} onClick={() => { onOverwrite(draft); setMsg('저장했습니다') }}>
          변경 사항 저장
        </button>
      )}
      {!naming ? (
        <button type="button" className={btn} onClick={() => setNaming(true)}>
          내 프리셋으로 저장
        </button>
      ) : (
        <form
          className="inline-flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            onSaveNew(draft, name)
            setNaming(false)
            setMsg(`"${name}" 저장했습니다`)
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="프리셋 이름" required className="w-56 rounded border border-slate-400 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800" />
          <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white dark:bg-slate-200 dark:text-slate-900">저장</button>
          <button type="button" className={btn} onClick={() => setNaming(false)}>취소</button>
        </form>
      )}
      <span role="status" className="text-sm text-green-800 dark:text-green-300">{msg}</span>
    </span>
  )
}

/** 선택 화면: JSON 가져오기 */
export function ImportButton({ onImport }: { onImport: (text: string) => string[] }) {
  const ref = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<string[]>([])
  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" className={btn} onClick={() => ref.current?.click()}>
        JSON 가져오기
      </button>
      <input
        ref={ref}
        type="file"
        accept="application/json,.json"
        aria-label="프리셋 JSON 파일"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) setErrors(onImport(await f.text()))
        }}
      />
      {errors.length > 0 && (
        <span role="alert" className="mt-1 max-w-md text-right text-sm text-red-800 dark:text-red-300">
          가져오기 실패: {errors.slice(0, 3).join(' / ')}
          {errors.length > 3 && ` 외 ${errors.length - 3}건`}
        </span>
      )}
    </span>
  )
}

/** 사용자 프리셋 카드 메뉴: 내보내기 / 삭제(2단계 확인) */
export function CustomMenu({ exam, onExport, onDelete }: { exam: Exam; onExport: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <button type="button" className={btn} onClick={onExport} aria-label={`${exam.name} JSON 내보내기`}>
        JSON 내보내기
      </button>
      {!confirm ? (
        <button type="button" className={btn} onClick={() => setConfirm(true)} aria-label={`${exam.name} 삭제`}>
          삭제
        </button>
      ) : (
        <button type="button" className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white" onClick={onDelete}>
          삭제 확인
        </button>
      )}
    </>
  )
}
