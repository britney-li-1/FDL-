import { useMemo, useState } from 'react'
import type { DevelopmentAiProposalState } from '../modules/data-development/types'
import { DevelopmentDbtPage } from '../modules/data-development/DevelopmentDbtPage'
import { useDevelopmentPageStore } from '../modules/data-development/useDevelopmentPageStore'
import { cn } from '../lib/utils'
import LayoutFloatingIsland from './LayoutFloatingIsland'
import LayoutWithAIPanel from './LayoutWithAIPanel'

type ModuleId = 'connections' | 'develop' | 'integrate'

export default function Layout() {
  // CR：模块切换状态树必须可控，不要在正文中硬编码
  const [activeModule, setActiveModule] = useState<ModuleId>('connections')
  const layoutMode: 'floating' | 'aiPanel' = 'floating' // 默认走分支 A

  const { realState, setAiProposalState } = useDevelopmentPageStore()

  const createProposalFromOmni = (text: string): DevelopmentAiProposalState => {
    const now = realState.edited
    return {
      cron: now.cron || '0 2 * * *',
      materialization: now.materialization === 'incremental' ? 'table' : 'incremental',
      sql: `${now.sql}\n\n-- AI Proposal (demo)\n-- ${text}\n`,
    }
  }

  const submitOmniCommand = (text: string) => {
    const proposal = createProposalFromOmni(text)
    setAiProposalState(proposal)
  }

  const renderCenterContent = () => (
    <DevelopmentDbtPage variant={activeModule} showSidebar={false} />
  )

  const headerTabs = useMemo(
    () =>
      [
        ['connections', '数据连接'],
        ['develop', '数据开发'],
        ['integrate', '数据集成'],
      ] as const,
    [],
  )

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header: 纯净职责=仅 setActiveModule */}
      <div className="flex-none border-b border-white/10 bg-black/20 px-4 py-3">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-300">Data Platform IDE</div>
          <div className="flex items-center gap-2">
            {headerTabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveModule(id)}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-xs transition',
                  activeModule === id
                    ? 'border-blue-500/50 bg-cyan-400/15 text-cyan-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/5',
                )}
                title={label}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {layoutMode === 'floating' ? (
        <LayoutFloatingIsland
          activeModule={activeModule}
          renderMainContent={renderCenterContent}
          onSubmitOmni={submitOmniCommand}
        />
      ) : (
        <LayoutWithAIPanel
          activeModule={activeModule}
          renderCenterContent={renderCenterContent}
          onSubmitOmni={submitOmniCommand}
        />
      )}
    </main>
  )
}

