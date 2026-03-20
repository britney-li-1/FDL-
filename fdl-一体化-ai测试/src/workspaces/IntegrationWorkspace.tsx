import type { PipelineResource, TableResource } from '../types/domain'

type IntegrationWorkspaceProps = {
  pipelines: PipelineResource[]
  activePipelineId: string
  activeTable?: TableResource
}

export function IntegrationWorkspace({
  pipelines,
  activePipelineId,
}: IntegrationWorkspaceProps) {
  const active = pipelines.find((p) => p.id === activePipelineId) ?? pipelines[0]

  const statusLabel = (status: PipelineResource['status']) => {
    if (status === 'draft') return '待编排'
    if (status === 'running') return '运行中'
    return '已发布'
  }

  const statusClass = (status: PipelineResource['status']) => {
    if (status === 'draft') return 'border-amber-300/20 bg-amber-400/10 text-amber-200'
    if (status === 'running') return 'border-cyan-300/20 bg-cyan-400/10 text-cyan-200'
    return 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200'
  }

  return (
    <div className="h-full">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="text-xs text-slate-300">Pipeline / {active?.name ?? '—'}</div>
        <div className="flex items-center gap-2">
          {active && (
            <span className={`rounded-full border px-2 py-1 text-[11px] ${statusClass(active.status)}`}>
              {statusLabel(active.status)}
            </span>
          )}
          <button className="rounded-lg border border-emerald-300/50 bg-emerald-400/20 px-3 py-1.5 text-xs text-emerald-100">
            部署
          </button>
        </div>
      </div>

      <div className="h-[calc(100vh-8.8rem)] overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-3 text-xs text-slate-300">Pipeline 编排占位</p>
            <p className="mb-3 text-[11px] text-slate-400">展示任务节点、依赖关系与运行态（不接后端）。</p>

            <div className="space-y-2">
              {pipelines.map((p) => {
                const isActive = p.id === activePipelineId
                return (
                  <div
                    key={p.id}
                    className={[
                      'rounded-xl border p-3 text-xs transition',
                      isActive
                        ? 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]'
                        : 'border-white/10 bg-black/20 text-slate-300',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="mt-1 truncate text-[11px] text-slate-400">{p.detail}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(p.status)}`}>
                        {statusLabel(p.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      <span>{p.cadence}</span>
                      <span>{p.tableId ? 'Linked' : 'Mock'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="mb-3 flex items-center gap-2 text-xs text-slate-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Orchestration Canvas
            </p>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="grid gap-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-slate-300">
                  <div className="mb-1 font-medium text-cyan-200">1) Source Connect</div>
                  <div className="text-slate-400">{active?.detail?.split(' -> ')[0] ?? 'source'}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-slate-300">
                  <div className="mb-1 font-medium text-violet-200">2) Transform & Mapping</div>
                  <div className="text-slate-400">字段映射、类型清洗与 mask 规则（占位）</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-slate-300">
                  <div className="mb-1 font-medium text-emerald-200">3) Sink Write</div>
                  <div className="text-slate-400">{active?.detail?.split(' -> ')[1] ?? 'target'}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-slate-300">
                  <div className="mb-1 font-medium text-slate-200">4) Validate & Publish</div>
                  <div className="text-slate-400">运行态检查与发布策略（占位）</div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">
                添加节点
              </button>
              <button className="rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-400/15">
                生成编排草稿
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

