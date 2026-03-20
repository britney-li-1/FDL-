import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import type { DevelopmentAiPayload } from '../../components/DevelopmentModule'
import { SqlMonacoEditor } from './SqlMonacoEditor'
import type { DevelopedTableDraft, DevelopmentAiProposalState, MaterializationMode } from './types'
import { useDevelopmentPageStore } from './useDevelopmentPageStore'

const MATERIALIZATION_OPTIONS: Array<{ id: MaterializationMode; label: string }> = [
  { id: 'table', label: 'table' },
  { id: 'view', label: 'view' },
  { id: 'incremental', label: 'incremental' },
  { id: 'ephemeral', label: 'ephemeral' },
]

function getDiff<K extends keyof DevelopedTableDraft>(
  key: K,
  real: DevelopedTableDraft,
  proposal: DevelopmentAiProposalState | null,
) {
  if (!proposal) return false
  const pv = proposal[key as keyof DevelopmentAiProposalState]
  if (pv == null) return false
  return pv !== real[key]
}

export function DevelopmentDbtPage({
  aiPayload,
  variant = 'develop',
  showSidebar = true,
}: {
  aiPayload?: DevelopmentAiPayload | null
  variant?: 'develop' | 'connections' | 'integrate'
  showSidebar?: boolean
} = {}) {
  const {
    tables,
    selectedTableId,
    realState,
    aiProposalState,
    selectTable,
    createDevelopedTableDraft,
    updateRealState,
    setAiProposalState,
    acceptProposal,
    rejectProposal,
  } = useDevelopmentPageStore()

  const enableEditor = variant === 'develop'

  // Sidebar dummy selects (Scaffold UI)
  const [sourceType, setSourceType] = useState<'MySQL' | 'PostgreSQL'>('MySQL')
  const [connectionId, setConnectionId] = useState('crm_prod')

  useEffect(() => {
    if (!enableEditor) return
    if (!aiPayload) return
    if (!aiPayload.code && !aiPayload.taskName && !aiPayload.schedule) return

    // Scaffold：把 Omni 的开发提案映射到本页 aiProposalState
    setAiProposalState({
      name: aiPayload.taskName,
      cron: aiPayload.schedule ? aiPayload.schedule : undefined,
      sql: aiPayload.code,
    })
  }, [aiPayload, enableEditor, setAiProposalState])

  const registeredTables = useMemo(() => tables.filter((t) => t.kind === 'registered'), [tables])
  const developedTables = useMemo(() => tables.filter((t) => t.kind === 'developed'), [tables])

  const edited = realState.edited
  const hasAnyAiDiff =
    enableEditor &&
    (getDiff('name', edited, aiProposalState) ||
      getDiff('writeTarget', edited, aiProposalState) ||
      getDiff('cron', edited, aiProposalState) ||
      getDiff('materialization', edited, aiProposalState) ||
      getDiff('sql', edited, aiProposalState))

  const fieldRing = (key: keyof DevelopedTableDraft) =>
    getDiff(key as any, edited, aiProposalState)
      ? 'border-emerald-300/40 ring-1 ring-emerald-500/20'
      : 'border-white/15'

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {showSidebar && (
        <aside className="w-[260px] flex-none border-r border-white/10 bg-black/15 p-4">
          <div className="mb-4 space-y-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Source / Connection
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <label className="space-y-1 text-[11px]">
                  <div className="text-slate-400">Source</div>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as any)}
                    className="h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100 outline-none focus:border-cyan-300/40"
                  >
                    <option value="MySQL">MySQL</option>
                    <option value="PostgreSQL">PostgreSQL</option>
                  </select>
                </label>

                <label className="space-y-1 text-[11px]">
                  <div className="text-slate-400">Connection</div>
                  <select
                    value={connectionId}
                    onChange={(e) => setConnectionId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100 outline-none focus:border-cyan-300/40"
                  >
                    <option value="crm_prod">crm_prod</option>
                    <option value="sales_prod">sales_prod</option>
                  </select>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={createDevelopedTableDraft}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100 transition hover:bg-cyan-400/15"
              title="+ 新建开发表（仅 Developed 可编辑）"
            >
              <Plus className="h-4 w-4" />
              ➕ 新建开发表
            </button>
          </div>

          <div className="space-y-3 overflow-y-auto pr-1">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Tables
              </div>
              <div className="mt-3 space-y-2">
                <div className="text-[10px] text-slate-500">Registered (read-only)</div>
                <div className="space-y-1">
                  {registeredTables.map((t) => {
                    const isActive = selectedTableId === t.id
                    return (
                      <div
                        key={t.id}
                        className={[
                          'flex items-center justify-between gap-2 rounded-xl border px-2 py-2 text-left text-[11px]',
                          'border-white/10 bg-black/10 text-slate-400',
                          isActive ? 'ring-1 ring-blue-500/40' : '',
                        ].join(' ')}
                        title="Registered 表（只读引用）"
                      >
                        <span className="min-w-0 truncate">
                          <span className="inline-flex items-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200">
                            [🧊 {t.name}]
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="pt-2 text-[10px] text-slate-500">Developed (editable)</div>
                <div className="space-y-1">
                  {developedTables.map((t) => {
                    const isActive = selectedTableId === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectTable(t.id)}
                        className={[
                          'flex w-full items-center justify-between gap-2 rounded-xl border px-2 py-2 text-left text-[11px] transition',
                          isActive
                            ? 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]'
                            : 'border-white/10 bg-black/10 text-slate-300 hover:border-white/15 hover:bg-white/[0.03]',
                        ].join(' ')}
                        title="Developed 表（可在此编辑）"
                      >
                        <span className="min-w-0 truncate">
                          <span className="inline-flex items-center rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-200">
                            [⚙️ {t.name}]
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-600/70" />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Main Editor Area */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar ribbon (compact) */}
        <div className="flex-none border-b border-white/10 bg-black/25 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-semibold text-slate-200/90">
                  {variant === 'develop'
                    ? '开发表配置（dbt-style）'
                    : variant === 'connections'
                      ? '数据连接（占位骨架）'
                      : '数据集成（占位骨架）'}
                </div>
                {enableEditor && hasAnyAiDiff && (
                  <span className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-200">
                    AI Diff
                  </span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {enableEditor
                  ? 'realState 渲染；aiProposalState 存在时叠加绿色 Diff（Accept/Reject）'
                  : '此模块后续接入真实编辑器/表单；左侧资源树保持一致。'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {enableEditor && aiProposalState && hasAnyAiDiff && (
                <>
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
                </>
              )}
            </div>
          </div>

          {enableEditor ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="space-y-1 text-[11px]">
              <div className="text-slate-400">Table</div>
              <input
                value={edited.name}
                onChange={(e) => updateRealState({ name: e.target.value })}
                className={[
                  'h-9 rounded-lg border bg-slate-950/70 px-2 text-xs text-slate-100 outline-none transition',
                  fieldRing('name'),
                ].join(' ')}
              />
            </label>

            <label className="space-y-1 text-[11px]">
              <div className="text-slate-400">Write Target</div>
              <input
                value={edited.writeTarget}
                onChange={(e) => updateRealState({ writeTarget: e.target.value })}
                className={[
                  'h-9 rounded-lg border bg-slate-950/70 px-2 text-xs text-slate-100 outline-none transition',
                  fieldRing('writeTarget'),
                ].join(' ')}
              />
            </label>

            <label className="space-y-1 text-[11px]">
              <div className="text-slate-400">Cron</div>
              <input
                value={edited.cron}
                onChange={(e) => updateRealState({ cron: e.target.value })}
                className={[
                  'h-9 rounded-lg border bg-slate-950/70 px-2 text-xs text-slate-100 outline-none transition',
                  fieldRing('cron'),
                ].join(' ')}
              />
            </label>

            <label className="space-y-1 text-[11px]">
              <div className="text-slate-400">Material</div>
              <select
                value={edited.materialization}
                onChange={(e) => updateRealState({ materialization: e.target.value as any })}
                className={[
                  'h-9 rounded-lg border bg-slate-950/70 px-2 text-xs text-slate-100 outline-none transition',
                  fieldRing('materialization'),
                ].join(' ')}
              >
                {MATERIALIZATION_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-slate-400">
              Placeholder：{variant === 'connections' ? 'Connections Config Form' : 'Integration Pipeline Builder'}
            </div>
          )}
        </div>

        {/* Hero SQL Canvas */}
        <div className="flex min-h-0 flex-1 flex-col p-4">
          {enableEditor ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs text-slate-400">SQL Canvas（Monaco）</div>
                {aiProposalState?.sql &&
                  aiProposalState.sql !== edited.sql && (
                    <div className="text-[11px] text-emerald-200">Green Diff ready</div>
                  )}
              </div>

              <div className="flex min-h-0 flex-1">
                <SqlMonacoEditor
                  value={edited.sql}
                  onChange={(next) => updateRealState({ sql: next })}
                  highlight={!!aiProposalState?.sql && aiProposalState.sql !== edited.sql}
                />
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-xs text-slate-500">
              {variant === 'connections'
                ? 'Connections Editor Placeholder'
                : 'Integration Editor Placeholder'}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

