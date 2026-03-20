import { useMemo, useState, type ComponentType } from 'react'
import {
  Bot,
  Cable,
  Code2,
  Database,
  GitMerge,
  Settings,
  SquareTerminal,
} from 'lucide-react'
import { DevelopmentWorkspace } from '../workspaces/DevelopmentWorkspace'
import { ConnectionsWorkspace } from '../workspaces/ConnectionsWorkspace'
import { IntegrationWorkspace } from '../workspaces/IntegrationWorkspace'
import { OmniPanel } from '../components/OmniPanel'
import type {
  DataSourceResource,
  E2EPayload,
  PipelineResource,
  Receipt,
  TableResource,
} from '../types/domain'
import type { DevelopmentAiPayload } from '../components/DevelopmentModule'
import { cn } from '../lib/utils'

type GlobalAppModule = 'connections' | 'develop' | 'integrate'

type PreviewRow = { order_id: string; user_phone: string; amount: string }
type SchemaRow = { id: string; field: string; type: string }

const previewRows: PreviewRow[] = Array.from({ length: 10 }).map((_, index) => ({
  order_id: `${10001 + index}`,
  user_phone: `13${index}****${8800 + index}`,
  amount: `${(index + 1) * 37}.00`,
}))

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

const SIDEBAR_PANEL_CLASS = 'rounded-2xl border border-white/10 bg-white/[0.03]'
const SIDEBAR_ITEM_BASE_CLASS = 'w-full rounded-xl border px-3 py-2 text-left transition'
const SIDEBAR_ITEM_IDLE_CLASS =
  'border-white/10 bg-black/10 text-slate-300 hover:border-cyan-300/40 hover:bg-cyan-400/10'
const SIDEBAR_ITEM_ACTIVE_CLASS =
  'border-cyan-300/60 bg-cyan-400/15 text-cyan-100 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]'

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

function ActivityBar({
  activeApp,
  onChange,
  onAiClick,
  onSettingsClick,
}: {
  activeApp: GlobalAppModule
  onChange: (next: GlobalAppModule) => void
  onAiClick: () => void
  onSettingsClick: () => void
}) {
  const items: Array<{
    id: GlobalAppModule
    label: string
    icon: ComponentType<{ className?: string }>
  }> = [
    { id: 'connections', label: '数据连接', icon: Database },
    { id: 'develop', label: '数据开发', icon: Code2 },
    { id: 'integrate', label: '数据集成', icon: GitMerge },
  ]

  return (
    <div className="flex h-full w-14 flex-col bg-[#0d1218]">
      <div className="flex-1 overflow-y-auto py-3">
        <nav className="flex flex-col items-stretch gap-1 px-1">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = activeApp === item.id
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                title={item.label}
                aria-label={item.label}
                className={[
                  'flex w-full items-center justify-center py-2 transition',
                  'border-l-2',
                  isActive ? 'border-blue-500 text-cyan-200' : 'border-transparent text-slate-600/80',
                  'hover:text-slate-200/90',
                ].join(' ')}
              >
                <Icon
                  className={[
                    'h-5 w-5 transition-colors',
                    isActive ? 'text-cyan-200' : 'text-slate-500/90',
                  ].join(' ')}
                />
              </button>
            )
          })}
        </nav>
      </div>

      <div className="border-t border-white/5 px-2 py-3">
        <div className="space-y-2">
          <button
            type="button"
            title="设置"
            aria-label="设置"
            className="flex w-full items-center justify-center rounded-md border border-transparent bg-transparent py-2 text-slate-600/80 transition hover:text-slate-200/90"
            onClick={onSettingsClick}
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            type="button"
            title="AI助手（Omni Panel）"
            aria-label="AI助手（Omni Panel）"
            className="flex w-full items-center justify-center rounded-md border border-transparent bg-transparent py-2 text-slate-600/80 transition hover:text-slate-200/90"
            onClick={onAiClick}
          >
            <Bot className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const [tables, setTables] = useState<TableResource[]>([defaultTable, defaultDevTable])
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

  // 顶层状态提升：activeApp 控制左侧树 + 中央工作区，右侧 Omni Panel 常驻
  const [activeApp, setActiveApp] = useState<GlobalAppModule>('connections')

  const [activeConnectionId, setActiveConnectionId] = useState('mysql_seed')
  const [activePipelineId, setActivePipelineId] = useState('pipe_mysql_hive_full')
  const [activeTableId, setActiveTableId] = useState(defaultTable.id)
  const [unsavedTableIds, setUnsavedTableIds] = useState<Record<string, boolean>>({})
  const [devAiPayload, setDevAiPayload] = useState<DevelopmentAiPayload | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const activeTable = useMemo(
    () => tables.find((table) => table.id === activeTableId) ?? tables[0],
    [activeTableId, tables],
  )

  const connectionResources = useMemo(
    () => [
      ...dataSources.map((dataSource) => ({
        id: dataSource.id,
        name: dataSource.name,
        engine: dataSource.engine,
        detail: `${dataSource.host} · ${dataSource.database}`,
        status: dataSource.status,
      })),
      {
        id: 'postgres_growth_analytics',
        name: 'PostgreSQL_Growth_Analytics',
        engine: 'PostgreSQL',
        detail: 'growth-bi.internal:5432 · analytics',
        status: 'ready' as const,
      },
      {
        id: 'kafka_orders_stream',
        name: 'Kafka_Orders_Stream',
        engine: 'Kafka',
        detail: 'broker-a/b/c · topic.orders_rt',
        status: 'draft' as const,
      },
    ],
    [dataSources],
  )

  const integratePipelines = useMemo<PipelineResource[]>(() => {
    const integrationTable = tables.find((table) => table.type === 'integration')
    const developmentTable = tables.find((table) => table.type === 'development')

    return [
      {
        id: 'pipe_mysql_hive_full',
        name: 'MySQL -> Hive 全量同步',
        detail: integrationTable ? `${integrationTable.source} -> ${integrationTable.target}` : 'seed_mysql.orders -> warehouse.ods_seed_orders',
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

  const activeConnectionResource = useMemo(() => {
    return connectionResources.find((r) => r.id === activeConnectionId)
  }, [activeConnectionId, connectionResources])

  const schemaRows: SchemaRow[] = useMemo(() => {
    if (activeTable.type === 'integration') {
      return activeTable.mappings.map((mapping, idx) => ({
        id: `${mapping.targetField}-${idx}`,
        field: mapping.targetField || `field_${idx + 1}`,
        type: mapping.type || 'STRING',
      }))
    }

    return [
      { id: 'user_id', field: 'user_id', type: 'BIGINT' },
      { id: 'last_active_date', field: 'last_active_date', type: 'DATE' },
      { id: 'retained_users_30d', field: 'retained_users_30d', type: 'INT' },
    ]
  }, [activeTable])

  const handleSelectTable = (id: string) => {
    setActiveTableId(id)
  }

  const renderSidebarPanel = () => {
    if (activeApp === 'connections') {
      return (
        <div className={cn(SIDEBAR_PANEL_CLASS, 'p-3')}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Connection Registry</p>
              <p className="mt-1 text-xs text-slate-300">已登记的数据源与消息通道</p>
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
                  onClick={() => setActiveConnectionId(resource.id)}
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
                    <span>{resource.status === 'draft' ? 'Pending' : 'Registered'}</span>
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
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Integration Pipelines</p>
              <p className="mt-1 text-xs text-slate-300">同步、摄入与分发任务树</p>
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
                    if (pipeline.tableId) handleSelectTable(pipeline.tableId)
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
                    <span>{pipeline.tableId ? 'Linked' : 'Mock'}</span>
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
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">已介入对象</p>
              <p className="mt-1 text-xs text-slate-300">围绕当前工作区可直接编辑的数据对象</p>
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
              onClick={() => handleSelectTable(table.id)}
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
                      ? 'ODS'
                      : 'DWS'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
                <span>{table.type === 'integration' ? 'Ingested Object' : 'Developed Model'}</span>
                <span>{table.status === 'draft' ? 'Pending' : 'Ready'}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const handleApplyReceipt = (receipt: Receipt) => {
    if (receipt.kind === 'e2e') {
      const payload = receipt.payload as E2EPayload

      setDataSources((prev) => {
        const exists = prev.some((ds) => ds.id === payload.dataSource.id)
        if (exists) return prev.map((ds) => (ds.id === payload.dataSource.id ? payload.dataSource : ds))
        return [...prev, payload.dataSource]
      })

      setTables((prev) => {
        const exists = prev.some((t) => t.id === payload.table.id)
        if (exists) return prev.map((t) => (t.id === payload.table.id ? payload.table : t))
        return [...prev, payload.table]
      })

      setActiveApp('connections')
      setActiveConnectionId(payload.dataSource.id)
      setActiveTableId(payload.table.id)
      setUnsavedTableIds((prev) => ({ ...prev, [payload.table.id]: true }))
      setDevAiPayload(null)
      return
    }

    const payloadTable = receipt.payload as TableResource

    setTables((prev) => {
      const exists = prev.some((table) => table.id === payloadTable.id)
      if (exists) return prev.map((t) => (t.id === payloadTable.id ? payloadTable : t))
      return [...prev, payloadTable]
    })

    setActiveTableId(payloadTable.id)
    setUnsavedTableIds((prev) => ({ ...prev, [payloadTable.id]: true }))

    if (receipt.kind === 'development') {
      setActiveApp('develop')
      setDevAiPayload({
        taskName: payloadTable.name,
        engine: 'Spark',
        schedule: 'Daily',
        code: payloadTable.sql,
        sourceSchema: {
          table: payloadTable.source,
          columns: [
            { name: 'customer_id', type: 'BIGINT' },
            { name: 'order_amount', type: 'DECIMAL(18,2)' },
            { name: 'order_time', type: 'TIMESTAMP' },
          ],
        },
        outputSchema: {
          table: payloadTable.target,
          columns: [
            { name: 'customer_id', type: 'BIGINT' },
            { name: 'order_cnt', type: 'BIGINT' },
            { name: 'total_amount', type: 'DECIMAL(18,2)' },
          ],
        },
      })
      return
    }

    if (receipt.kind === 'integration') {
      setActiveApp('integrate')
      setDevAiPayload(null)
      return
    }

    // security: decide active workspace based on table node type
    setActiveApp(payloadTable.type === 'integration' ? 'integrate' : 'develop')
    setDevAiPayload(null)
  }

  const activeDataSource = useMemo(
    () => dataSources.find((d) => d.id === activeConnectionId),
    [activeConnectionId, dataSources],
  )

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <section className="flex-1 border-r border-white/10 p-6">
          <div className="flex h-[calc(100vh-3rem)] rounded-3xl border border-white/10 bg-white/[0.03]">
            <aside className="flex h-full">
              <div className="border-r border-white/5">
                <ActivityBar
                  activeApp={activeApp}
                  onChange={setActiveApp}
                  onAiClick={() => {
                    const inputEl = document.getElementById(
                      'omni-panel-chat-input',
                    ) as HTMLInputElement | null
                    if (inputEl) inputEl.focus()
                  }}
                  onSettingsClick={() => setIsSettingsOpen(true)}
                />
              </div>

              <div className="w-60 flex-none bg-black/20 p-4">
                <div className="h-full overflow-y-auto pr-1">{renderSidebarPanel()}</div>
              </div>
            </aside>

            <div className="flex-1">
              {activeApp === 'connections' && (
                <ConnectionsWorkspace
                  activeConnectionId={activeConnectionId}
                  activeConnectionResource={activeConnectionResource}
                  activeDataSource={activeDataSource}
                />
              )}

              {activeApp === 'develop' && (
                <DevelopmentWorkspace
                  activeTable={activeTable}
                  unsaved={!!unsavedTableIds[activeTableId]}
                  previewRows={previewRows}
                  schemaRows={schemaRows}
                  aiPayload={devAiPayload}
                  onAiPayloadConsumed={() => setDevAiPayload(null)}
                />
              )}

              {activeApp === 'integrate' && (
                <IntegrationWorkspace
                  pipelines={integratePipelines}
                  activePipelineId={activePipelineId}
                  activeTable={activeTable}
                />
              )}
            </div>
          </div>
        </section>

        <aside className="w-1/4 min-w-[360px] p-5">
          <OmniPanel tables={tables} activeTableId={activeTableId} onApplyReceipt={handleApplyReceipt} />
        </aside>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1218] p-5 text-slate-100 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">设置弹层</div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
              >
                关闭
              </button>
            </div>
            <p className="text-xs text-slate-300">
              这里是 Settings 的占位内容（不参与 `activeApp` 的页面替换）。
            </p>
          </div>
        </div>
      )}
    </main>
  )
}

