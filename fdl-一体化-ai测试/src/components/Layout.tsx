import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  Cable,
  CircleDashed,
  Database,
  Sparkles,
  SquareTerminal,
} from 'lucide-react'
import { cn } from '../lib/utils'
import DevelopmentModule, {
  type DevelopmentAiPayload,
} from './DevelopmentModule'

type TableType = 'integration' | 'development'
type GlobalAppModule = 'connections' | 'develop' | 'integrate'
type TabType = 'preview' | 'schema' | 'config'

type Mapping = {
  sourceField: string
  targetField: string
  type: string
  isMasked: boolean
}

type TableResource = {
  id: string
  name: string
  type: TableType
  source: string
  target: string
  mappings: Mapping[]
  sql: string
  status: 'draft' | 'ready' | 'deployed'
}

type Receipt = {
  id: string
  kind: 'integration' | 'development' | 'security' | 'e2e'
  title: string
  summary: string
  payload: unknown
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  type: 'text' | 'loading' | 'card'
  content?: string
  payload?: Receipt
  steps?: ExecutionStep[]
}

type StepStatus = 'pending' | 'running' | 'success'
type ExecutionStep = {
  id: string
  label: string
  status: StepStatus
}

type DataSourceResource = {
  id: string
  name: string
  engine: 'MySQL'
  host: string
  database: string
  username: string
  password: string
  status: 'draft' | 'ready'
}

type ConnectionEngine = 'MySQL' | 'PostgreSQL' | 'Kafka'

type ConnectionResource = {
  id: string
  name: string
  engine: ConnectionEngine
  host: string
  database: string
  username: string
  password: string
  status: 'draft' | 'ready'
  detail: string
  source: 'managed' | 'mock'
}

type E2EPayload = {
  dataSource: DataSourceResource
  table: TableResource
  scheduling: {
    mode: 'full'
    partition: 'daily'
    execution: 'one-shot'
    autoMapping: true
  }
}

type PipelineStatus = 'draft' | 'running' | 'ready'

type PipelineResource = {
  id: string
  name: string
  detail: string
  cadence: string
  status: PipelineStatus
  tableId?: string
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

const defaultTable: TableResource = {
  id: 'ods_seed_orders',
  name: 'ods_seed_orders',
  type: 'integration',
  source: 'seed_mysql.orders',
  target: 'warehouse.ods_seed_orders',
  mappings: [
    { sourceField: 'order_id', targetField: 'order_id', type: 'BIGINT', isMasked: false },
    { sourceField: 'user_phone', targetField: 'user_phone', type: 'STRING', isMasked: true },
    { sourceField: 'amount', targetField: 'amount', type: 'DECIMAL(18,2)', isMasked: false },
  ],
  sql: '',
  status: 'ready',
}

const defaultDevTable: TableResource = {
  id: 'dws_user_profile',
  name: 'dws_user_profile',
  type: 'development',
  source: 'warehouse.dwd_user_events',
  target: 'warehouse.dws_user_profile',
  mappings: [],
  sql: `SELECT
  user_id,
  max(last_login_time) AS last_login_time,
  count(1) AS active_days
FROM dwd_user_events
GROUP BY user_id;`,
  status: 'ready',
}

const previewRows = Array.from({ length: 10 }).map((_, index) => ({
  order_id: `${10001 + index}`,
  user_phone: `13${index}****${8800 + index}`,
  amount: `${(index + 1) * 37}.00`,
}))

const SIDEBAR_PANEL_CLASS = 'rounded-2xl border border-white/10 bg-white/[0.03]'
const SIDEBAR_ITEM_BASE_CLASS =
  'w-full rounded-xl border px-3 py-2 text-left transition'
const SIDEBAR_ITEM_IDLE_CLASS =
  'border-white/10 bg-black/10 text-slate-300 hover:border-cyan-300/40 hover:bg-cyan-400/10'
const SIDEBAR_ITEM_ACTIVE_CLASS =
  'border-cyan-300/60 bg-cyan-400/15 text-cyan-100 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]'

const MODULE_OPTIONS = [
  { id: 'connections', label: '数据连接', description: 'Connections', icon: Database },
  { id: 'develop', label: '数据开发', description: 'Develop', icon: SquareTerminal },
  { id: 'integrate', label: '数据集成', description: 'Integrate', icon: Cable },
] as const

const DATA_SOURCE_STATUS_LABEL = {
  draft: '待注册',
  ready: '已注册',
} as const

const DATA_SOURCE_STATUS_CLASS = {
  draft: 'border-amber-300/20 bg-amber-400/10 text-amber-200',
  ready: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
} as const

const PIPELINE_STATUS_LABEL = {
  draft: '待编排',
  running: '运行中',
  ready: '已发布',
} as const

const PIPELINE_STATUS_CLASS = {
  draft: 'border-amber-300/20 bg-amber-400/10 text-amber-200',
  running: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-200',
  ready: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
} as const

function Layout() {
  const [tables, setTables] = useState<TableResource[]>([
    defaultTable,
    defaultDevTable,
  ])
  const [dataSources, setDataSources] = useState<DataSourceResource[]>([
    {
      id: 'mysql_seed',
      name: 'MySQL_CRM_Seed',
      engine: 'MySQL',
      host: 'crm-prod.internal:3306',
      database: 'crm',
      username: 'readonly',
      password: '********',
      status: 'ready',
    },
  ])
  const [activeApp, setActiveApp] = useState<GlobalAppModule>('connections')
  const [activeConnectionId, setActiveConnectionId] = useState('mysql_seed')
  const [activePipelineId, setActivePipelineId] = useState('pipe_mysql_hive_full')
  const [activeTableId, setActiveTableId] = useState(defaultTable.id)
  const [activeTab, setActiveTab] = useState<TabType>('preview')
  const [unsavedTableIds, setUnsavedTableIds] = useState<Record<string, boolean>>({})
  const [commandInput, setCommandInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [workspaceSplitMode, setWorkspaceSplitMode] = useState<
    'none' | 'e2e-review'
  >('none')
  const [e2eHighlight, setE2eHighlight] = useState<Record<string, boolean>>({})
  const [devAiPayload, setDevAiPayload] = useState<DevelopmentAiPayload | null>(
    null,
  )

  const activeTable = useMemo(
    () => tables.find((table) => table.id === activeTableId) ?? tables[0],
    [activeTableId, tables],
  )

  const connectionResources = useMemo<ConnectionResource[]>(
    () => [
      ...dataSources.map((dataSource) => ({
        ...dataSource,
        detail: `${dataSource.host} · ${dataSource.database}`,
        source: 'managed' as const,
      })),
      {
        id: 'postgres_growth_analytics',
        name: 'PostgreSQL_Growth_Analytics',
        engine: 'PostgreSQL',
        host: 'growth-bi.internal:5432',
        database: 'analytics',
        username: 'bi_reader',
        password: '********',
        status: 'ready',
        detail: 'growth-bi.internal:5432 · analytics',
        source: 'mock',
      },
      {
        id: 'kafka_orders_stream',
        name: 'Kafka_Orders_Stream',
        engine: 'Kafka',
        host: 'broker-a.internal:9092',
        database: 'topic.orders_rt',
        username: 'stream_reader',
        password: '********',
        status: 'draft',
        detail: 'broker-a.internal:9092 · topic.orders_rt',
        source: 'mock',
      },
    ],
    [dataSources],
  )

  const activeConnection = useMemo(
    () =>
      connectionResources.find((connection) => connection.id === activeConnectionId)
      ?? connectionResources[0],
    [activeConnectionId, connectionResources],
  )

  const integratePipelines = useMemo<PipelineResource[]>(() => {
    const integrationTable = tables.find((table) => table.type === 'integration')
    const developmentTable = tables.find((table) => table.type === 'development')

    return [
      {
        id: 'pipe_mysql_hive_full',
        name: 'MySQL -> Hive 全量同步',
        detail: integrationTable
          ? `${integrationTable.source} -> ${integrationTable.target}`
          : 'seed_mysql.orders -> warehouse.ods_seed_orders',
        cadence: 'T+1 / Full Load',
        status: integrationTable?.status === 'draft' ? 'draft' : 'ready',
        tableId: integrationTable?.id,
      },
      {
        id: 'pipe_kafka_realtime',
        name: 'Kafka 实时摄入',
        detail: 'Kafka_Orders_Stream -> lakehouse.dwd_orders_rt',
        cadence: 'Streaming / Seconds',
        status: 'running',
      },
      {
        id: 'pipe_profile_delivery',
        name: '用户画像结果分发',
        detail: developmentTable
          ? `${developmentTable.target} -> serving.user_profile_api`
          : 'warehouse.dws_user_profile -> serving.user_profile_api',
        cadence: 'Hourly / Incremental',
        status: 'draft',
        tableId: developmentTable?.id,
      },
    ]
  }, [tables])

  const activePipeline = useMemo(
    () => integratePipelines.find((pipeline) => pipeline.id === activePipelineId) ?? integratePipelines[0],
    [activePipelineId, integratePipelines],
  )

  const renderSidebarPanel = () => {
    if (activeApp === 'connections') {
      return (
        <div className={cn(SIDEBAR_PANEL_CLASS, 'p-3')}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Connection Registry
              </p>
              <p className="mt-1 text-xs text-slate-300">连接资源树与注册状态</p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-100">
              {connectionResources.length}
            </span>
          </div>

          <div className="space-y-2">
            {connectionResources.map((resource) => {
              const ResourceIcon = resource.engine === 'Kafka' ? Cable : Database
              const isActive = activeConnectionId === resource.id

              return (
                <button
                  key={resource.id}
                  onClick={() => {
                    setActiveConnectionId(resource.id)
                    setActiveApp('connections')
                  }}
                  className={cn(
                    SIDEBAR_ITEM_BASE_CLASS,
                    SIDEBAR_ITEM_IDLE_CLASS,
                    isActive && SIDEBAR_ITEM_ACTIVE_CLASS,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ResourceIcon
                          className={cn(
                            'h-3.5 w-3.5 shrink-0',
                            resource.engine === 'Kafka' ? 'text-cyan-200' : 'text-cyan-300',
                          )}
                        />
                        <span className="truncate text-xs font-medium">{resource.name}</span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-slate-500">{resource.detail}</p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full border px-1.5 py-0.5 text-[10px]',
                        DATA_SOURCE_STATUS_CLASS[resource.status],
                      )}
                    >
                      {DATA_SOURCE_STATUS_LABEL[resource.status]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    <span>{resource.engine}</span>
                    <span>{resource.source === 'managed' ? 'Managed' : 'Mocked'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    if (activeApp === 'integrate') {
      return (
        <div className={cn(SIDEBAR_PANEL_CLASS, 'p-3')}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Integration Pipelines
              </p>
              <p className="mt-1 text-xs text-slate-300">调度、同步与分发工作流</p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-100">
              {integratePipelines.length}
            </span>
          </div>

          <div className="space-y-2">
            {integratePipelines.map((pipeline) => {
              const isActive = activePipelineId === pipeline.id

              return (
                <button
                  key={pipeline.id}
                  onClick={() => {
                    setActivePipelineId(pipeline.id)
                    setActiveApp('integrate')
                    if (pipeline.tableId) {
                      setActiveTableId(pipeline.tableId)
                    }
                  }}
                  className={cn(
                    SIDEBAR_ITEM_BASE_CLASS,
                    SIDEBAR_ITEM_IDLE_CLASS,
                    isActive && SIDEBAR_ITEM_ACTIVE_CLASS,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Cable className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                        <span className="truncate text-xs font-medium">{pipeline.name}</span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-slate-500">{pipeline.detail}</p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full border px-1.5 py-0.5 text-[10px]',
                        PIPELINE_STATUS_CLASS[pipeline.status],
                      )}
                    >
                      {PIPELINE_STATUS_LABEL[pipeline.status]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    <span>{pipeline.cadence}</span>
                    <span>{pipeline.tableId ? 'Linked' : 'Standalone'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className={cn(SIDEBAR_PANEL_CLASS, 'p-3')}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Develop Objects
              </p>
              <p className="mt-1 text-xs text-slate-300">表对象、预览与逻辑编辑入口</p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-100">
              {tables.length}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {tables.map((table) => (
            <button
              key={table.id}
              onClick={() => {
                handleSelectTable(table.id)
                setActiveApp('develop')
              }}
              className={cn(
                SIDEBAR_ITEM_BASE_CLASS,
                SIDEBAR_ITEM_IDLE_CLASS,
                activeTableId === table.id && SIDEBAR_ITEM_ACTIVE_CLASS,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  {table.type === 'integration' ? (
                    <Cable className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                  ) : (
                    <SquareTerminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{table.name}</div>
                    <p className="mt-1 truncate text-[11px] text-slate-500">{table.target}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    'rounded-full border px-1.5 py-0.5 text-[10px]',
                    unsavedTableIds[table.id]
                      ? 'border-amber-300/20 bg-amber-400/10 text-amber-200'
                      : 'border-white/10 bg-white/5 text-slate-400',
                  )}
                >
                  {unsavedTableIds[table.id]
                    ? 'Draft'
                    : table.type === 'integration'
                      ? 'Preview'
                      : 'SQL'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
                <span>{table.type === 'integration' ? 'Table Object' : 'Logic Object'}</span>
                <span>{table.status === 'draft' ? 'Pending' : 'Ready'}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const updateActiveTable = (updater: (table: TableResource) => TableResource) => {
    setTables((prev) =>
      prev.map((table) => (table.id === activeTableId ? updater(table) : table)),
    )
    setUnsavedTableIds((prev) => ({ ...prev, [activeTableId]: true }))
  }

  const updateActiveConnection = (
    updater: (connection: DataSourceResource) => DataSourceResource,
  ) => {
    setDataSources((prev) =>
      prev.map((connection) =>
        connection.id === activeConnectionId ? updater(connection) : connection,
      ),
    )
  }

  const handleSelectTable = (id: string) => {
    setActiveTableId(id)
    setActiveTab('preview')
    setActiveApp('develop')
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

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
        ],
        sql: '',
        status: 'draft',
      },
    }

    const developmentReceipt: Receipt = {
      id: crypto.randomUUID(),
      kind: 'development',
      title: '✨ 开发逻辑推演完成',
      summary: '已生成相应的声明式 SQL 脚本抽象结构。',
      payload: {
        id: 'dws_customer_report',
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
      },
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

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

  const routeIntent = (userInput: string): Receipt['kind'] => {
    const inputLower = userInput.toLowerCase()
    const isIntegration = ['同步', '映射', '接入', 'mysql', '抽取'].some((keyword) =>
      inputLower.includes(keyword),
    )
    const isDevelopment = ['sql', '统计', '报表', '分析', '模型', '计算', '处理'].some(
      (keyword) => inputLower.includes(keyword),
    )
    const isSecurity = ['脱敏', 'mask', '手机号', '身份证', 'id card', 'idcard'].some(
      (keyword) => inputLower.includes(keyword),
    )

    const hasIp = /\b(\d{1,3}\.){3}\d{1,3}\b/.test(inputLower)
    const isE2E = ['连', '连接', '线上', 'salesdb', 'db', 'order_detail'].some((k) =>
      inputLower.includes(k),
    )
      && ['全量', '按天', '同步', 'ods'].some((k) => inputLower.includes(k))
      && hasIp

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

  const createReceiptByRoutedIntent = (
    routedKind: Receipt['kind'],
    userText: string,
  ): Receipt => {
    if (routedKind === 'e2e') {
      const ip =
        userText.match(/\b(\d{1,3}\.){3}\d{1,3}\b/)?.[0] ?? '10.0.0.8'
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

      const payload: E2EPayload = {
        dataSource,
        table,
        scheduling: {
          mode: 'full',
          partition: 'daily',
          execution: 'one-shot',
          autoMapping: true,
        },
      }

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
        steps.map((step, idx) =>
          idx === index ? { ...step, status: 'running' } : step,
        ),
      )
      await sleep(600 + Math.floor(Math.random() * 401))
      updateMessageSteps(loadingId, (steps) =>
        steps.map((step, idx) =>
          idx === index ? { ...step, status: 'success' } : step,
        ),
      )
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === loadingId
          ? { ...m, type: 'card', content: undefined, payload: receipt }
          : m,
      ),
    )
    setIsProcessing(false)
  }

  const applyReceipt = (receipt: Receipt) => {
    // TODO:[AI_AGENT_BACKEND_HOOK] 在这里接入配置应用审计与后端落库
    if (receipt.kind === 'e2e') {
      const payload = receipt.payload as E2EPayload
      // left tree: add/spot datasource draft
      setDataSources((prev) => {
        const exists = prev.some((ds) => ds.id === payload.dataSource.id)
        if (exists) {
          return prev.map((ds) => (ds.id === payload.dataSource.id ? payload.dataSource : ds))
        }
        return [...prev, payload.dataSource]
      })
      // upsert table draft
      setTables((prev) => {
        const exists = prev.some((table) => table.id === payload.table.id)
        if (exists) {
          return prev.map((table) => (table.id === payload.table.id ? payload.table : table))
        }
        return [...prev, payload.table]
      })
      // open config and show split review
      setActiveConnectionId(payload.dataSource.id)
      setActiveApp('connections')
      setActiveTableId(payload.table.id)
      setActiveTab('config')
      setWorkspaceSplitMode('e2e-review')
      setUnsavedTableIds((prev) => ({ ...prev, [payload.table.id]: true }))
      setE2eHighlight({
        host: true,
        username: true,
        database: true,
        source: true,
        target: true,
        mappings: true,
      })
      return
    }

    const payload = receipt.payload as TableResource
    setTables((prev) => {
      const exists = prev.some((table) => table.id === payload.id)
      if (exists) {
        return prev.map((table) => (table.id === payload.id ? payload : table))
      }
      return [...prev, payload]
    })
    setActiveTableId(payload.id)
    setActiveTab('config')
    setWorkspaceSplitMode('none')
    setUnsavedTableIds((prev) => ({ ...prev, [payload.id]: true }))

    if (receipt.kind === 'development') {
      setActiveApp('develop')
      setDevAiPayload({
        taskName: payload.name,
        engine: 'Spark',
        schedule: 'Daily',
        code: payload.sql,
        sourceSchema: {
          table: payload.source,
          columns: [
            { name: 'customer_id', type: 'BIGINT' },
            { name: 'order_amount', type: 'DECIMAL(18,2)' },
            { name: 'order_time', type: 'TIMESTAMP' },
          ],
        },
        outputSchema: {
          table: payload.target,
          columns: [
            { name: 'customer_id', type: 'BIGINT' },
            { name: 'order_cnt', type: 'BIGINT' },
            { name: 'total_amount', type: 'DECIMAL(18,2)' },
          ],
        },
      })
      return
    }
    setActiveApp('integrate')
    setDevAiPayload(null)
  }

  const handleSave = () => {
    // TODO:[AI_AGENT_BACKEND_HOOK] 在这里接入保存 API
    setUnsavedTableIds((prev) => ({ ...prev, [activeTableId]: false }))
  }

  const schemaRows = activeTable.type === 'integration'
    ? activeTable.mappings.map((mapping, idx) => ({
        id: `${mapping.targetField}-${idx}`,
        field: mapping.targetField || `field_${idx + 1}`,
        type: mapping.type || 'STRING',
      }))
    : [
        { id: 'user_id', field: 'user_id', type: 'BIGINT' },
        { id: 'last_active_date', field: 'last_active_date', type: 'DATE' },
        { id: 'retained_users_30d', field: 'retained_users_30d', type: 'INT' },
      ]

  const isManagedConnection = activeConnection?.source === 'managed'
  const linkedPipelineTable = activePipeline?.tableId
    ? tables.find((table) => table.id === activePipeline.tableId) ?? null
    : null

  const renderConnectionsWorkspace = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div>
          <div className="text-xs text-slate-500">Connections / {activeConnection.name}</div>
          <div className="mt-1 text-sm font-medium text-slate-100">
            数据连接注册表单与网络预览
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full border px-2 py-1 text-[11px]',
              DATA_SOURCE_STATUS_CLASS[activeConnection.status],
            )}
          >
            {DATA_SOURCE_STATUS_LABEL[activeConnection.status]}
          </span>
          <button className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">
            测试连接
          </button>
          <button className="rounded-lg border border-cyan-300/50 bg-cyan-400/20 px-3 py-1.5 text-xs text-cyan-100">
            注册入库
          </button>
        </div>
      </div>

      <div className="h-[calc(100vh-8.8rem)] overflow-y-auto p-5">
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-4 flex items-center gap-2 text-xs text-cyan-200">
              <Database className="h-4 w-4" />
              Connection Definition
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">连接名称</span>
                <input
                  value={activeConnection.name}
                  readOnly={!isManagedConnection}
                  onChange={(e) => {
                    if (!isManagedConnection) return
                    updateActiveConnection((connection) => ({
                      ...connection,
                      name: e.target.value,
                    }))
                  }}
                  className="h-10 rounded-xl border border-white/15 bg-slate-900/90 px-3 outline-none"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">引擎类型</span>
                <input
                  value={activeConnection.engine}
                  readOnly
                  className="h-10 rounded-xl border border-white/15 bg-slate-900/90 px-3 text-slate-400 outline-none"
                />
              </label>
              <label className="col-span-2 space-y-1 text-xs">
                <span className="text-slate-400">Host / Broker</span>
                <input
                  value={activeConnection.host}
                  readOnly={!isManagedConnection}
                  onChange={(e) => {
                    if (!isManagedConnection) return
                    updateActiveConnection((connection) => ({
                      ...connection,
                      host: e.target.value,
                    }))
                  }}
                  className="h-10 rounded-xl border border-white/15 bg-slate-900/90 px-3 outline-none"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">
                  {activeConnection.engine === 'Kafka' ? 'Topic' : 'Database'}
                </span>
                <input
                  value={activeConnection.database}
                  readOnly={!isManagedConnection}
                  onChange={(e) => {
                    if (!isManagedConnection) return
                    updateActiveConnection((connection) => ({
                      ...connection,
                      database: e.target.value,
                    }))
                  }}
                  className="h-10 rounded-xl border border-white/15 bg-slate-900/90 px-3 outline-none"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">用户名</span>
                <input
                  value={activeConnection.username}
                  readOnly={!isManagedConnection}
                  onChange={(e) => {
                    if (!isManagedConnection) return
                    updateActiveConnection((connection) => ({
                      ...connection,
                      username: e.target.value,
                    }))
                  }}
                  className="h-10 rounded-xl border border-white/15 bg-slate-900/90 px-3 outline-none"
                />
              </label>
              <label className="col-span-2 space-y-1 text-xs">
                <span className="text-slate-400">连接密钥</span>
                <input
                  value={activeConnection.password}
                  readOnly
                  className="h-10 rounded-xl border border-white/15 bg-slate-900/90 px-3 text-slate-400 outline-none"
                />
              </label>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.07] p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">
                Network View
              </div>
              <div className="mt-3 space-y-3 text-xs text-slate-300">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-slate-500">Endpoint</div>
                  <div className="mt-1 font-medium text-slate-100">{activeConnection.host}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-slate-500">Logical Target</div>
                  <div className="mt-1 font-medium text-slate-100">{activeConnection.database}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-slate-500">Run Mode</div>
                  <div className="mt-1 font-medium text-slate-100">
                    {activeConnection.engine === 'Kafka' ? 'Streaming Listener' : 'JDBC Registration'}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Connection Insights
              </div>
              <div className="mt-3 space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-slate-400">认证主体</span>
                  <span className="text-slate-100">{activeConnection.username}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-slate-400">资源来源</span>
                  <span className="text-slate-100">
                    {activeConnection.source === 'managed' ? 'Workspace Managed' : 'Mocked Fixture'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-slate-400">健康状态</span>
                  <span className={cn(
                    'font-medium',
                    activeConnection.status === 'ready' ? 'text-emerald-200' : 'text-amber-200',
                  )}>
                    {activeConnection.status === 'ready' ? 'Reachable' : 'Awaiting Registration'}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )

  const renderDevelopmentWorkspace = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="text-xs text-slate-300">Develop / {activeTable.name}</div>
        <div className="flex items-center gap-2">
          {unsavedTableIds[activeTableId] && (
            <span className="rounded-md border border-rose-300/40 bg-rose-400/20 px-2 py-1 text-[11px] text-rose-200">
              Unsaved
            </span>
          )}
          <button
            onClick={handleSave}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            保存
          </button>
          <button className="rounded-lg border border-emerald-300/50 bg-emerald-400/20 px-3 py-1.5 text-xs text-emerald-100">
            部署
          </button>
        </div>
      </div>

      <div className="h-[calc(100vh-8.8rem)] overflow-y-auto p-5">
        <div className="mb-4 flex gap-2">
          {[
            { id: 'preview', label: 'Data Preview' },
            { id: 'schema', label: 'Schema' },
            {
              id: 'config',
              label: activeTable.type === 'integration' ? 'Configuration' : '逻辑编辑',
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs transition',
                activeTab === tab.id
                  ? 'border-cyan-300/60 bg-cyan-400/20 text-cyan-100'
                  : 'border-white/20 bg-white/5 text-slate-300 hover:bg-white/10',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'preview' && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
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
        )}

        {activeTab === 'schema' && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
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
        )}

        {activeTab === 'config' &&
          (activeTable.type === 'integration' ? (
            <div className="space-y-4">
              {workspaceSplitMode === 'e2e-review' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.06] p-4">
                    <div className="mb-3 text-xs font-semibold text-emerald-200">
                      Data Source Draft
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1 text-xs">
                        <span className="text-slate-400">Host</span>
                        <input
                          value={dataSources.find((d) => d.id === 'MySQL_Sales_Online')?.host ?? ''}
                          readOnly
                          className={cn(
                            'h-9 rounded-lg border bg-slate-900/90 px-2 text-xs outline-none',
                            e2eHighlight.host
                              ? 'border-emerald-300/60 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
                              : 'border-white/20',
                          )}
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-slate-400">Database</span>
                        <input
                          value={
                            dataSources.find((d) => d.id === 'MySQL_Sales_Online')?.database ?? ''
                          }
                          readOnly
                          className={cn(
                            'h-9 rounded-lg border bg-slate-900/90 px-2 text-xs outline-none',
                            e2eHighlight.database
                              ? 'border-emerald-300/60 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
                              : 'border-white/20',
                          )}
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-slate-400">Username</span>
                        <input
                          value={
                            dataSources.find((d) => d.id === 'MySQL_Sales_Online')?.username ?? ''
                          }
                          readOnly
                          className={cn(
                            'h-9 rounded-lg border bg-slate-900/90 px-2 text-xs outline-none',
                            e2eHighlight.username
                              ? 'border-emerald-300/60 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
                              : 'border-white/20',
                          )}
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-slate-400">Status</span>
                        <input
                          value="待注册"
                          readOnly
                          className="h-9 rounded-lg border border-white/20 bg-slate-900/90 px-2 text-xs text-slate-300 outline-none"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 text-xs font-semibold text-cyan-200">
                      Integration Task Draft
                    </div>
                    <div className="text-[11px] text-slate-400">
                      全量覆盖 / 一次性执行 / 按天分区 / 自动映射字段
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs text-cyan-200">
                  <Database className="h-4 w-4" />
                  Pipeline Configuration
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={activeTable.source}
                    onChange={(e) =>
                      updateActiveTable((table) => ({ ...table, source: e.target.value }))
                    }
                    className={cn(
                      'h-9 rounded-lg border bg-slate-900/90 px-2 text-xs outline-none',
                      e2eHighlight.source
                        ? 'border-emerald-300/60 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
                        : 'border-white/20',
                    )}
                  />
                  <input
                    value={activeTable.target}
                    onChange={(e) =>
                      updateActiveTable((table) => ({ ...table, target: e.target.value }))
                    }
                    className={cn(
                      'h-9 rounded-lg border bg-slate-900/90 px-2 text-xs outline-none',
                      e2eHighlight.target
                        ? 'border-emerald-300/60 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
                        : 'border-white/20',
                    )}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="mb-3 text-xs text-slate-300">Schema Mappings</p>
                <div className="space-y-2">
                  {activeTable.mappings.map((mapping, index) => (
                    <div
                      key={`${mapping.sourceField}-${index}`}
                      className="grid grid-cols-[1.1fr_1.1fr_0.9fr_0.6fr] gap-2"
                    >
                      <input
                        value={mapping.sourceField}
                        onChange={(e) =>
                          updateActiveTable((table) => ({
                            ...table,
                            mappings: table.mappings.map((item, idx) =>
                              idx === index ? { ...item, sourceField: e.target.value } : item,
                            ),
                          }))
                        }
                        className={cn(
                          'h-8 rounded-lg border bg-slate-900/90 px-2 text-xs outline-none',
                          e2eHighlight.mappings ? 'border-emerald-300/40' : 'border-white/20',
                        )}
                      />
                      <input
                        value={mapping.targetField}
                        onChange={(e) =>
                          updateActiveTable((table) => ({
                            ...table,
                            mappings: table.mappings.map((item, idx) =>
                              idx === index ? { ...item, targetField: e.target.value } : item,
                            ),
                          }))
                        }
                        className={cn(
                          'h-8 rounded-lg border bg-slate-900/90 px-2 text-xs outline-none',
                          e2eHighlight.mappings ? 'border-emerald-300/40' : 'border-white/20',
                        )}
                      />
                      <input
                        value={mapping.type}
                        onChange={(e) =>
                          updateActiveTable((table) => ({
                            ...table,
                            mappings: table.mappings.map((item, idx) =>
                              idx === index ? { ...item, type: e.target.value } : item,
                            ),
                          }))
                        }
                        className={cn(
                          'h-8 rounded-lg border bg-slate-900/90 px-2 text-xs outline-none',
                          e2eHighlight.mappings ? 'border-emerald-300/40' : 'border-white/20',
                        )}
                      />
                      <label className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/20 bg-slate-900/80 px-2 text-xs">
                        <input
                          type="checkbox"
                          checked={mapping.isMasked}
                          onChange={(e) =>
                            updateActiveTable((table) => ({
                              ...table,
                              mappings: table.mappings.map((item, idx) =>
                                idx === index ? { ...item, isMasked: e.target.checked } : item,
                              ),
                            }))
                          }
                          className="h-3.5 w-3.5 accent-cyan-400"
                        />
                        mask
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[72vh] min-h-[620px]">
              <DevelopmentModule
                aiPayload={devAiPayload}
                onAiPayloadConsumed={() => setDevAiPayload(null)}
              />
            </div>
          ))}
      </div>
    </div>
  )

  const renderIntegrationWorkspace = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div>
          <div className="text-xs text-slate-500">Integrate / {activePipeline.name}</div>
          <div className="mt-1 text-sm font-medium text-slate-100">Pipeline 编排工作区</div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full border px-2 py-1 text-[11px]',
              PIPELINE_STATUS_CLASS[activePipeline.status],
            )}
          >
            {PIPELINE_STATUS_LABEL[activePipeline.status]}
          </span>
          <button className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">
            保存草案
          </button>
          <button className="rounded-lg border border-emerald-300/50 bg-emerald-400/20 px-3 py-1.5 text-xs text-emerald-100">
            发布任务
          </button>
        </div>
      </div>

      <div className="h-[calc(100vh-8.8rem)] overflow-y-auto p-5 space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-4 flex items-center gap-2 text-xs text-cyan-200">
              <Cable className="h-4 w-4" />
              Pipeline Canvas
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { title: 'Source', value: activePipeline.detail.split(' -> ')[0] ?? activePipeline.detail },
                { title: 'Transform', value: linkedPipelineTable ? linkedPipelineTable.name : 'Pipeline Rules' },
                { title: 'Target', value: activePipeline.detail.split(' -> ')[1] ?? 'delivery.endpoint' },
              ].map((node) => (
                <div
                  key={node.title}
                  className="rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.07] p-4"
                >
                  <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">
                    {node.title}
                  </div>
                  <div className="mt-3 text-sm font-medium text-slate-100">{node.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                '连接源端并验证凭证',
                '执行映射/清洗/聚合逻辑',
                '按策略投递至目标域',
              ].map((step, index) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] text-slate-500">Step 0{index + 1}</div>
                  <div className="mt-2 text-sm text-slate-100">{step}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Orchestration Facts
              </div>
              <div className="mt-3 space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-slate-400">Cadence</span>
                  <span className="text-slate-100">{activePipeline.cadence}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-slate-400">Routing</span>
                  <span className="text-slate-100">
                    {linkedPipelineTable ? linkedPipelineTable.target : 'Standalone Delivery'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-slate-400">Topology</span>
                  <span className="text-slate-100">
                    {activePipeline.status === 'running' ? 'Streaming' : 'Batch'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Linked Object
              </div>
              {linkedPipelineTable ? (
                <div className="mt-3 space-y-3 text-xs">
                  <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/[0.07] p-3">
                    <div className="text-slate-400">Object Name</div>
                    <div className="mt-1 text-sm font-medium text-slate-100">
                      {linkedPipelineTable.name}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-slate-400">Source</div>
                    <div className="mt-1 text-slate-100">{linkedPipelineTable.source}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-slate-400">Target</div>
                    <div className="mt-1 text-slate-100">{linkedPipelineTable.target}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
                  当前 Pipeline 仍为独立占位流，尚未绑定具体表对象。
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )

  const renderCenterWorkspace = () => {
    if (activeApp === 'connections') return renderConnectionsWorkspace()
    if (activeApp === 'integrate') return renderIntegrationWorkspace()
    return renderDevelopmentWorkspace()
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <section className="flex-1 p-6 pr-4">
          <div className="flex h-[calc(100vh-3rem)] rounded-3xl border border-white/10 bg-white/[0.03]">
            <aside className="w-72 border-r border-white/10 bg-black/20 p-4">
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                <div className="grid grid-cols-3 gap-1">
                  {MODULE_OPTIONS.map((module) => {
                    const Icon = module.icon
                    const isActive = activeApp === module.id

                    return (
                      <button
                        key={module.id}
                        onClick={() => setActiveApp(module.id)}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center transition',
                          isActive
                            ? 'border border-cyan-300/60 bg-cyan-400/15 text-cyan-100 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]'
                            : 'border border-transparent bg-transparent text-slate-500 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-200',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <div className="leading-tight">
                          <div className="text-[11px] font-medium">{module.label}</div>
                          <div className="text-[10px] opacity-70">{module.description}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {renderSidebarPanel()}
            </aside>

            <div className="min-w-0 flex-1">{renderCenterWorkspace()}</div>
          </div>
        </section>

        <aside className="w-[380px] shrink-0 p-5 pl-0">
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
                  <p className="mb-3 text-xs text-slate-300">
                    试试这些快捷场景（回车也可直接下达指令）：
                  </p>
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
                                  step.status === 'pending'
                                    ? 'bg-slate-600'
                                    : 'bg-slate-400',
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
                              <span className="text-emerald-200">
                                MySQL_Sales_Online (待注册)
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>🗄️ 目标表</span>
                              <span className="text-cyan-200">
                                ods_order_detail (待新建)
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>🔄 调度策略</span>
                              <span className="text-slate-300">
                                全量覆盖 / 一次性执行 / 自动映射字段
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => applyReceipt(receipt)}
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
              <input
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSubmitCommand()
                }}
                placeholder="输入指令并按回车..."
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs outline-none placeholder:text-slate-400"
              />
            </footer>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default Layout
