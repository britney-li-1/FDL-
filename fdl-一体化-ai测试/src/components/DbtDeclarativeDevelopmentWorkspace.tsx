import { useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { cn } from '../lib/utils'
import type { DevelopmentAiPayload } from './DevelopmentModule'

export type MaterializationMode = 'table' | 'view' | 'incremental' | 'ephemeral'

type DbtRealState = {
  sql: string
  tableName: string
  database: string
  materialization: MaterializationMode
  schedule: string
}

type DbtAiProposal = Partial<DbtRealState>

type DbtDeclarativeDevelopmentWorkspaceProps = {
  editable: boolean
  aiPayload?: DevelopmentAiPayload | null
  onAiPayloadConsumed?: () => void
  initial: DbtRealState
  targetDatabaseOptions: string[]
  onRealStateChange?: (next: DbtRealState) => void
}

const MATERIALIZATION_OPTIONS: Array<{ id: MaterializationMode; label: string }> = [
  { id: 'table', label: 'table' },
  { id: 'view', label: 'view' },
  { id: 'incremental', label: 'Incremental（增量表）' },
  { id: 'ephemeral', label: 'ephemeral' },
]

function extractDatabaseFromQualifiedName(qualified: string | undefined): string {
  if (!qualified) return ''
  const parts = qualified.split('.').filter(Boolean)
  if (parts.length <= 1) return qualified
  return parts[0] ?? ''
}

function normalizeCron(input: string | undefined): string {
  return (input ?? '').trim() || 'Daily'
}

export default function DbtDeclarativeDevelopmentWorkspace({
  editable,
  aiPayload,
  onAiPayloadConsumed,
  initial,
  targetDatabaseOptions,
  onRealStateChange,
}: DbtDeclarativeDevelopmentWorkspaceProps) {
  const [realDevelopmentState, setRealDevelopmentState] = useState<DbtRealState>(initial)
  const [aiProposalState, setAiProposalState] = useState<DbtAiProposal | null>(null)
  const prevPayloadSigRef = useRef<string | null>(null)

  // 只在“切换到另一张表/另一组初始声明”时重置本地状态，避免父组件重渲染导致编辑器光标跳动
  useEffect(() => {
    setRealDevelopmentState(initial)
    setAiProposalState(null)
    prevPayloadSigRef.current = null
  }, [
    initial.tableName,
    initial.database,
    initial.materialization,
    initial.schedule,
    initial.sql,
  ])

  // AI payload -> aiProposalState (只对 realDevelopmentState 的字段做映射)
  useEffect(() => {
    if (!aiPayload || Object.keys(aiPayload).length === 0) {
      setAiProposalState(null)
      prevPayloadSigRef.current = null
      return
    }
    const sig = JSON.stringify(aiPayload)
    if (prevPayloadSigRef.current === sig) return
    prevPayloadSigRef.current = sig

    const next: DbtAiProposal = {
      tableName: aiPayload.taskName ?? undefined,
      schedule: normalizeCron(aiPayload.schedule),
      sql: aiPayload.code ?? undefined,
      // outputSchema.table 通常形如 db.schema 或 db.table，这里按 db 侧提取作为 dropdown 值
      database: extractDatabaseFromQualifiedName(aiPayload.outputSchema?.table),
      materialization: 'incremental',
    }

    setAiProposalState(next)
    onAiPayloadConsumed?.()
  }, [aiPayload, onAiPayloadConsumed])

  const proposedState = useMemo<DbtRealState>(() => {
    if (!aiProposalState) return realDevelopmentState
    return {
      ...realDevelopmentState,
      ...aiProposalState,
      // 避免空字符串把 dropdown/inputs 变成不可选态
      database: aiProposalState.database ?? realDevelopmentState.database,
      schedule: aiProposalState.schedule ?? realDevelopmentState.schedule,
      tableName: aiProposalState.tableName ?? realDevelopmentState.tableName,
      materialization: (aiProposalState.materialization ?? realDevelopmentState.materialization) as MaterializationMode,
      sql: aiProposalState.sql ?? realDevelopmentState.sql,
    }
  }, [aiProposalState, realDevelopmentState])

  const hasAiDiff = aiProposalState !== null

  // AI 推衍存在时：允许在全宽 Monaco 中切换查看 real / aiProposal SQL
  const [sqlViewMode, setSqlViewMode] = useState<'real' | 'ai'>('real')

  useEffect(() => {
    if (!hasAiDiff) setSqlViewMode('real')
  }, [hasAiDiff])

  // 把本组件受控状态同步给 Layout（从而左侧树能反映真实改动）
  useEffect(() => {
    if (!editable) return
    onRealStateChange?.(realDevelopmentState)
  }, [realDevelopmentState, editable, onRealStateChange])

  const acceptProposal = () => {
    if (!aiProposalState) return
    setRealDevelopmentState(proposedState)
    setAiProposalState(null)
    prevPayloadSigRef.current = null
  }

  const rejectProposal = () => {
    setAiProposalState(null)
    prevPayloadSigRef.current = null
  }

  const fieldRing = (key: keyof DbtRealState) =>
    hasAiDiff &&
    aiProposalState &&
    aiProposalState[key] != null &&
    aiProposalState[key] !== (realDevelopmentState as any)[key]
      ? 'border-emerald-300/40 ring-1 ring-emerald-500/20'
      : 'border-white/10'

  const inputBaseClass =
    'h-10 rounded-lg border bg-slate-950/80 px-3 text-xs text-slate-100 outline-none transition focus:border-cyan-400/40'

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* 上部：声明属性栏（~150-200px） */}
      <div className="min-h-[170px] rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-200">
                dbt-style Declarative IDE
              </span>
              {hasAiDiff && (
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">
                  AI Proposal
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">声明属性（受控）+ 下面全宽 SQL 画布</div>
          </div>

          {hasAiDiff && editable && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={acceptProposal}
                className="rounded-xl border border-emerald-300/40 bg-emerald-400/15 px-3 py-2 text-xs text-emerald-200 transition hover:bg-emerald-400/25"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={rejectProposal}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10"
              >
                Reject
              </button>
              <div className="ml-2 flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setSqlViewMode('real')}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] transition',
                    sqlViewMode === 'real'
                      ? 'bg-cyan-400/15 text-cyan-100'
                      : 'text-slate-300 hover:bg-white/10',
                  )}
                >
                  real
                </button>
                <button
                  type="button"
                  onClick={() => setSqlViewMode('ai')}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] transition',
                    sqlViewMode === 'ai'
                      ? 'bg-emerald-400/15 text-emerald-200'
                      : 'text-slate-300 hover:bg-white/10',
                  )}
                >
                  ai
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-[11px] text-slate-400">Table Name</div>
            <input
              value={realDevelopmentState.tableName}
              onChange={(e) => {
                if (!editable) return
                setRealDevelopmentState((s) => ({ ...s, tableName: e.target.value }))
              }}
              disabled={!editable}
              className={cn(inputBaseClass, fieldRing('tableName'))}
            />
            {hasAiDiff && aiProposalState?.tableName != null && aiProposalState.tableName !== realDevelopmentState.tableName && (
              <div className="mt-1 text-[10px] text-emerald-200">
                <span className="line-through text-slate-500">{realDevelopmentState.tableName}</span>
                <span className="ml-2">{aiProposalState.tableName}</span>
              </div>
            )}
          </label>

          <label className="block">
            <div className="mb-1 text-[11px] text-slate-400">Target Schema</div>
            <select
              value={realDevelopmentState.database}
              disabled={!editable}
              onChange={(e) => setRealDevelopmentState((s) => ({ ...s, database: e.target.value }))}
              className={cn(inputBaseClass, fieldRing('database'))}
            >
              {targetDatabaseOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {hasAiDiff && aiProposalState?.database != null && aiProposalState.database !== realDevelopmentState.database && (
              <div className="mt-1 text-[10px] text-emerald-200">
                <span className="line-through text-slate-500">{realDevelopmentState.database}</span>
                <span className="ml-2">{aiProposalState.database}</span>
              </div>
            )}
          </label>

          <label className="block">
            <div className="mb-1 text-[11px] text-slate-400">Materialization</div>
            <select
              value={realDevelopmentState.materialization}
              disabled={!editable}
              onChange={(e) =>
                setRealDevelopmentState((s) => ({
                  ...s,
                  materialization: e.target.value as MaterializationMode,
                }))
              }
              className={cn(inputBaseClass, fieldRing('materialization'))}
            >
              {MATERIALIZATION_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-[11px] text-slate-400">Schedule (Cron)</div>
            <input
              value={realDevelopmentState.schedule}
              disabled={!editable}
              onChange={(e) => setRealDevelopmentState((s) => ({ ...s, schedule: e.target.value }))}
              className={cn(inputBaseClass, fieldRing('schedule'))}
              placeholder="0 2 * * *"
            />
            {hasAiDiff && aiProposalState?.schedule != null && aiProposalState.schedule !== realDevelopmentState.schedule && (
              <div className="mt-1 text-[10px] text-emerald-200">
                <span className="line-through text-slate-500">{realDevelopmentState.schedule}</span>
                <span className="ml-2">{aiProposalState.schedule}</span>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* 下部：无垠 SQL 画布（全宽） */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <Editor
          value={sqlViewMode === 'ai' ? proposedState.sql : realDevelopmentState.sql}
          onChange={(v) => {
            if (!editable) return
            if (sqlViewMode !== 'real') return
            setRealDevelopmentState((s) => ({ ...s, sql: v ?? '' }))
          }}
          language="sql"
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            readOnly: !editable || sqlViewMode !== 'real',
          }}
          height="100%"
        />
      </div>
    </div>
  )
}

