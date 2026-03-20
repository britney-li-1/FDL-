export type TableType = 'integration' | 'development'

export type Mapping = {
  sourceField: string
  targetField: string
  type: string
  isMasked: boolean
}

export type TableResource = {
  id: string
  name: string
  type: TableType
  source: string
  target: string
  mappings: Mapping[]
  sql: string
  status: 'draft' | 'ready'
}

export type DataSourceResource = {
  id: string
  name: string
  engine: 'MySQL' | 'PostgreSQL' | 'Oracle' | 'Kafka'
  host: string
  database: string
  username: string
  password: string
  status: 'draft' | 'ready'
}

export type PipelineStatus = 'draft' | 'running' | 'ready'

export type PipelineResource = {
  id: string
  name: string
  detail: string
  cadence: string
  status: PipelineStatus
  tableId?: string
}

export type E2EPayload = {
  dataSource: DataSourceResource
  table: TableResource
  scheduling: {
    mode: 'full'
    partition: 'daily'
    execution: 'one-shot'
    autoMapping: true
  }
}

export type Receipt = {
  id: string
  kind: 'integration' | 'development' | 'security' | 'e2e'
  title: string
  summary: string
  payload: unknown
}

