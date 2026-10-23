import { useCallback, useState } from 'react'
import type { Exam } from './domain/types'
import { BUILTIN_PRESETS } from './domain/presets'
import { initRun, makePlan, type Plan, type RunState } from './domain/engine'
import { KEYS, load, save } from './storage'
import ExamPicker from './components/ExamPicker'
import AllocationEditor from './components/AllocationEditor'
import TimerView from './components/TimerView'
import { CustomMenu, ImportButton, SaveControls } from './components/PresetControls'
import ResultView from './components/ResultView'
import HistoryView from './components/HistoryView'
import { buildSession, type Session } from './domain/session'
import { addCustom, downloadJson, importCustom, loadCustom, removeCustom, replaceCustom, saveCustomList } from './domain/customPresets'

interface SavedRun {
  exam: Exam
  sectionIds: string[]
  state: RunState
  setupMs: number | null
}

type Screen =
  | { name: 'pick' }
  | { name: 'edit'; exam: Exam; isCustom: boolean; pickedAt: number }
  | { name: 'run'; plan: Plan; initial: RunState; key: number; setupMs: number | null }
  | { name: 'done'; session: Session }
  | { name: 'history' }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'pick' })
  const [custom, setCustomState] = useState<Exam[]>(loadCustom)
  const setCustom = (list: Exam[]) => {
    setCustomState(list)
    saveCustomList(list)
  }
  const [saved, setSaved] = useState<SavedRun | null>(() => {
    const r = load<SavedRun | null>(KEYS.run, null)
    return r && r.state.status !== 'done' && r.state.status !== 'ready' ? r : null
  })

  const startRun = (exam: Exam, sectionIds: string[], state: RunState, setupMs: number | null) => {
    save(KEYS.run, { exam, sectionIds, state, setupMs })
    setSaved(null)
    setScreen({ name: 'run', plan: makePlan(exam, sectionIds), initial: state, key: Date.now(), setupMs })
  }

  const run = screen.name === 'run' ? screen : null
  const onChange = useCallback(
    (state: RunState) => run && save(KEYS.run, { exam: run.plan.exam, sectionIds: run.plan.sections.map((s) => s.id), state, setupMs: run.setupMs }),
    [run],
  )
  const onDone = useCallback(
    (state: RunState) => {
      save(KEYS.run, null)
      if (run) setScreen({ name: 'done', session: buildSession(run.plan, state, run.setupMs) })
    },
    [run],
  )
  const onAbort = useCallback(() => {
    save(KEYS.run, null)
    setScreen({ name: 'pick' })
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">
            {screen.name === 'run' ? 'wise-Timer' : <button type="button" onClick={() => setScreen({ name: 'pick' })}>wise-Timer</button>}
          </h1>
          {screen.name === 'run' ? (
            <span className="text-sm text-slate-600 dark:text-slate-400">시험 시간 배분 타이머</span>
          ) : (
            <button type="button" onClick={() => setScreen({ name: 'history' })} className="text-sm text-blue-800 underline dark:text-blue-300">
              기록
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {screen.name === 'pick' && (
          <>
            {saved && (
              <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
                <span className="grow">진행 중인 시험이 있습니다: <strong>{saved.exam.name}</strong></span>
                <button type="button" onClick={() => startRun(saved.exam, saved.sectionIds, saved.state, saved.setupMs ?? null)} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">
                  이어하기
                </button>
                <button type="button" onClick={() => { save(KEYS.run, null); setSaved(null) }} className="rounded-lg border border-slate-400 px-4 py-2 dark:border-slate-600">
                  버리기
                </button>
              </div>
            )}
            <ExamPicker
              builtins={BUILTIN_PRESETS}
              custom={custom}
              onPick={(exam, isCustom) => setScreen({ name: 'edit', exam, isCustom, pickedAt: Date.now() })}
              customActions={
                <ImportButton
                  onImport={(text) => {
                    const r = importCustom(custom, text)
                    if (r.added) setCustom(r.list)
                    return r.errors
                  }}
                />
              }
              renderCustomMenu={(exam) => (
                <CustomMenu exam={exam} onExport={() => downloadJson(exam)} onDelete={() => setCustom(removeCustom(custom, exam.id))} />
              )}
            />
          </>
        )}
        {screen.name === 'edit' && (
          <AllocationEditor
            key={screen.exam.id}
            exam={screen.exam}
            onBack={() => setScreen({ name: 'pick' })}
            onStart={(exam, sectionIds) => startRun(exam, sectionIds, initRun(), Date.now() - screen.pickedAt)}
            extraActions={(draft) => (
              <SaveControls
                draft={draft}
                isCustom={screen.isCustom}
                onSaveNew={(d, name) => setCustom(addCustom(custom, d, name))}
                onOverwrite={(d) => setCustom(replaceCustom(custom, d))}
              />
            )}
          />
        )}
        {screen.name === 'run' && (
          <TimerView key={screen.key} plan={screen.plan} initial={screen.initial} onChange={onChange} onDone={onDone} onAbort={onAbort} />
        )}
        {screen.name === 'done' && (
          <ResultView session={screen.session} onHome={() => setScreen({ name: 'pick' })} onHistory={() => setScreen({ name: 'history' })} />
        )}
        {screen.name === 'history' && <HistoryView onBack={() => setScreen({ name: 'pick' })} />}
      </main>
    </div>
  )
}
