import { useState } from 'react'
import { getScenarioById, type AgentScenario } from '../agent/pipeline-catalog'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type PipelineLifecycle =
  | 'IDLE'
  | 'ANALYZING'
  | 'PENDING_CONFIRMATION'
  | 'COMMITTED'

export type ReceiptCommitStatus = 'IDLE' | 'LOADING' | 'SUCCESS'

export type HistoryEntry =
  | { id: string; type: 'user'; content: string }
  | { id: string; type: 'log'; content: string }
  | {
      id: string
      type: 'receipt'
      scenario: AgentScenario
      commitStatus: ReceiptCommitStatus
    }

type UseAgentPipelineRunnerOptions = {
  onCommitted?: (scenario: AgentScenario) => void
}

export function useAgentPipelineRunner({
  onCommitted,
}: UseAgentPipelineRunnerOptions) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [lifecycle, setLifecycle] = useState<PipelineLifecycle>('IDLE')

  const appendLogWithTyping = async (line: string) => {
    const logId = crypto.randomUUID()
    setHistory((prev) => [...prev, { id: logId, type: 'log', content: '' }])
    for (let i = 1; i <= line.length; i += 1) {
      await sleep(18)
      const current = line.slice(0, i)
      setHistory((prev) =>
        prev.map((entry) =>
          entry.id === logId && entry.type === 'log'
            ? { ...entry, content: current }
            : entry,
        ),
      )
    }
  }

  const runScenario = async (scenarioId: AgentScenario['id']) => {
    if (lifecycle === 'ANALYZING') return
    const scenario = getScenarioById(scenarioId)

    // TODO:[AI_AGENT_BACKEND_HOOK] 在这里接入真实 LLM 任务编排请求
    setHistory((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: 'user', content: scenario.prompt },
    ])
    setLifecycle('ANALYZING')

    for (const logLine of scenario.logs) {
      await appendLogWithTyping(logLine)
      await sleep(240)
    }

    setHistory((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'receipt',
        scenario,
        commitStatus: 'IDLE',
      },
    ])
    setLifecycle('PENDING_CONFIRMATION')
  }

  const commitReceipt = async (receiptId: string) => {
    let scenarioForCommit: AgentScenario | null = null

    setHistory((prev) =>
      prev.map((entry) => {
        if (entry.id === receiptId && entry.type === 'receipt') {
          scenarioForCommit = entry.scenario
          return { ...entry, commitStatus: 'LOADING' }
        }
        return entry
      }),
    )

    // TODO:[AI_AGENT_BACKEND_HOOK] 在这里接入真实部署/应用确认 API
    await sleep(1000)

    setHistory((prev) =>
      prev.map((entry) =>
        entry.id === receiptId && entry.type === 'receipt'
          ? { ...entry, commitStatus: 'SUCCESS' }
          : entry,
      ),
    )
    setLifecycle('COMMITTED')

    if (scenarioForCommit) {
      onCommitted?.(scenarioForCommit)
    }
  }

  return {
    history,
    lifecycle,
    runScenario,
    commitReceipt,
  }
}
