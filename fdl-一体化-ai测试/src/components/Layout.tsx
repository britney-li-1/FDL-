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
import { type DevelopmentAiPayload } from './DevelopmentModule'
import DbtReadEditDevelopmentWorkspace, {
  type DbtRealState,
  type MaterializationMode,
} from './DbtReadEditDevelopmentWorkspace'

type TableType = 'integration' | 'development'
type GlobalAppModule = 'connections' | 'develop' | 'integrate'

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
  materializationStrategy?: MaterializationMode
  scheduleCron?: string
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
  id: 'dim_user_profile',
  name: 'dim_user_profile',
  type: 'development',
  source: 'ecommerce_dw.stg_user_profile_events',
  target: 'ecommerce_dw.dim_user_profile',
  mappings: [],
  materializationStrategy: 'view',
  scheduleCron: '0 3 * * *',
  sql: `WITH latest AS (
  SELECT
    user_id,
    region,
    latest_login_time,
    status,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY latest_login_time DESC) AS rn
  FROM ecommerce_dw.stg_user_profile_events
  WHERE status IN ('active', 'inactive')
),
deduped AS (
  SELECT
    user_id,
    region,
    latest_login_time,
    status
  FROM latest
  WHERE rn = 1
)
SELECT
  user_id,
  region,
  latest_login_time,
  status
FROM deduped;`,
  status: 'ready',
}

const defaultDwdOrderDetail: TableResource = {
  id: 'dwd_order_detail',
  name: 'dwd_order_detail',
  type: 'development',
  source: 'ecommerce_dw.stg_orders_raw',
  target: 'ecommerce_dw.dwd_order_detail',
  mappings: [],
  materializationStrategy: 'incremental',
  scheduleCron: '0 1 * * *',
  sql: `WITH cleaned AS (
  SELECT
    CAST(order_id AS BIGINT) AS order_id,
    CAST(user_id AS BIGINT) AS user_id,
    CAST(amount AS DECIMAL(18,2)) AS amount,
    order_status,
    CAST(dt AS DATE) AS dt
  FROM ecommerce_dw.stg_orders_raw
  WHERE order_id IS NOT NULL
    AND user_id IS NOT NULL
    AND amount IS NOT NULL
),
valid AS (
  SELECT
    order_id,
    user_id,
    amount,
    order_status,
    dt
  FROM cleaned
  WHERE order_status IN ('paid', 'completed')
    AND amount > 0
)
SELECT
  order_id,
  user_id,
  amount,
  order_status,
  dt
FROM valid;`,
  status: 'ready',
}

const defaultDwsRegionalUserActivitySummary: TableResource = {
  id: 'dws_regional_user_activity_summary',
  name: 'dws_regional_user_activity_summary',
  type: 'development',
  source: 'ecommerce_dw.dim_user_profile + ecommerce_dw.dwd_order_detail',
  target: 'ecommerce_dw.dws_regional_user_activity_summary',
  mappings: [],
  materializationStrategy: 'incremental',
  scheduleCron: '0 2 * * *',
  sql: `WITH active_users AS (
  SELECT
    user_id,
    region,
    latest_login_time
  FROM ecommerce_dw.dim_user_profile
  WHERE latest_login_time >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
    AND status = 'active'
),
valid_orders AS (
  SELECT
    order_id,
    user_id,
    amount
  FROM ecommerce_dw.dwd_order_detail
  WHERE order_status IN ('paid', 'completed')
    AND amount > 0
),
agg AS (
  SELECT
    au.region,
    COUNT(DISTINCT au.user_id) AS usr_cnt,
    SUM(vo.amount) AS total_order_amount,
    CASE
      WHEN SUM(vo.amount) > 10000 THEN 1 ELSE 0
    END AS high_value_user_flag
  FROM active_users au
  LEFT JOIN valid_orders vo
    ON au.user_id = vo.user_id
  GROUP BY au.region
)
SELECT
  region,
  usr_cnt,
  total_order_amount,
  high_value_user_flag
FROM agg
WHERE region IS NOT NULL
ORDER BY total_order_amount DESC;`,
  status: 'ready',
}

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
    defaultDwdOrderDetail,
    defaultDwsRegionalUserActivitySummary,
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
  const [activeTableId, setActiveTableId] = useState(defaultDevTable.id)
  const [, setUnsavedTableIds] = useState<Record<string, boolean>>({})
  // 数据开发：上下文锁定（Data Source / Connection）
  const [devDataSourceId, setDevDataSourceId] = useState(dataSources[0]?.id ?? 'mysql_seed')
  const [expandedDatabases, setExpandedDatabases] = useState<Record<string, boolean>>({
    ecommerce_dw: true,
  })
  const [commandInput, setCommandInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  // 仅用于 e2e 推演回填的“闪烁/差异提示”状态
  // （当前已在开发主工作区移除使用，因此只保留 setter，避免未使用变量报错）
  const [, setWorkspaceSplitMode] = useState<'none' | 'e2e-review'>('none')
  const [, setE2eHighlight] = useState<Record<string, boolean>>({})
  const [devAiPayload, setDevAiPayload] = useState<DevelopmentAiPayload | null>(
    null,
  )

  const [isEditing, setIsEditing] = useState(false)
  const emptyDevState: DbtRealState = {
    sql: '',
    tableName: '',
    database: 'warehouse',
    materialization: 'incremental',
    schedule: 'Daily',
  }
  const [devState, setDevState] = useState<DbtRealState>(emptyDevState)
  const [devCommittedState, setDevCommittedState] = useState<DbtRealState>(emptyDevState)
  const prevActiveTableIdRef = useRef(activeTableId)

  const activeTable = useMemo(
    () => tables.find((table) => table.id === activeTableId) ?? tables[0],
    [activeTableId, tables],
  )

  useEffect(() => {
    // 模拟“没有注册表”的业务：进入 develop 时确保当前表处于 development
    if (activeApp === 'develop' && activeTable.type !== 'development') {
      setActiveTableId(defaultDevTable.id)
      setIsEditing(false)
      setDevAiPayload(null)
    }
  }, [activeApp, activeTable.type])

  useEffect(() => {
    if (isEditing) return
    const tableChanged = prevActiveTableIdRef.current !== activeTableId
    prevActiveTableIdRef.current = activeTableId

    // Create Flow：若当前呈现的是“空画布栏”，则取消编辑时不应被 activeTable.name 覆盖。
    if (!tableChanged) {
      const isEmptyCommitted = !devCommittedState.tableName.trim() && !devCommittedState.sql.trim()
      if (isEmptyCommitted) return
    }

    const parts = activeTable.target.split('.').filter(Boolean)
    const database = parts[0] ?? activeTable.target
    const sqlFromMappings =
      activeTable.type !== 'development' && activeTable.mappings.length > 0
        ? `SELECT ${activeTable.mappings
            .map((m) => `${m.sourceField} AS ${m.targetField}`)
            .join(', ')} FROM ${activeTable.source};`
        : activeTable.sql
    const next: DbtRealState = {
      sql: activeTable.type === 'development' ? activeTable.sql : sqlFromMappings,
      tableName: activeTable.name,
      database,
      materialization: (activeTable.materializationStrategy ?? 'incremental') as MaterializationMode,
      schedule: activeTable.scheduleCron ?? 'Daily',
    }
    setDevState(next)
    setDevCommittedState(next)
  }, [activeTableId, isEditing, devCommittedState])

  useEffect(() => {
    if (!isEditing) return
    if (activeTable.type !== 'development') return
    const changed = JSON.stringify(devState) !== JSON.stringify(devCommittedState)
    if (!changed) return
    setUnsavedTableIds((prev) => ({ ...prev, [activeTableId]: true }))
  }, [isEditing, devState, devCommittedState, activeTableId, activeTable.type])

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

    const connectionOptions = connectionResources.filter(
      (r) => r.id === devDataSourceId || r.source === 'mock',
    )

    const databases = Array.from(
      new Set(
        tables
          .map((t) => t.target.split('.').filter(Boolean)[0] ?? t.target)
          .filter((x): x is string => Boolean(x)),
      ),
    )

    const tablesInDatabase = (db: string) =>
      tables.filter(
        (t) => t.type === 'development' && t.target.split('.').filter(Boolean)[0] === db,
      )

    return (
      <div className="space-y-3">
        {/* Context Selectors */}
        <div className={cn('rounded-lg border border-white/10 bg-black/10 p-2')}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Context</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block space-y-1 text-xs">
              <div className="text-slate-400">选择数据源（Data Source）</div>
              <select
                value={devDataSourceId}
                onChange={(e) => {
                  const next = e.target.value
                  setDevDataSourceId(next)
                  setActiveConnectionId(next)
                }}
                className="h-8 w-full rounded-md border border-white/10 bg-slate-950/60 px-2 text-[11px] text-slate-100 outline-none focus:border-cyan-300/40"
              >
                {dataSources.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-xs">
              <div className="text-slate-400">选择数据连接（Connection）</div>
              <select
                value={activeConnectionId}
                onChange={(e) => setActiveConnectionId(e.target.value)}
                className="h-8 w-full rounded-md border border-white/10 bg-slate-950/60 px-2 text-[11px] text-slate-100 outline-none focus:border-cyan-300/40"
              >
                {connectionOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.database}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Database-driven Tree View */}
        <div className={cn('rounded-lg border border-white/10 bg-black/10 p-2 space-y-2')}>
          {databases.map((db) => {
            const expanded = expandedDatabases[db] ?? true
            const items = tablesInDatabase(db)
            return (
              <div key={db} className="space-y-1">
                <div className="group flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDatabases((prev) => ({ ...prev, [db]: !expanded }))
                    }
                    className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-left text-[11px] text-slate-200 hover:border-cyan-300/30"
                    title="展开/收起"
                  >
                    <span className="text-slate-400">{expanded ? '▾' : '▸'}</span>
                    <span className="truncate">{db}</span>
                  </button>

                  {/* hover: [+] 仅在该库下创建 Development Model */}
                  <button
                    type="button"
                    onClick={() => {
                      const newId = `dws_new_${crypto.randomUUID().slice(0, 8)}`
                      const nextName = `dws_new_${newId.slice('dws_new_'.length)}`.replace(/[^a-zA-Z0-9_]/g, '_')
                      const nextTarget = `${db}.${nextName}`
                      const nextSource = `${db}.dwd_source_events`

                      const nextTable: TableResource = {
                        id: newId,
                        name: nextName,
                        type: 'development',
                        source: nextSource,
                        target: nextTarget,
                        mappings: [],
                        materializationStrategy: 'incremental',
                        scheduleCron: 'Daily',
                        sql: '',
                        status: 'draft',
                      }

                      setTables((prev) => [...prev, nextTable])
                      setActiveTableId(newId)
                      setActiveApp('develop')
                      setDevAiPayload(null)
                      setIsEditing(true)
                      setUnsavedTableIds((prev) => ({ ...prev, [newId]: true }))

                      // Create Flow：清空表单与 SQL，进入开发编辑态
                      setDevState({
                        sql: '',
                        tableName: '',
                        database: db,
                        materialization: 'incremental',
                        schedule: 'Daily',
                      })
                      setDevCommittedState({
                        sql: '',
                        tableName: '',
                        database: db,
                        materialization: 'incremental',
                        schedule: 'Daily',
                      })
                    }}
                    className="ml-auto rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-cyan-200 transition hover:bg-cyan-400/10"
                    title="+ 新建开发表"
                  >
                    [+]
                  </button>
                </div>

                {expanded && (
                  <div className="space-y-0.5">
                    {items.map((table) => {
                      const isActive = activeTableId === table.id
                      return (
                        <button
                          key={table.id}
                          type="button"
                          onClick={() => {
                            setActiveTableId(table.id)
                            setActiveApp('develop')
                            setIsEditing(false)
                            setDevAiPayload(null)
                          }}
                          className={cn(
                            'w-full rounded-md border-l-2 text-left transition',
                            isActive
                              ? 'border-cyan-400/70 bg-cyan-400/15 text-cyan-100 border-white/10'
                              : 'border-transparent bg-black/10 text-slate-300 hover:border-cyan-300/40 hover:bg-black/20',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 px-2 py-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <SquareTerminal className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
                              <div className="min-w-0">
                                <div className="truncate text-[11px] font-medium leading-5">
                                  {table.name}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {/* 纯视觉占位：避免其他文字标签干扰 */}
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500/50" />
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
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

  const renderDevelopmentWorkspace = () => {
    const editable = true

    const targetDatabaseOptions = Array.from(
      new Set(
        tables
          .map((t) => t.target.split('.').filter(Boolean)[0])
          .filter((x): x is string => Boolean(x)),
      ),
    )

    if (devState.database && !targetDatabaseOptions.includes(devState.database)) {
      targetDatabaseOptions.push(devState.database)
    }

    return (
      <div className="flex h-full flex-col min-h-0">
        <div className="min-h-0 flex-1 overflow-hidden p-5">
          <DbtReadEditDevelopmentWorkspace
            editable={editable}
            isEditing={isEditing}
            devState={devState}
            setDevState={setDevState}
            aiPayload={devAiPayload}
            onAiPayloadConsumed={() => setDevAiPayload(null)}
            targetDatabaseOptions={targetDatabaseOptions}
            onEnterEdit={() => {
              if (!editable) return
              setDevState(devCommittedState)
              setIsEditing(true)
            }}
            onCancel={() => {
              const isEmptyCommitted =
                !devCommittedState.tableName.trim() && !devCommittedState.sql.trim()
              // 防止取消后触发 effect 把 activeTable.name 覆盖回非空
              prevActiveTableIdRef.current = activeTableId
              setDevState(devCommittedState)
              setIsEditing(false)
              setDevAiPayload(null)
              if (!isEmptyCommitted) {
                setUnsavedTableIds((prev) => ({ ...prev, [activeTableId]: false }))
              }
            }}
            onPublish={async (next) => {
              // 模拟编译 + 发布
              await sleep(900)
              prevActiveTableIdRef.current = activeTableId
              setTables((prev) =>
                prev.map((t) =>
                  t.id === activeTableId
                    ? {
                        ...t,
                        name: next.tableName,
                        target: `${next.database}.${next.tableName}`,
                        sql: next.sql,
                        materializationStrategy: next.materialization,
                        scheduleCron: next.schedule,
                        status: 'ready',
                      }
                    : t,
                ),
              )
              setUnsavedTableIds((prev) => ({ ...prev, [activeTableId]: false }))
              setDevCommittedState(next)
              setDevState(next)
              setIsEditing(false)
              setDevAiPayload(null)
            }}
          />
        </div>
      </div>
    )
  }

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
        <section className="flex-1 p-6">
          <div className="flex h-[calc(100vh-3rem)] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
            <aside className="flex w-72 border-r border-white/10 bg-black/20">
              {/* Activity Bar：负责切换 activeApp（仅图标，极窄竖向） */}
              <div className="w-14 flex-none bg-[#0d1218] p-2">
                <div className="flex h-full flex-col items-stretch gap-1">
                  <div className="flex flex-col items-stretch gap-1 pt-1">
                    {MODULE_OPTIONS.map((module) => {
                      const Icon = module.icon
                      const isActive = activeApp === module.id

                      return (
                        <button
                          key={module.id}
                          onClick={() => setActiveApp(module.id)}
                          title={module.label}
                          aria-label={module.label}
                          className={cn(
                            'flex w-full items-center justify-center rounded-lg py-2 transition',
                            'border-l-2',
                            isActive
                              ? 'border-blue-500 text-cyan-200'
                              : 'border-transparent text-slate-600/80 hover:text-slate-200/90',
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-auto pb-1">
                    <button
                      type="button"
                      title="AI 助手（聚焦输入框）"
                      aria-label="AI 助手（聚焦输入框）"
                      onClick={() => {
                        const inputEl = document.getElementById(
                          'omni-panel-chat-input',
                        ) as HTMLInputElement | null
                        inputEl?.focus()
                      }}
                      className={cn(
                        'flex w-full items-center justify-center rounded-lg py-2 transition',
                        'border-l-2 border-transparent text-slate-600/80 hover:text-slate-200/90',
                      )}
                    >
                      <Bot className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Resource Explorer */}
              <div className="min-w-0 flex-1 overflow-hidden p-4">{renderSidebarPanel()}</div>
            </aside>

            <div className="min-w-0 flex-1">{renderCenterWorkspace()}</div>

            {/* Right AI Copilot Panel */}
            <aside className="w-96 shrink-0 border-l border-white/10 bg-black/20">
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-2 text-[11px] text-slate-300">试试这些快捷场景（回车也可直接下达指令）：</div>
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
                  ) : (
                    messages.slice(-60).map((m) => {
                      if (m.type === 'loading') {
                        return (
                          <div
                            key={m.id}
                            className="rounded-2xl border border-cyan-300/25 bg-black/30 p-3 text-xs text-cyan-100 shadow-[0_0_0_1px_rgba(103,232,249,0.12)] backdrop-blur"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <CircleDashed className="h-3.5 w-3.5 animate-spin text-cyan-200" />
                              <span className="animate-pulse">{m.content}</span>
                            </div>
                            <div className="space-y-1">
                              {m.steps?.slice(0, 4).map((step) => (
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

                      if (m.type === 'card' && m.payload) {
                        const receipt = m.payload
                        return (
                          <div
                            key={m.id}
                            className="rounded-2xl border border-white/20 bg-black/30 p-3 backdrop-blur"
                          >
                            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                              <Sparkles className="h-4 w-4 text-violet-200" />
                              {receipt.title}
                            </div>
                            <div className="mb-2 text-[11px] text-slate-200/90">{receipt.summary}</div>
                            <button
                              onClick={() => applyReceipt(receipt)}
                              className="w-full rounded-xl border border-cyan-300/50 bg-cyan-400/20 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/30"
                            >
                              {receipt.kind === 'development'
                                ? '应用此开发SQL配置'
                                : receipt.kind === 'security'
                                  ? '应用此安全策略'
                                  : receipt.kind === 'e2e'
                                    ? '审阅并填充全局工作区'
                                    : '应用此集成映射配置'}
                            </button>
                          </div>
                        )
                      }

                      if (m.role === 'user') {
                        return (
                          <div
                            key={m.id}
                            className="ml-auto w-fit max-w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300"
                          >
                            {m.content}
                          </div>
                        )
                      }

                      // assistant fallback
                      return (
                        <div
                          key={m.id}
                          className="w-fit max-w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300"
                        >
                          {m.content}
                        </div>
                      )
                    })
                  )}

                  <div ref={messagesEndRef} className="h-px" />
                </div>

                {/* Bottom input base (fixed inside panel) */}
                <div className="sticky bottom-0 z-10 shrink-0 border-t border-white/10 bg-gray-900/80 p-3 shadow-2xl backdrop-blur-xl">
                  <input
                    id="omni-panel-chat-input"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmitCommand()
                    }}
                    placeholder="输入指令并按回车..."
                    className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}

export default Layout
