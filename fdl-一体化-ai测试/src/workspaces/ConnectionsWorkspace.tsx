import type { DataSourceResource } from '../types/domain'

type ConnectionsWorkspaceProps = {
  activeConnectionId: string
  activeConnectionResource?: {
    id: string
    name: string
    engine: string
    detail: string
    status: DataSourceResource['status']
  }
  activeDataSource?: DataSourceResource
}

export function ConnectionsWorkspace({
  activeConnectionResource,
  activeDataSource,
}: ConnectionsWorkspaceProps) {
  const statusLabel = activeConnectionResource?.status === 'draft' ? '待注册' : '已注册'
  return (
    <div className="h-full">
      <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Connection Registry</p>
            <p className="mt-1 text-xs text-slate-300">
              数据源注册表单与网络信息预览（示例占位）
            </p>
          </div>
          {activeConnectionResource && (
            <span
              className={
                activeConnectionResource.status === 'draft'
                  ? 'rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-200'
                  : 'rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-200'
              }
            >
              {statusLabel}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1 text-xs">
            <span className="text-slate-400">Name</span>
            <input
              readOnly
              value={activeDataSource?.name ?? activeConnectionResource?.name ?? '—'}
              className="h-9 rounded-lg border border-white/20 bg-slate-950/90 px-2 text-xs outline-none"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-400">Engine</span>
            <input
              readOnly
              value={activeDataSource?.engine ?? activeConnectionResource?.engine ?? '—'}
              className="h-9 rounded-lg border border-white/20 bg-slate-950/90 px-2 text-xs outline-none"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-400">Host</span>
            <input
              readOnly
              value={activeDataSource?.host ?? activeConnectionResource?.detail ?? '—'}
              className="h-9 rounded-lg border border-white/20 bg-slate-950/90 px-2 text-xs outline-none"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-400">Database</span>
            <input
              readOnly
              value={activeDataSource?.database ?? '—'}
              className="h-9 rounded-lg border border-white/20 bg-slate-950/90 px-2 text-xs outline-none"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-400">Username</span>
            <input
              readOnly
              value={activeDataSource?.username ?? '—'}
              className="h-9 rounded-lg border border-white/20 bg-slate-950/90 px-2 text-xs outline-none"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-400">Password</span>
            <input
              readOnly
              value={activeDataSource?.password ?? '—'}
              className="h-9 rounded-lg border border-white/20 bg-slate-950/90 px-2 text-xs outline-none"
            />
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-cyan-200">
            Network Info Preview
          </p>
          <p className="mb-3 text-[11px] text-slate-400">
            这里展示连接可达性、端口探测与延迟的预览占位（不接后端）。
          </p>
          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
              <div className="text-slate-500">Ping</div>
              <div className="mt-1 text-cyan-200">OK</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
              <div className="text-slate-500">Port</div>
              <div className="mt-1 text-cyan-200">3306</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
              <div className="text-slate-500">Latency</div>
              <div className="mt-1 text-cyan-200">12ms</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

