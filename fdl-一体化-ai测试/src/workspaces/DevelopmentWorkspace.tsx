import DevelopmentModule, { type DevelopmentAiPayload } from '../components/DevelopmentModule'
import type { TableResource } from '../types/domain'

type PreviewRow = { order_id: string; user_phone: string; amount: string }
type SchemaRow = { id: string; field: string; type: string }

type DevelopmentWorkspaceProps = {
  activeTable: TableResource
  unsaved: boolean
  previewRows: PreviewRow[]
  schemaRows: SchemaRow[]
  aiPayload?: DevelopmentAiPayload | null
  onAiPayloadConsumed?: () => void
}

export function DevelopmentWorkspace({
  activeTable,
  unsaved,
  previewRows,
  schemaRows,
  aiPayload,
  onAiPayloadConsumed,
}: DevelopmentWorkspaceProps) {
  return (
    <div className="h-full">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="text-xs text-slate-300">Table / {activeTable.name}</div>
        <div className="flex items-center gap-2">
          {unsaved && (
            <span className="rounded-md border border-rose-300/40 bg-rose-400/20 px-2 py-1 text-[11px] text-rose-200">
              Unsaved
            </span>
          )}
          <button className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">
            保存
          </button>
        </div>
      </div>

      <div className="h-[calc(100vh-8.8rem)] overflow-y-auto p-5">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="mb-3 text-xs text-slate-300">Data Preview</p>
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="border-b border-white/10 px-3 py-2 text-left">order_id</th>
                    <th className="border-b border-white/10 px-3 py-2 text-left">user_phone</th>
                    <th className="border-b border-white/10 px-3 py-2 text-left">amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.order_id}>
                      <td className="border-b border-white/10 px-3 py-2">{row.order_id}</td>
                      <td className="border-b border-white/10 px-3 py-2">{row.user_phone}</td>
                      <td className="border-b border-white/10 px-3 py-2">{row.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="mb-3 text-xs text-slate-300">Schema 示意图</p>
            <div className="space-y-2">
              {schemaRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[1.2fr_1fr] rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs"
                >
                  <span>{row.field}</span>
                  <span className="text-slate-400">{row.type}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="mb-3 flex items-center gap-2 text-xs text-slate-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
              深色表格（Mappings / Logic）
            </p>

            {activeTable.type === 'integration' ? (
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-white/5 text-slate-300">
                    <tr>
                      <th className="border-b border-white/10 px-3 py-2 text-left">Source</th>
                      <th className="border-b border-white/10 px-3 py-2 text-left">Target</th>
                      <th className="border-b border-white/10 px-3 py-2 text-left">Type</th>
                      <th className="border-b border-white/10 px-3 py-2 text-left">Mask</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTable.mappings.map((m, idx) => (
                      <tr key={`${m.targetField}-${idx}`}>
                        <td className="border-b border-white/10 px-3 py-2">{m.sourceField}</td>
                        <td className="border-b border-white/10 px-3 py-2">{m.targetField}</td>
                        <td className="border-b border-white/10 px-3 py-2">{m.type}</td>
                        <td className="border-b border-white/10 px-3 py-2">
                          {m.isMasked ? (
                            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200">
                              On
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Off</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-[1fr_0.6fr] gap-2">
                {schemaRows.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200">{r.field}</span>
                      <span className="text-slate-400">{r.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {activeTable.type === 'development' && (
            <div className="h-[72vh] min-h-[620px] rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs text-violet-200">
                <span className="inline-block h-2 w-2 rounded-full bg-violet-400" />
                SQL Editor (DevelopmentModule)
              </div>
              <DevelopmentModule aiPayload={aiPayload} onAiPayloadConsumed={onAiPayloadConsumed} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

