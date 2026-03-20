import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { cn } from '../lib/utils'

type ModuleId = 'connections' | 'develop' | 'integrate'

export default function LayoutFloatingIsland({
  activeModule,
  renderMainContent,
  onSubmitOmni,
}: {
  activeModule: ModuleId
  renderMainContent: () => ReactNode
  onSubmitOmni: (text: string) => void
}) {
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
    <div className="relative h-[calc(100vh-44px)] min-h-[520px]">
      <div className="h-full overflow-hidden">{renderMainContent()}</div>

      {/* Floating omni island (A: no side dialogs) */}
      <div className="fixed bottom-8 left-1/2 z-50 w-full max-w-3xl -translate-x-1/2 px-4">
        <div className="relative rounded-2xl border border-white/10 bg-gray-900/80 p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-cyan-200">
              <Sparkles className="h-4 w-4" />
            </div>

            <input
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              placeholder="Omni Command（回车触发 Green Diff）..."
              className={cn(
                'h-10 flex-1 rounded-xl border bg-black/20 px-4 text-xs text-slate-100 outline-none placeholder:text-slate-400 transition',
                canSubmit
                  ? 'border-white/15 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-500/20'
                  : 'border-white/10',
              )}
            />

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className={cn(
                'h-10 rounded-xl border px-4 text-xs transition',
                canSubmit
                  ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25'
                  : 'cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-500',
              )}
            >
              Run
            </button>
          </div>

          {/* Tiny floating receipt bubble (no width stealing) */}
          {showBubble && (
            <div className="pointer-events-none absolute -top-12 left-4 right-4 rounded-2xl border border-cyan-300/25 bg-black/40 p-3 text-[11px] text-slate-200 shadow-[0_0_0_1px_rgba(34,211,238,0.15)] backdrop-blur">
              <div className="mb-1 text-xs font-semibold text-cyan-100">
                推演记录（Demo）
              </div>
              <div>
                activeModule: <span className="text-slate-100">{activeModule}</span>。已生成可应用的 Diff 提案。
              </div>
              <div className="mt-2 text-[10px] text-cyan-200">
                🔗 <span className="underline">Diff Overview</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

