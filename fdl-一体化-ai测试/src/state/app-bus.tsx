import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type SourceConfig = {
  type: 'MySQL' | 'PostgreSQL' | 'Oracle'
  host: string
  db: string
  syncMode: 'increment' | 'full'
}

export type SchemaMapping = {
  sourceField: string
  targetField: string
  type: string
  isMasked: boolean
}

export type DataIntegrationState = {
  sourceConfig: SourceConfig
  schemaMappings: SchemaMapping[]
  sqlTransform: string
}

export type TableLayer = 'ODS' | 'DWD' | 'DWS'
export type TableNodeType = 'integration' | 'development'

export type TableNode = {
  id: string
  name: string
  layer: TableLayer
  nodeType: TableNodeType
  integrationConfig: DataIntegrationState
  developmentSql: string
}

type WorkspaceState = {
  tableNodes: TableNode[]
  selectedTableId: string
}

type WorkspaceActions = {
  selectTable: (tableId: string) => void
  upsertIntegrationTableFromAi: (payload: {
    name: string
    layer: TableLayer
    config: DataIntegrationState
  }) => void
  upsertDevelopmentTableFromAi: (payload: {
    name: string
    layer: TableLayer
    sql: string
  }) => void
  updateSelectedSourceConfig: <K extends keyof SourceConfig>(
    key: K,
    value: SourceConfig[K],
  ) => void
  updateSelectedSchemaMapping: <K extends keyof SchemaMapping>(
    index: number,
    key: K,
    value: SchemaMapping[K],
  ) => void
  updateSelectedDevelopmentSql: (sql: string) => void
}

type AppBusContextValue = WorkspaceState &
  WorkspaceActions & {
    selectedTable: TableNode
  }

const AppBusContext = createContext<AppBusContextValue | null>(null)

const defaultIntegrationConfig: DataIntegrationState = {
  sourceConfig: {
    type: 'MySQL',
    host: '',
    db: '',
    syncMode: 'increment',
  },
  schemaMappings: [{ sourceField: '', targetField: '', type: '', isMasked: false }],
  sqlTransform: '',
}

export function AppBusProvider({ children }: { children: ReactNode }) {
  const [tableNodes, setTableNodes] = useState<TableNode[]>([
    {
      id: 'ods_crm_orders',
      name: 'ods_crm_orders',
      layer: 'ODS',
      nodeType: 'integration',
      integrationConfig: {
        sourceConfig: {
          type: 'MySQL',
          host: 'crm-prod.internal:3306',
          db: 'crm',
          syncMode: 'increment',
        },
        schemaMappings: [
          {
            sourceField: 'order_id',
            targetField: 'order_id',
            type: 'BIGINT',
            isMasked: false,
          },
          {
            sourceField: 'mobile',
            targetField: 'mobile',
            type: 'STRING',
            isMasked: true,
          },
        ],
        sqlTransform:
          "SELECT order_id, mobile, created_time\nFROM ods_crm_order_delta\nWHERE dt = '${biz_date}';",
      },
      developmentSql: '',
    },
    {
      id: 'dws_user_retention',
      name: 'dws_user_retention',
      layer: 'DWS',
      nodeType: 'development',
      integrationConfig: defaultIntegrationConfig,
      developmentSql:
        "SELECT user_id, retention_days, last_active_date\nFROM dwd_user_behavior\nWHERE dt = '${biz_date}';",
    },
  ])
  const [selectedTableId, setSelectedTableId] = useState('ods_crm_orders')

  const selectTable: WorkspaceActions['selectTable'] = (tableId) => {
    setSelectedTableId(tableId)
  }

  const upsertIntegrationTableFromAi: WorkspaceActions['upsertIntegrationTableFromAi'] = ({
    name,
    layer,
    config,
  }) => {
    let nextSelectedId = ''
    setTableNodes((prev) => {
      const existing = prev.find((item) => item.name === name)
      if (existing) {
        nextSelectedId = existing.id
        return prev.map((item) =>
          item.name === name
            ? {
                ...item,
                layer,
                nodeType: 'integration',
                integrationConfig: config,
              }
            : item,
        )
      }
      const newId = name
      nextSelectedId = newId
      return [
        ...prev,
        {
          id: newId,
          name,
          layer,
          nodeType: 'integration',
          integrationConfig: config,
          developmentSql: '',
        },
      ]
    })
    setSelectedTableId(nextSelectedId)
  }

  const upsertDevelopmentTableFromAi: WorkspaceActions['upsertDevelopmentTableFromAi'] = ({
    name,
    layer,
    sql,
  }) => {
    let nextSelectedId = ''
    setTableNodes((prev) => {
      const existing = prev.find((item) => item.name === name)
      if (existing) {
        nextSelectedId = existing.id
        return prev.map((item) =>
          item.name === name
            ? {
                ...item,
                layer,
                nodeType: 'development',
                developmentSql: sql,
              }
            : item,
        )
      }
      const newId = name
      nextSelectedId = newId
      return [
        ...prev,
        {
          id: newId,
          name,
          layer,
          nodeType: 'development',
          integrationConfig: defaultIntegrationConfig,
          developmentSql: sql,
        },
      ]
    })
    setSelectedTableId(nextSelectedId)
  }

  const updateSelectedSourceConfig: WorkspaceActions['updateSelectedSourceConfig'] = (
    key,
    value,
  ) => {
    setTableNodes((prev) =>
      prev.map((item) =>
        item.id === selectedTableId
          ? {
              ...item,
              integrationConfig: {
                ...item.integrationConfig,
                sourceConfig: { ...item.integrationConfig.sourceConfig, [key]: value },
              },
            }
          : item,
      ),
    )
  }

  const updateSelectedSchemaMapping: WorkspaceActions['updateSelectedSchemaMapping'] = (
    index,
    key,
    value,
  ) => {
    setTableNodes((prev) =>
      prev.map((item) =>
        item.id === selectedTableId
          ? {
              ...item,
              integrationConfig: {
                ...item.integrationConfig,
                schemaMappings: item.integrationConfig.schemaMappings.map((row, i) =>
                  i === index ? { ...row, [key]: value } : row,
                ),
              },
            }
          : item,
      ),
    )
  }

  const updateSelectedDevelopmentSql: WorkspaceActions['updateSelectedDevelopmentSql'] = (
    sql,
  ) => {
    setTableNodes((prev) =>
      prev.map((item) =>
        item.id === selectedTableId ? { ...item, developmentSql: sql } : item,
      ),
    )
  }

  const selectedTable =
    tableNodes.find((item) => item.id === selectedTableId) ?? tableNodes[0]

  const value = useMemo(
    () => ({
      tableNodes,
      selectedTableId,
      selectedTable,
      selectTable,
      upsertIntegrationTableFromAi,
      upsertDevelopmentTableFromAi,
      updateSelectedSourceConfig,
      updateSelectedSchemaMapping,
      updateSelectedDevelopmentSql,
    }),
    [selectedTable, selectedTableId, tableNodes],
  )

  return <AppBusContext.Provider value={value}>{children}</AppBusContext.Provider>
}

export function useAppBus() {
  const context = useContext(AppBusContext)
  if (!context) {
    throw new Error('useAppBus must be used within AppBusProvider')
  }
  return context
}
