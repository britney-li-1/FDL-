import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, CircleDashed, Sparkles } from 'lucide-react'
import { cn } from '../lib/utils'
import type { DataSourceResource, E2EPayload, Mapping, Receipt, TableResource } from '../types/domain'

type StepStatus = 'pending' | 'running' | 'success'
type ExecutionStep = {
  id: string
  label: string
  status: StepStatus
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  type: 'text' | 'loading' | 'card'
  content?: string
  payload?: Receipt
  steps?: ExecutionStep[]
}

type OmniPanelProps = {
  tables: TableResource[]
  activeTableId: string
  onApplyReceipt: (receipt: Receipt) => void
  /**
   * 当外部需要强制触发聚焦 UX 时递增。用于不展开/异步展开的健壮性。
   * 例如 Activity Bar 点击 AI 助手后，Layout 里 setTimeout -> setOmniFocusSignal(+1)
   */
  focusSignal?: number
}

const SUGGESTIONS = [
  {
    icon: '📡',
    label: '数据接入',
    text: '我想把 MySQL 的 CRM 营收表同步到数仓，帮我做下字段映射。',
  },
  {
    icon: '⚡️',
    label: '模型开发',
    text: '帮我用 SQL 开发一张报表：统计近 7 天各个区域的活跃客户数。',
  },
  {
    icon: '🛡️',
    label: '安全管控',
    text: '给当前选中的表里，所有手机号和身份证字段配置脱敏面具。',
  },
] as const

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function OmniPanel({
  tables,
  activeTableId,
  onApplyReceipt,
  focusSignal,
}: OmniPanelProps) {
  const [commandInput, setCommandInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [isHighlighting, setIsHighlighting] = useState(false)
  const highlightTimerRef = useRef<number | null>(null)

  const triggerHighlight = useCallback(() => {
    setIsHighlighting(true)
    if (highlightTimerRef.current != null) window.clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = window.setTimeout(() => {
      setIsHighlighting(false)
    }, 1800)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  useEffect(() => {
    if (focusSignal == null) return
    triggerHighlight()
  }, [focusSignal, triggerHighlight])

  const updateMessageSteps = (
    messageId: string,
    updater: (steps: ExecutionStep[]) => ExecutionStep[],
  ) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.type === 'loading' && m.steps
          ? { ...m, steps: updater(m.steps) }
          : m,
      ),
    )
  }

  const createExecutionSteps = (kind: Receipt['kind']): ExecutionStep[] => {
    if (kind === 'e2e') {
      return [
        {
          id: crypto.randomUUID(),
          label: '步骤1: [网络] 解析凭证并验证 MySQL 数据源连通性 (Ping)',
          status: 'pending',
        },
        {
          id: crypto.randomUUID(),
          label: '步骤2: [元数据] 探查源库 Schema 与 order_detail 表结构',
          status: 'pending',
        },
        {
          id: crypto.randomUUID(),
          label: '步骤3: [模型] 生成目标端 ods_order_detail DDL 规范',
          status: 'pending',
        },
        {
          id: crypto.randomUUID(),
          label: '步骤4: [管道] 编排按天分区的全量离线同步拓扑流',
          status: 'pending',
        },
      ]
    }

    if (kind === 'development') {
      return [
        { id: crypto.randomUUID(), label: '抽取依赖源表元数据...', status: 'pending' },
        { id: crypto.randomUUID(), label: '构建聚合维度与计算指标树...', status: 'pending' },
        { id: crypto.randomUUID(), label: '编译声明式 SQL 抽象语法树...', status: 'pending' },
        { id: crypto.randomUUID(), label: '组装结果呈现卡片...', status: 'pending' },
      ]
    }

    if (kind === 'security') {
      return [
        { id: crypto.randomUUID(), label: '扫描敏感字段命名特征', status: 'pending' },
        { id: crypto.randomUUID(), label: '匹配脱敏策略模板', status: 'pending' },
        { id: crypto.randomUUID(), label: '生成策略草稿与可回滚清单', status: 'pending' },
      ]
    }

    return [
      {
        id: crypto.randomUUID(),
        label: '连接源数据库提取 Schema (MySQL: CRM_营收表)...',
        status: 'pending',
      },
      {
        id: crypto.randomUUID(),
        label: '匹配目标数仓 ODS 层落表规范...',
        status: 'pending',
      },
      {
        id: crypto.randomUUID(),
        label: '生成字段类型清洗与映射方案 (Mapping Canvas)...',
        status: 'pending',
      },
      { id: crypto.randomUUID(), label: '组装结果呈现卡片...', status: 'pending' },
    ]
  }

  const routeIntent = (userInput: string): Receipt['kind'] => {
    const inputLower = userInput.toLowerCase()
    const isIntegration = ['同步', '映射', '接入', 'mysql', '抽取'].some((keyword) =>
      inputLower.includes(keyword),
    )
    const isDevelopment = ['sql', '统计', '报表', '分析', '模型', '计算', '处理'].some((keyword) =>
      inputLower.includes(keyword),
    )
    const isSecurity = ['脱敏', 'mask', '手机号', '身份证', 'id card', 'idcard'].some((keyword) =>
      inputLower.includes(keyword),
    )

    const hasIp = /\b(\d{1,3}\.){3}\d{1,3}\b/.test(inputLower)
    const isE2E =
      ['连', '连接', '线上', 'salesdb', 'db', 'order_detail'].some((k) => inputLower.includes(k)) &&
      ['全量', '按天', '同步', 'ods'].some((k) => inputLower.includes(k)) &&
      hasIp

    if (isE2E) return 'e2e'
    if (isSecurity) return 'security'
    if (isDevelopment && !isIntegration) return 'development'
    if (isIntegration && !isDevelopment) return 'integration'
    if (isDevelopment && isIntegration) {
      // Prefer explicit SQL edits when both hit
      if (inputLower.includes('sql')) return 'development'
      return 'integration'
    }

    // Default fallback: integration (safer and matches "ops + integration first" mental model)
    return 'integration'
  }

  const createReceiptByText = (text: string): Receipt => {
    const lower = text.toLowerCase()

    const isSecurityMasking =
      /脱敏|mask|手机号|身份证|id\s*card/.test(lower) || /脱敏|手机号|身份证/.test(text)

    if (isSecurityMasking) {
      const targetTable = tables.find((t) => t.id === activeTableId) ?? tables[0]

      const patched: TableResource =
        targetTable.type === 'integration'
          ? {
              ...targetTable,
              mappings: targetTable.mappings.map((m) => {
                const k = `${m.sourceField} ${m.targetField}`.toLowerCase()
                const shouldMask =
                  /phone|mobile|身份证|idcard|id_card|identity/.test(k) ||
                  /手机号|身份证/.test(`${m.sourceField} ${m.targetField}`)
                return shouldMask ? { ...m, isMasked: true } : m
              }),
              status: 'draft',
            }
          : {
              ...targetTable,
              status: 'draft',
            }

      return {
        id: crypto.randomUUID(),
        kind: 'security',
        title: '✨ 安全策略推演完成',
        summary: '已生成脱敏策略草稿，可一键应用到当前表配置。',
        payload: patched,
      }
    }

    // NOTE: 其他意图分流由 submit router 决定；这里提供可复用的 payload 模板
    const integrationReceipt: Receipt = {
      id: crypto.randomUUID(),
      kind: 'integration',
      title: '✨ 集成映射推演完成',
      summary: '已生成源表到数仓 ODS 层的同步方案及字段映射。',
      payload: {
        id: 'ods_crm_revenue',
        name: 'ods_crm_revenue',
        type: 'integration',
        source: 'mysql.crm.customer_revenue',
        target: 'warehouse.ods_crm_revenue',
        mappings: [
          {
            sourceField: 'cust_id',
            targetField: 'customer_id',
            type: 'BIGINT',
            isMasked: false,
          },
          {
            sourceField: 'customer_phone',
            targetField: 'customer_phone',
            type: 'STRING',
            isMasked: true,
          },
          {
            sourceField: 'revenue',
            targetField: 'revenue',
            type: 'DECIMAL(18,2)',
            isMasked: false,
          },
          { sourceField: 'region', targetField: 'region', type: 'STRING', isMasked: false },
          {
            sourceField: 'updated_at',
            targetField: 'updated_at',
            type: 'TIMESTAMP',
            isMasked: false,
          },
        ] satisfies Mapping[],
        sql: '',
        status: 'draft',
      } satisfies TableResource,
    }

    const developmentReceipt: Receipt = {
      id: crypto.randomUUID(),
      kind: 'development',
      title: '✨ 开发逻辑推演完成',
      summary: '已生成相应的声明式 SQL 脚本抽象结构。',
      payload: {
        id: crypto.randomUUID(),
        name: 'dws_customer_report',
        type: 'development',
        source: 'warehouse.dwd_customer_orders',
        target: 'warehouse.dws_customer_report',
        mappings: [],
        sql: `SELECT
  customer_id,
  count(1) AS order_cnt,
  sum(order_amount) AS total_amount
FROM dwd_customer_orders
GROUP BY customer_id;`,
        status: 'draft',
      } satisfies TableResource,
    }

    // Fallback: if caller didn't route, prefer integration (safer in platform UX)
    const inputLower = text.toLowerCase()
    const isIntegrationFallback = ['同步', '映射', '接入', 'mysql', '抽取'].some((k) =>
      inputLower.includes(k),
    )
    const isDevelopmentFallback = [
      'sql',
      '统计',
      '报表',
      '分析',
      '模型',
      '计算',
      '处理',
    ].some((k) => inputLower.includes(k))

    if (isDevelopmentFallback && !isIntegrationFallback) return developmentReceipt
    return integrationReceipt
  }

  const createReceiptByRoutedIntent = (routedKind: Receipt['kind'], userText: string): Receipt => {
    if (routedKind === 'e2e') {
      const ip = userText.match(/\b(\d{1,3}\.){3}\d{1,3}\b/)?.[0] ?? '10.0.0.8'

      const dataSource: DataSourceResource = {
        id: 'MySQL_Sales_Online',
        name: 'MySQL_Sales_Online',
        engine: 'MySQL',
        host: `${ip}:3306`,
        database: 'sales',
        username: 'readonly',
        password: '********',
        status: 'draft',
      }

      const table: TableResource = {
        id: 'ods_order_detail',
        name: 'ods_order_detail',
        type: 'integration',
        source: `${dataSource.name}.order_detail`,
        target: 'warehouse.ods_order_detail',
        mappings: [
          {
            sourceField: 'order_id',
            targetField: 'order_id',
            type: 'BIGINT',
            isMasked: false,
          },
          {
            sourceField: 'sku_id',
            targetField: 'sku_id',
            type: 'BIGINT',
            isMasked: false,
          },
          {
            sourceField: 'buyer_phone',
            targetField: 'buyer_phone',
            type: 'STRING',
            isMasked: true,
          },
          {
            sourceField: 'order_amount',
            targetField: 'order_amount',
            type: 'DECIMAL(18,2)',
            isMasked: false,
          },
          {
            sourceField: 'dt',
            targetField: 'dt',
            type: 'DATE',
            isMasked: false,
          },
        ],
        sql: '',
        status: 'draft',
      }

      const payload = {
        dataSource,
        table,
        scheduling: {
          mode: 'full',
          partition: 'daily',
          execution: 'one-shot',
          autoMapping: true,
        },
      } satisfies E2EPayload

      return {
        id: crypto.randomUUID(),
        kind: 'e2e',
        title: '✨ 端到端集成方案已就绪',
        summary: '连接→探查→落表→编排已完成沙盘推演，请审阅后填充到工作区。',
        payload,
      }
    }

    // default leaf receipts
    return createReceiptByText(userText)
  }

  const handleSubmitCommand = async (overrideText?: string) => {
    const text = (overrideText ?? commandInput).trim()
    if (!text || isProcessing) return
    setIsProcessing(true)

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      type: 'text',
      content: text,
    }

    const routedKind = routeIntent(text)
    let receipt = createReceiptByRoutedIntent(routedKind, text)

    // Enforce router result to prevent drift.
    if (receipt.kind !== routedKind) receipt = createReceiptByRoutedIntent(routedKind, text)

    const stepSeed = createExecutionSteps(receipt.kind)
    const loadingId = crypto.randomUUID()
    const loadingMsg: Message = {
      id: loadingId,
      role: 'assistant',
      type: 'loading',
      content: '正在推演元数据与映射策略...',
      steps: stepSeed,
    }

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setCommandInput('')

    // TODO:[AI_AGENT_BACKEND_HOOK] 在这里接入真实自然语言推演 API
    for (let index = 0; index < stepSeed.length; index += 1) {
      updateMessageSteps(loadingId, (steps) =>
        steps.map((step, idx) => (idx === index ? { ...step, status: 'running' } : step)),
      )
      await sleep(600 + Math.floor(Math.random() * 401))
      updateMessageSteps(loadingId, (steps) =>
        steps.map((step, idx) => (idx === index ? { ...step, status: 'success' } : step)),
      )
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === loadingId ? { ...m, type: 'card', payload: receipt } : m)),
    )
    setIsProcessing(false)
  }

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/15 bg-white/[0.08] shadow-2xl shadow-violet-900/20 backdrop-blur-xl">
      <header className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Bot className="h-5 w-5 text-cyan-300" />
          <h2 className="text-sm font-semibold tracking-wide">Omni Panel</h2>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.03] p-4">
            <p className="mb-3 text-xs text-slate-300">试试这些快捷场景（回车也可直接下达指令）：</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    setCommandInput(s.text)
                    void handleSubmitCommand(s.text)
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
                >
                  <span className="text-sm leading-none">{s.icon}</span>
                  <span className="font-medium">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div
                key={msg.id}
                className="ml-auto w-fit max-w-[88%] rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300"
              >
                {msg.content}
              </div>
            )
          }

          if (msg.type === 'loading') {
            return (
              <div
                key={msg.id}
                className="w-fit max-w-[95%] rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100"
              >
                <div className="mb-2 flex items-center gap-2">
                  <CircleDashed className="h-3.5 w-3.5 animate-spin text-cyan-200" />
                  <span className="animate-pulse">{msg.content}</span>
                </div>
                <div className="space-y-1">
                  {msg.steps?.map((step) => (
                    <div
                      key={step.id}
                      className={cn(
                        'flex items-center gap-2 text-[12px]',
                        step.status === 'pending' && 'text-slate-500',
                        step.status === 'running' && 'text-cyan-300',
                        step.status === 'success' && 'text-slate-400',
                      )}
                    >
                      {step.status === 'running' ? (
                        <CircleDashed className="h-3 w-3 animate-spin" />
                      ) : (
                        <span
                          className={cn(
                            'inline-block h-1.5 w-1.5 rounded-full',
                            step.status === 'pending' ? 'bg-slate-600' : 'bg-slate-400',
                          )}
                        />
                      )}
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          if (msg.type === 'card' && msg.payload) {
            const receipt = msg.payload
            return (
              <article
                key={msg.id}
                className="w-full rounded-2xl border border-white/20 bg-white/10 p-4 shadow-xl"
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-violet-200" />
                  {receipt.title}
                </div>
                <p className="mb-3 text-xs text-slate-200">{receipt.summary}</p>

                {receipt.kind === 'e2e' && (
                  <div className="mb-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
                    <div className="grid grid-cols-1 gap-1 text-[12px] text-slate-200">
                      <div className="flex items-center justify-between">
                        <span>🔌 数据源</span>
                        <span className="text-emerald-200">MySQL_Sales_Online (待注册)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>🗄️ 目标表</span>
                        <span className="text-cyan-200">ods_order_detail (待新建)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>🔄 调度策略</span>
                        <span className="text-slate-300">全量覆盖 / 一次性执行 / 自动映射字段</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => onApplyReceipt(receipt)}
                  className="rounded-lg border border-cyan-300/50 bg-cyan-400/20 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/30"
                >
                  {receipt.kind === 'development'
                    ? '应用此开发SQL配置'
                    : receipt.kind === 'security'
                      ? '应用此安全策略'
                      : receipt.kind === 'e2e'
                        ? '审阅并填充全局工作区'
                        : '应用此集成映射配置'}
                </button>
              </article>
            )
          }

          return null
        })}

        <div ref={messagesEndRef} />
      </div>

      <footer className="border-t border-white/10 p-3">
        <div
          className={cn(
            'rounded-xl transition-all duration-300',
            isHighlighting &&
              'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0d1218] shadow-[0_0_0_1px_rgba(59,130,246,0.45),0_0_26px_rgba(59,130,246,0.35)] animate-pulse',
          )}
        >
          <input
            id="omni-panel-chat-input"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onFocus={() => triggerHighlight()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmitCommand()
            }}
            placeholder="输入指令并按回车..."
            className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs outline-none placeholder:text-slate-400"
          />
        </div>
      </footer>
    </div>
  )
}

