export type MaterializationMode = 'table' | 'view' | 'incremental' | 'ephemeral'

export type ColumnDef = {
  name: string
  dataType: string
}

export type TableBase = {
  id: string
  name: string
  createdAt?: string
}

export type RegisteredTable = TableBase & {
  kind: 'registered'
  /**
   * 来自元数据采集：结构信息即可（只读/引用）
   */
  schema: ColumnDef[]
}

export type DevelopedTable = TableBase & {
  kind: 'developed'
  /**
   * dbt-style 声明式定义
   */
  writeTarget: string
  /**
   * Cron 表达式（或框架约定的简写）
   */
  cron: string
  materialization: MaterializationMode
  /**
   * 声明式 SQL
   */
  sql: string
}

export type Table = RegisteredTable | DevelopedTable

export type DevelopedTableDraft = {
  id: string
  name: string
  writeTarget: string
  cron: string
  materialization: MaterializationMode
  sql: string
}

export type DevelopmentRealState = {
  /**
   * 当前编辑的声明式对象（一定是 Developed 类型）
   */
  edited: DevelopedTableDraft
}

/**
 * AI 提议态：仅包含“可能被修改”的字段（部分字段允许为空）
 * - 没有 AI 提议：`aiProposalState === null`
 * - 有 AI 提议：UI 叠加 Diff 并提供 Accept/Reject
 */
export type DevelopmentAiProposalState = {
  tableId?: string
  name?: string
  writeTarget?: string
  cron?: string
  materialization?: MaterializationMode
  sql?: string
}

