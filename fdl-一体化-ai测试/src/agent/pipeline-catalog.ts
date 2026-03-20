import type { DataIntegrationState } from '../state/app-bus'

export type ScenarioMode = 'normal' | 'alert'

export type AgentScenario = {
  id: 'integration' | 'development' | 'ops'
  title: string
  prompt: string
  logs: string[]
  receiptTitle: string
  receiptBody: string
  memory: string
  actions: [string, string]
  mode: ScenarioMode
  integrationPayload?: DataIntegrationState
  developmentPayload?: {
    tableName: string
    layer: 'DWD' | 'DWS'
    sql: string
  }
}

const pipelineCatalog: Record<AgentScenario['id'], AgentScenario> = {
  integration: {
    id: 'integration',
    title: 'Scenario 1 · 数据集成',
    prompt: '把业务库 X 接进来',
    logs: [
      '连接至业务库X_Prod...成功',
      '扫描库拓扑结构...',
      '匹配数仓接入记录...',
    ],
    receiptTitle: '数据集成凭单已送达',
    receiptBody: '已选取 6 张核心订单表，增量 Binlog 同步已配置。',
    memory:
      '🧠 智能溯源：已自动过滤 `temp_` 测试表。检测到常与用户表关联，建议稍后生成 Join 视图。',
    actions: ['应用此配置', '去拓扑可视化查看'],
    mode: 'normal',
    integrationPayload: {
      sourceConfig: {
        type: 'MySQL',
        host: 'biz-x-prod.internal:3306',
        db: 'biz_order',
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
          sourceField: 'created_time',
          targetField: 'created_at',
          type: 'TIMESTAMP',
          isMasked: false,
        },
      ],
      sqlTransform:
        "SELECT order_id, buyer_phone, order_amount, created_time AS created_at\nFROM ods_biz_order_delta\nWHERE dt = '${biz_date}';",
    },
  },
  development: {
    id: 'development',
    title: 'Scenario 2 · 数据开发',
    prompt: '新建一张销售分析宽表',
    logs: [
      '构建 DWS 宽表结构...',
      '梳理 dwd_trade_order 链路...',
      '校验 SQL 格式...',
    ],
    receiptTitle: '开发收据已归档',
    receiptBody: '`dws_sales_analysis_wide` 草稿已生成。',
    memory:
      '🧠 智能溯源：基于团队规范，已主动补全【客户分类/续约率】字段。遵循偏好地域使用 `region`。',
    actions: ['应用开发代码(DWS)', '在标准 IDE 打开'],
    mode: 'normal',
    developmentPayload: {
      tableName: 'dws_user_retention',
      layer: 'DWS',
      sql: `SELECT
  user_id,
  max(last_active_date) AS last_active_date,
  sum(CASE WHEN active_days_30d > 0 THEN 1 ELSE 0 END) AS retained_users_30d
FROM dwd_user_behavior
GROUP BY user_id;`,
    },
  },
  ops: {
    id: 'ops',
    title: 'Scenario 3 · 智能运维',
    prompt: '自动处理 dws_sales 超时告警',
    logs: [
      '检测到读取 Oracle_ERP 超时...',
      '复用历史处置范式并等待回退窗口...',
      '03:30 自动拉起任务并跑通...',
    ],
    receiptTitle: '告警处置凭单',
    receiptBody: '🛡️ 任务 `dws_sales` 读取 `Oracle_ERP` 超时。',
    memory:
      '🧠 智能溯源：参考上月同类报错处置范式（等待 30 分钟重跑有效），AI 已于 03:30 自动执行拉起并跑通。',
    actions: ['查看链路诊断链', '收起告警'],
    mode: 'alert',
  },
}

export function getScenarioById(id: AgentScenario['id']) {
  return pipelineCatalog[id]
}

export function listScenarios() {
  return Object.values(pipelineCatalog)
}
