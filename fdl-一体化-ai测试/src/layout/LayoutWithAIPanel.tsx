import { Bot, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
import { cn } from '../lib/utils'
import { useDevelopmentPageStore } from '../modules/data-development/useDevelopmentPageStore'
import { ChevronRight, Plus } from 'lucide-react'

type ModuleId = 'connections' | 'develop' | 'integrate'

export default function LayoutWithAIPanel({
  activeModule,
  renderCenterContent,
  onSubmitOmni,
}: {
  activeModule: ModuleId
  renderCenterContent: () => ReactNode
  onSubmitOmni: (text: string) => void
}) {
  const {
    tables,
    selectedTableId,
    selectTable,
    createDevelopedTableDraft,
  } = useDevelopmentPageStore()

  const registeredTables = useMemo(() => tables.filter((t) => t.kind === 'registered'), [tables])
  const developedTables = useMemo(() => tables.filter((t) => t.kind === 'developed'), [tables])

  const [sourceType, setSourceType] = useState<'MySQL' | 'PostgreSQL'>('MySQL')
  const [connectionId, setConnectionId] = useState('crm_prod')

  const connectionResources = useMemo(
    () => [
      { id: 'mysql_seed', name: 'MySQL_CRM_Seed', engine: 'MySQL', status: 'ready' as const, detail: 'crm-prod.internal:3306 · crm' },
      { id: 'kafka_orders_stream', name: 'Kafka_Orders_Stream', engine: 'Kafka', status: 'draft' as const, detail: 'broker-a/b/c · topic.orders_rt' },
    ],
    [],
  )

  const pipelineResources = useMemo(
    () => [
      { id: 'pipe_mysql_hive_full', name: 'MySQL -> Hive 全量同步', status: 'ready' as const, cadence: 'T+1 / Full Load' },
      { id: 'pipe_kafka_realtime', name: 'Kafka 实时摄入', status: 'running' as const, cadence: 'Streaming / Seconds' },
    ],
    [],
  )

  const [aiPanelWidth, setAiPanelWidth] = useState(340)
  const [isAiCollapsed, setIsAiCollapsed] = useState(false)
  const isResizingRef = useRef(false)

  const [commandInput, setCommandInput] = useState('')
  const [showBubble, setShowBubble] = useState(false)
  const canSubmit = useMemo(() => commandInput.trim().length > 0, [commandInput])

  const submit = () => {
    const text = commandInput.trim()
    if (!text) return
    onSubmitOmni(text)
    setShowBubble(true)
    window.setTimeout(() => setShowBubble(false), 1800)
    setCommandInput('')
  }

  return (
    <div className="flex h-[calc(100vh-44px)] min-h-[520px] overflow-hidden">
      {/* Left: Resource Explorer */}
      <aside className="w-[280px] flex-none border-r border-white/10 bg-black/15 p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Resource Explorer
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-slate-300">
            {tables.length}
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto pr-1">
          {activeModule === 'connections' && (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="text-[11px] font-semibold text-slate-200">Source / Connection</div>
                <div className="mt-2 space-y-2">
                  <label className="block">
                    <div className="text-[10px] text-slate-400">Source</div>
                    <select
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value as any)}
                      className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100 outline-none focus:border-cyan-300/40"
                    >
                      <option value="MySQL">MySQL</option>
                      <option value="PostgreSQL">PostgreSQL</option>
                    </select>
                  </label>
                  <label className="block">
                    <div className="text-[10px] text-slate-400">Connection</div>
                    <select
                      value={connectionId}
                      onChange={(e) => setConnectionId(e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100 outline-none focus:border-cyan-300/40"
                    >
                      <option value="crm_prod">crm_prod</option>
                      <option value="sales_prod">sales_prod</option>
                    </select>
                  </label>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Connection Registry</div>
                <div className="mt-2 space-y-2">
                  {connectionResources.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-white/10 bg-black/10 px-2 py-2 text-[11px] text-slate-300"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{r.name}</span>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px]',
                            r.status === 'draft'
                              ? 'border-amber-300/20 bg-amber-400/10 text-amber-200'
                              : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
                          )}
                        >
                          {r.status === 'draft' ? '待注册' : '已注册'}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">{r.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeModule === 'integrate' && (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="text-[11px] font-semibold text-slate-200">Integration Pipelines</div>
                <div className="mt-1 text-[10px] text-slate-400">同步、摄入与分发任务树（占位）</div>
              </div>
              <div className="space-y-2">
                {pipelineResources.map((p) => (
                  <div key={p.id} className="rounded-xl border border-white/10 bg-black/10 px-2 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-medium text-slate-200">{p.name}</span>
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px]',
                          p.status === 'running'
                            ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-200'
                            : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
                        )}
                      >
                        {p.status === 'running' ? '运行中' : '已发布'}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">{p.cadence}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeModule === 'develop' && (
            <>
              <button
                type="button"
                onClick={createDevelopedTableDraft}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100 transition hover:bg-cyan-400/15"
              >
                <Plus className="h-4 w-4" />
                ➕ 新建开发表
              </button>

              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Registered / Developed</div>
                <div className="mt-2 space-y-1">
                  {registeredTables.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl border border-white/10 bg-black/10 px-2 py-2 text-[11px] text-slate-400"
                      title="Registered (read-only)"
                    >
                      <span className="inline-flex items-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200">
                        [🧊 {t.name}]
                      </span>
                    </div>
                  ))}
                  {developedTables.map((t) => {
                    const active = selectedTableId === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectTable(t.id)}
                        className={[
                          'flex w-full items-center justify-between gap-2 rounded-xl border px-2 py-2 text-left text-[11px] transition',
                          active
                            ? 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]'
                            : 'border-white/10 bg-black/10 text-slate-300 hover:border-white/15 hover:bg-white/[0.03]',
                        ].join(' ')}
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
            </>
          )}
        </div>
      </aside>

      {/* Center */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {activeModule === 'develop' ? (
          <div className="flex-1">{renderCenterContent()}</div>
        ) : (
          <div className="flex-1">{renderCenterContent()}</div>
        )}
      </div>

      {/* Right: AI Panel */}
      {!isAiCollapsed && (
        <>
          <div
            className="w-1 cursor-col-resize bg-white/0"
            onMouseDown={(e) => {
              e.preventDefault()
              isResizingRef.current = true
            }}
            onMouseMove={(e) => {
              if (!isResizingRef.current) return
              const next = window.innerWidth - e.clientX - 0
              // clamp to [300, 400]
              const clamped = Math.max(300, Math.min(400, next))
              setAiPanelWidth(clamped)
            }}
            onMouseUp={() => {
              isResizingRef.current = false
            }}
          />

          <aside
            className={cn(
              'flex-none border-l border-white/10 bg-black/25 backdrop-blur-xl',
              'shadow-[0_0_0_1px_rgba(255,255,255,0.04)]',
            )}
            style={{ width: aiPanelWidth }}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-cyan-300" />
                  <div className="text-xs font-semibold text-slate-200">AI Panel</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAiCollapsed(true)}
                  className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                >
                  隐藏
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-[11px] text-slate-300">
                  聊天上下文与推演记录（Demo 占位）。右侧输入框触发与绿色 Diff 解耦。
                </div>
                {showBubble && (
                  <div className="mt-3 rounded-2xl border border-cyan-300/25 bg-black/30 p-3 text-[11px] text-slate-200 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]">
                    推演已触发：activeModule={activeModule}
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-cyan-200">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <input
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submit()
                    }}
                    placeholder="AI Command..."
                    className="h-9 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-slate-100 outline-none placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  className={cn(
                    'mt-3 h-9 w-full rounded-xl border px-3 text-xs transition',
                    canSubmit
                      ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25'
                      : 'cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-500',
                  )}
                >
                  Submit
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      {isAiCollapsed && (
        <div className="flex h-full items-start">
          <button
            type="button"
            onClick={() => setIsAiCollapsed(false)}
            className="m-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] text-slate-200"
          >
            展开 AI Panel
          </button>
        </div>
      )}
    </div>
  )
}

