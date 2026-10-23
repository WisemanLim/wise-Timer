import { useEffect, useState } from 'react'

interface Props {
  value: number
  onCommit: (minutes: number) => void
  label: string
  invalid?: boolean
}

/** 분 입력 (0.5 단위). 입력 중 빈 값·잘못된 값은 로컬로만 유지하고 유효할 때만 반영 */
export default function MinutesField({ value, onCommit, label, invalid }: Props) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        inputMode="decimal"
        min={0.5}
        step={0.5}
        value={text}
        aria-label={label}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(n) && n > 0) onCommit(n)
        }}
        onBlur={() => setText(String(value))}
        className={`w-20 rounded border px-2 py-1 text-right tabular-nums dark:bg-slate-800 ${
          invalid ? 'border-red-600 dark:border-red-400' : 'border-slate-400 dark:border-slate-600'
        }`}
      />
      <span className="text-sm">분</span>
    </span>
  )
}
