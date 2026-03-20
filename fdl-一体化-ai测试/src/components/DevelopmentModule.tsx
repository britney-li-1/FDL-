import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Table2 } from 'lucide-react'
import { cn } from '../lib/utils'

export type DevelopmentAiPayload = {
  taskName?: string
  engine?: string
  schedule?: string
  code?: string
  /** AI 推衍的源表结构 */
  sourceSchema?: { table: string; columns: { name: string; type: string }[] }
  /** AI 推衍的产出表结构 */
  outputSchema?: { table: string; columns: { name: string; type: string }[] }
}

export type DevelopmentModuleProps = {
  /** 外部 Omni / Agent 注入的提案；变化时合并进 aiProposalState 并触发闪烁 */
  aiPayload?: DevelopmentAiPayload | null
  /** 消费完 payload 后通知父级清空，避免重复合并 */
  onAiPayloadConsumed?: () => void
}

type RealState = {
  taskName: string
  engine: string
  schedule: string
  code: string
}

type AiProposalState = {
  taskName?: string
  engine?: string
  schedule?: string
  code?: string
  sourceSchema?: DevelopmentAiPayload['sourceSchema']
  outputSchema?: DevelopmentAiPayload['outputSchema']
}

const ENGINES = ['Spark', 'Presto', 'Hive', 'Trino', 'Flink SQL'] as const
const SCHEDULES = ['Daily', 'Hourly', 'Weekly', 'Manual', 'Cron'] as const

export function DevelopmentModule({
  aiPayload,
  onAiPayloadConsumed,
}: DevelopmentModuleProps) {
  const [realState, setRealState] = useState<RealState>({
    taskName: 'ods_log_clean',
    engine: 'Spark',
    schedule: 'Daily',
    code: 'SELECT * FROM raw_logs;',
  })

  const [aiProposalState, setAiProposalState] = useState<AiProposalState | null>(null)

  /** 需要播放 ai-filled-flash 的字段 key */
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set())
  const [schemaOpen, setSchemaOpen] = useState(true)

  const initialSource: NonNullable<DevelopmentAiPayload['sourceSchema']> = {
    table: 'raw_logs',
    columns: [
      { name: 'event_time', type: 'TIMESTAMP' },
      { name: 'user_id', type: 'STRING' },
      { name: 'payload', type: 'STRING' },
    ],
  }
  const initialOutput: NonNullable<DevelopmentAiPayload['outputSchema']> = {
    table: 'ods_log_clean',
    columns: [
      { name: 'event_time', type: 'TIMESTAMP' },
      { name: 'user_id', type: 'STRING' },
    ],
  }
  /** 已提交到工作区的 Schema（Reject 时恢复） */
  const [committedSourceSchema, setCommittedSourceSchema] = useState(initialSource)
  const [committedOutputSchema, setCommittedOutputSchema] = useState(initialOutput)
  const [sourceSchema, setSourceSchema] = useState(initialSource)
  const [outputSchema, setOutputSchema] = useState(initialOutput)

  const prevPayloadRef = useRef<string | null>(null)
  const realStateRef = useRef(realState)
  realStateRef.current = realState

  useEffect(() => {
    if (aiPayload == null) prevPayloadRef.current = null
  }, [aiPayload])

  const triggerFlash = useCallback((keys: string[]) => {
    setFlashKeys((prev) => new Set([...prev, ...keys]))
    window.setTimeout(() => {
      setFlashKeys((prev) => {
        const next = new Set(prev)
        keys.forEach((k) => next.delete(k))
        return next
      })
    }, 1900)
  }, [])

  /** 接收外部 aiPayload：合并到提案态 + 闪烁被改字段 */
  useEffect(() => {
    if (!aiPayload || Object.keys(aiPayload).length === 0) return

    const sig = JSON.stringify(aiPayload)
    if (prevPayloadRef.current === sig) return
    prevPayloadRef.current = sig

    setAiProposalState((prev) => ({ ...prev, ...aiPayload }))

    const r = realStateRef.current
    const flash: string[] = []
    if (aiPayload.taskName != null && aiPayload.taskName !== r.taskName) flash.push('taskName')
    if (aiPayload.engine != null && aiPayload.engine !== r.engine) flash.push('engine')
    if (aiPayload.schedule != null && aiPayload.schedule !== r.schedule) flash.push('schedule')
    if (aiPayload.code != null && aiPayload.code !== r.code) flash.push('code')
    if (flash.length) triggerFlash(flash)

    if (aiPayload.sourceSchema) {
      setSourceSchema(aiPayload.sourceSchema)
      triggerFlash(['schema-source'])
    }
    if (aiPayload.outputSchema) {
      setOutputSchema(aiPayload.outputSchema)
      triggerFlash(['schema-output'])
    }

    onAiPayloadConsumed?.()
  }, [aiPayload, onAiPayloadConsumed, triggerFlash])

  const isDiffMode = aiProposalState !== null

  const proposedCode = useMemo(() => {
    if (!aiProposalState) return realState.code
    return aiProposalState.code ?? realState.code
  }, [aiProposalState, realState.code])

  const acceptProposal = () => {
    if (!aiProposalState) return
    setRealState((prev) => ({
      taskName: aiProposalState.taskName ?? prev.taskName,
      engine: aiProposalState.engine ?? prev.engine,
      schedule: aiProposalState.schedule ?? prev.schedule,
      code: aiProposalState.code ?? prev.code,
    }))
    if (aiProposalState.sourceSchema) {
      setSourceSchema(aiProposalState.sourceSchema)
      setCommittedSourceSchema(aiProposalState.sourceSchema)
    }
    if (aiProposalState.outputSchema) {
      setOutputSchema(aiProposalState.outputSchema)
      setCommittedOutputSchema(aiProposalState.outputSchema)
    }
    setAiProposalState(null)
    prevPayloadRef.current = null
  }

  const rejectProposal = () => {
    setSourceSchema(committedSourceSchema)
    setOutputSchema(committedOutputSchema)
    setAiProposalState(null)
    prevPayloadRef.current = null
  }

  const inputClass = (key: string) =>
    cn(
      'h-9 w-full rounded-lg border border-white/15 bg-slate-900/80 px-2.5 text-xs text-slate-200 outline-none transition focus:border-cyan-400/50',
      flashKeys.has(key) && 'ai-filled-flash',
    )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 text-slate-100">
      {/* A. 顶部任务配置 */}
      <section className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-cyan-200/90">
          Task Configuration
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">任务名称</span>
            <input
              type="text"
              value={realState.taskName}
              onChange={(e) => setRealState((s) => ({ ...s, taskName: e.target.value }))}
              className={inputClass('taskName')}
            />
            {isDiffMode && aiProposalState?.taskName != null && aiProposalState.taskName !== realState.taskName && (
              <p className="text-[10px] text-emerald-400/80">AI: {aiProposalState.taskName}</p>
            )}
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">计算引擎</span>
            <select
              value={realState.engine}
              onChange={(e) => setRealState((s) => ({ ...s, engine: e.target.value }))}
              className={inputClass('engine')}
            >
              {ENGINES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            {isDiffMode && aiProposalState?.engine != null && aiProposalState.engine !== realState.engine && (
              <p className="text-[10px] text-emerald-400/80">AI: {aiProposalState.engine}</p>
            )}
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">调度周期</span>
            <select
              value={realState.schedule}
              onChange={(e) => setRealState((s) => ({ ...s, schedule: e.target.value }))}
              className={inputClass('schedule')}
            >
              {SCHEDULES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {isDiffMode && aiProposalState?.schedule != null && aiProposalState.schedule !== realState.schedule && (
              <p className="text-[10px] text-emerald-400/80">AI: {aiProposalState.schedule}</p>
            )}
          </label>
        </div>
      </section>

      {/* B + C：代码区 + Schema 侧栏 */}
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-black/25">
          {isDiffMode && (
            <div className="absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-slate-950/95 px-2 py-1.5 shadow-xl backdrop-blur">
              <button
                type="button"
                onClick={acceptProposal}
                className="rounded-lg bg-emerald-500/90 px-3 py-1 text-xs font-medium text-slate-950 transition hover:bg-emerald-400"
              >
                Accept (应用替换)
              </button>
              <button
                type="button"
                onClick={rejectProposal}
                className="rounded-lg border border-rose-400/50 bg-rose-500/20 px-3 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-500/30"
              >
                Reject (丢弃建议)
              </button>
            </div>
          )}

          {!isDiffMode ? (
            <div className="flex min-h-0 flex-1 flex-col p-3 pt-10">
              <textarea
                value={realState.code}
                onChange={(e) => setRealState((s) => ({ ...s, code: e.target.value }))}
                spellCheck={false}
                className={cn(
                  'min-h-[320px] flex-1 resize-none rounded-xl border border-violet-400/25 bg-slate-950/90 p-3 font-mono text-[13px] leading-relaxed text-violet-100/95 outline-none focus:border-violet-400/50',
                  flashKeys.has('code') && 'ai-filled-flash',
                )}
              />
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-0 pt-12">
              <div className="flex min-h-0 flex-col border-r border-white/10">
                <div className="shrink-0 border-b border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-500">
                  realState (当前)
                </div>
                <textarea
                  readOnly
                  value={realState.code}
                  spellCheck={false}
                  className="min-h-[280px] flex-1 resize-none border-0 bg-slate-950/80 p-3 font-mono text-[13px] text-slate-400 outline-none"
                />
              </div>
              <div className="flex min-h-0 flex-col">
                <div className="shrink-0 border-b border-white/10 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-300/90">
                  aiProposalState (建议)
                </div>
                <textarea
                  readOnly
                  value={proposedCode}
                  spellCheck={false}
                  className={cn(
                    'min-h-[280px] flex-1 resize-none border-0 bg-slate-950/90 p-3 font-mono text-[13px] text-emerald-100/90 outline-none',
                    flashKeys.has('code') && 'ai-filled-flash',
                  )}
                />
              </div>
            </div>
          )}
        </div>

        {/* C. Schema 参考侧栏 */}
        <aside
          className={cn(
            'flex shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-[width]',
            schemaOpen ? 'w-52' : 'w-9',
          )}
        >
          <button
            type="button"
            onClick={() => setSchemaOpen((o) => !o)}
            className="flex items-center justify-between border-b border-white/10 px-2 py-2 text-left hover:bg-white/5"
            title={schemaOpen ? '收起' : '展开 Schema'}
          >
            {schemaOpen ? (
              <>
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <Table2 className="h-3.5 w-3.5" />
                  Schema
                </span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </>
            ) : (
              <ChevronLeft className="mx-auto h-4 w-4 text-slate-500" />
            )}
          </button>
          {schemaOpen && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2 text-[11px]">
              <div
                className={cn(
                  'rounded-lg border border-white/10 bg-black/20 p-2',
                  flashKeys.has('schema-source') && 'ai-filled-flash',
                )}
              >
                <p className="mb-1.5 font-medium text-cyan-200/80">源表</p>
                <p className="mb-1 truncate text-slate-500">{sourceSchema.table}</p>
                <ul className="space-y-0.5 text-slate-400">
                  {sourceSchema.columns.map((c) => (
                    <li key={c.name} className="flex justify-between gap-1">
                      <span className="truncate text-slate-300">{c.name}</span>
                      <span className="shrink-0 text-slate-600">{c.type}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className={cn(
                  'rounded-lg border border-white/10 bg-black/20 p-2',
                  flashKeys.has('schema-output') && 'ai-filled-flash',
                )}
              >
                <p className="mb-1.5 font-medium text-violet-200/80">产出表</p>
                <p className="mb-1 truncate text-slate-500">{outputSchema.table}</p>
                <ul className="space-y-0.5 text-slate-400">
                  {outputSchema.columns.map((c) => (
                    <li key={c.name} className="flex justify-between gap-1">
                      <span className="truncate text-slate-300">{c.name}</span>
                      <span className="shrink-0 text-slate-600">{c.type}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export default DevelopmentModule
