import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { DevelopmentAiPayload } from './DevelopmentModule'
import { cn } from '../lib/utils'

type MaterializationMode = 'table' | 'view' | 'incremental' | 'ephemeral'
type FieldRole = 'dimension' | 'metric'
type MaskingLevel = 'none' | 'partial' | 'full'

type ColumnAttributes = {
  role: FieldRole
  primaryKey: boolean
  masking: MaskingLevel
}

type DeclarativeColumn = {
  name: string
  dataType: string
  attrs: ColumnAttributes
}

type DataSourceDecl = {
  upstreamMode: 'batch' | 'stream'
  upstreamTable: string
  /** A: 依赖缩略映射（展示“上游字段到目标字段”的证据，不要求写连接代码） */
  dependencyThumbnails: Array<{ targetField: string; sources: string[] }>
}

type TransformationDecl = {
  /** C: 目标字段直配表达式（可编辑、用于生成 YAML 声明） */
  rules: Array<{ targetField: string; expression: string }>
  /** C: 声明式规则 YAML（可编辑，后续也可由 AI 直接填充 aiProposalState） */
  yaml: string
}

type SinkDecl = {
  ttlDays: number
  partitionField: string
  indexes: string[]
}

type ModelDecl = {
  name: string
  writeTarget: string
  engine: string
  cron: string
  materialization: MaterializationMode
  schema: {
    columns: DeclarativeColumn[]
  }
}

type DeclarativeRealState = {
  source: DataSourceDecl
  model: ModelDecl
  transformations: TransformationDecl
  sink: SinkDecl
  /** 仅用于 C/yaml 生成与 AI 提案推衍；UI 默认不“满屏展示 SQL” */
  sqlReference: string
}

type DeclarativeAiProposalState = {
  taskName?: string
  engine?: string
  schedule?: string
  code?: string
  sourceSchema?: DevelopmentAiPayload['sourceSchema']
  outputSchema?: DevelopmentAiPayload['outputSchema']
}

const MATERIALIZATION_OPTIONS: Array<{ id: MaterializationMode; label: string }> = [
  { id: 'table', label: 'table' },
  { id: 'view', label: 'view' },
  { id: 'incremental', label: 'incremental' },
  { id: 'ephemeral', label: 'ephemeral' },
]

const UPSTREAM_MODE_OPTIONS: Array<{ id: DataSourceDecl['upstreamMode']; label: string }> = [
  { id: 'batch', label: '批处理' },
  { id: 'stream', label: '流式' },
]

const CRON_OPTIONS = ['Daily', 'Hourly', 'Weekly', 'Manual', 'Cron'] as const

function normalizeMaskingByName(name: string): MaskingLevel {
  const n = name.toLowerCase()
  if (n.includes('phone') || n.includes('mobile')) return 'partial'
  if (n.includes('id') || n.includes('card') || n.includes('identity')) return 'full'
  return 'none'
}

function normalizeRoleByName(name: string): FieldRole {
  const n = name.toLowerCase()
  if (n.includes('cnt') || n.includes('count') || n.includes('amt') || n.includes('amount') || n.includes('total')) {
    return 'metric'
  }
  return 'dimension'
}

function guessDataTypeFromSqlAlias(expression: string, alias: string): string {
  const e = expression.toLowerCase()
  if (e.includes('count(')) return 'BIGINT'
  if (e.includes('sum(') || e.includes('avg(')) return 'DECIMAL(18,2)'
  if (e.includes('max(') || e.includes('min(')) {
    if (alias.toLowerCase().includes('date')) return 'DATE'
    if (alias.toLowerCase().includes('time') || alias.toLowerCase().includes('timestamp')) return 'TIMESTAMP'
    return 'TIMESTAMP'
  }
  return 'STRING'
}

function extractSqlSelectAliases(sql: string): Array<{ expression: string; alias: string }> {
  // 简化解析：从 SELECT 到 FROM，尽可能分出顶层字段；对 demo/推衍场景足够。
  const upper = sql.toUpperCase()
  const selectIdx = upper.indexOf('SELECT')
  const fromIdx = upper.indexOf('FROM')
  if (selectIdx === -1 || fromIdx === -1 || fromIdx <= selectIdx) return []
  const selectBody = sql.slice(selectIdx + 'SELECT'.length, fromIdx).trim()

  // 仅按逗号切分（不处理嵌套函数内逗号，保持轻量）
  const parts = selectBody
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  return parts
    .map((part) => {
      // 支持 `expr AS alias` 与 `expr alias`
      const asMatch = part.match(/^(.*?)(?:\s+AS\s+|\s+)([a-zA-Z_][a-zA-Z0-9_]*)$/i)
      if (asMatch) {
        const expression = asMatch[1].trim()
        const alias = asMatch[2].trim()
        return { expression, alias }
      }
      // 没法解析就退化：用整段作为表达式、别名取最后 token
      const tokens = part.split(/\s+/).filter(Boolean)
      const alias = tokens[tokens.length - 1] ?? part
      return { expression: part, alias }
    })
    .filter((x) => x.alias)
}

function dependenciesFromExpression(expression: string): string[] {
  const stop = new Set([
    'select',
    'from',
    'as',
    'case',
    'when',
    'then',
    'else',
    'end',
    'count',
    'max',
    'min',
    'sum',
    'avg',
    'cast',
    'coalesce',
    'null',
    'date',
    'timestamp',
    'day',
    'month',
    'year',
    'group',
    'by',
    'where',
    'and',
    'or',
    'dt',
    'biz_date',
  ])
  const tokens = (expression.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) ?? []).filter((t) => !stop.has(t.toLowerCase()))
  // 去重 + 保留顺序
  const seen = new Set<string>()
  const uniq: string[] = []
  for (const t of tokens) {
    if (seen.has(t)) continue
    seen.add(t)
    uniq.push(t)
  }
  return uniq.slice(0, 3)
}

function buildDeclarativeFromBase(params: {
  taskName: string
  writeTarget: string
  engine: string
  cron: string
  materialization: MaterializationMode
  upstreamTable: string
  sqlReference: string
  outputColumns?: Array<{ name: string; type: string }>
}): DeclarativeRealState {
  const aliases = extractSqlSelectAliases(params.sqlReference)
  const fallbackColumns = aliases.map((a) => ({
    name: a.alias,
    dataType: guessDataTypeFromSqlAlias(a.expression, a.alias),
  }))

  const outputColumns = params.outputColumns?.map((c) => ({ name: c.name, dataType: c.type })) ?? fallbackColumns
  const columns: DeclarativeColumn[] = outputColumns.map((c, idx) => {
    // 默认：第一个字段为主键；若字段名包含 id 也保持主键标记（AI 推衍后更稳定）
    const primaryKey = idx === 0 || c.name.toLowerCase().includes('id')
    return {
      name: c.name,
      dataType: c.dataType,
      attrs: {
        role: normalizeRoleByName(c.name),
        primaryKey,
        masking: normalizeMaskingByName(c.name),
      },
    }
  })

  // 规则：基于 SQL 解析别名表达式；如果 outputColumns 有，但 SQL 没解析到，就退化到“字段直配表达式”
  const ruleFromSql = aliases.map((a) => ({
    targetField: a.alias,
    expression: a.expression,
  }))
  const rules = columns.map((col) => {
    const fromSql = ruleFromSql.find((r) => r.targetField === col.name)
    return {
      targetField: col.name,
      expression: fromSql?.expression ?? col.name,
    }
  })

  const dependencyThumbnails = rules.map((r) => ({
    targetField: r.targetField,
    sources: dependenciesFromExpression(r.expression),
  }))

  const yaml = [
    'declarative_pipeline:',
    `  model: ${params.taskName}`,
    `  engine: ${params.engine}`,
    `  cron: ${params.cron}`,
    '  schema:',
    ...columns.map((c) => {
      const role = c.attrs.role
      const pk = c.attrs.primaryKey ? 'true' : 'false'
      const masking = c.attrs.masking
      return `    - name: ${c.name}\n      type: ${c.dataType}\n      role: ${role}\n      primaryKey: ${pk}\n      masking: ${masking}`
    }),
    '  transformations:',
    ...rules.map((r) => `    - target: ${r.targetField}\n      expression: ${r.expression}`),
    '  sink:',
    `    ttlDays: ${30}`,
    `    partitionField: dt`,
    `    indexes: [${columns
      .filter((c) => c.attrs.primaryKey || c.attrs.role === 'metric')
      .slice(0, 3)
      .map((c) => c.name)
      .join(', ')}]`,
  ].join('\n')

  return {
    source: {
      upstreamMode: params.upstreamTable.includes('kafka') || params.upstreamTable.includes('stream') ? 'stream' : 'batch',
      upstreamTable: params.upstreamTable,
      dependencyThumbnails,
    },
    model: {
      name: params.taskName,
      writeTarget: params.writeTarget,
      engine: params.engine,
      cron: params.cron,
      materialization: params.materialization,
      schema: { columns },
    },
    transformations: { rules, yaml },
    sink: {
      ttlDays: 30,
      partitionField: 'dt',
      indexes: columns
        .filter((c) => c.attrs.primaryKey || c.attrs.role === 'metric')
        .slice(0, 3)
        .map((c) => c.name),
    },
    sqlReference: params.sqlReference,
  }
}

type DeclarativeDevelopmentModuleProps = {
  aiPayload?: DevelopmentAiPayload | null
  onAiPayloadConsumed?: () => void
  /** 从 Layout 注入“当前表的真实值”，保证未推衍时也能呈现拟真 UI，而不是空白占位 */
  initial: {
    modelName: string
    writeTarget: string
    upstreamTable: string
    sqlReference: string
  }
}

export default function DeclarativeDevelopmentModule({
  aiPayload,
  onAiPayloadConsumed,
  initial,
}: DeclarativeDevelopmentModuleProps) {
  const [realState, setRealState] = useState<DeclarativeRealState>(() =>
    buildDeclarativeFromBase({
      taskName: initial.modelName,
      writeTarget: initial.writeTarget,
      engine: 'Spark',
      cron: 'Daily',
      materialization: 'incremental',
      upstreamTable: initial.upstreamTable,
      sqlReference: initial.sqlReference,
    }),
  )
  const [aiProposalState, setAiProposalState] = useState<DeclarativeAiProposalState | null>(null)
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set())

  const prevPayloadRef = useRef<string | null>(null)
  const realStateRef = useRef(realState)
  realStateRef.current = realState

  const triggerFlash = useCallback((keys: string[]) => {
    setFlashKeys((prev) => new Set([...prev, ...keys]))
    window.setTimeout(() => {
      setFlashKeys((prev) => {
        const next = new Set(prev)
        keys.forEach((k) => next.delete(k))
        return next
      })
    }, 1500)
  }, [])

  useEffect(() => {
    if (!aiPayload || Object.keys(aiPayload).length === 0) {
      setAiProposalState(null)
      prevPayloadRef.current = null
      return
    }

    const sig = JSON.stringify(aiPayload)
    if (prevPayloadRef.current === sig) return
    prevPayloadRef.current = sig

    const r = realStateRef.current
    const nextProposal: DeclarativeAiProposalState = { ...aiPayload }
    setAiProposalState(nextProposal)

    const flash: string[] = []
    if (aiPayload.taskName != null && aiPayload.taskName !== r.model.name) flash.push('model.name')
    if (aiPayload.engine != null && aiPayload.engine !== r.model.engine) flash.push('model.engine')
    if (aiPayload.schedule != null && aiPayload.schedule !== r.model.cron) flash.push('model.cron')
    if (aiPayload.code != null && aiPayload.code !== r.sqlReference) flash.push('transform.yaml')
    if (aiPayload.sourceSchema != null && aiPayload.sourceSchema.table !== r.source.upstreamTable) flash.push('source.upstreamTable')
    if (aiPayload.outputSchema != null) flash.push('schema.columns')
    if (flash.length) triggerFlash(flash)

    onAiPayloadConsumed?.()
  }, [aiPayload, onAiPayloadConsumed, triggerFlash])

  const proposedState = useMemo(() => {
    if (!aiProposalState) return realState

    const nextSql = aiProposalState.code ?? realState.sqlReference
    const nextTaskName = aiProposalState.taskName ?? realState.model.name
    const nextWriteTarget = aiProposalState.outputSchema?.table ?? realState.model.writeTarget
    const nextEngine = aiProposalState.engine ?? realState.model.engine
    const nextCron = aiProposalState.schedule ?? realState.model.cron
    const nextSource = aiProposalState.sourceSchema?.table ?? realState.source.upstreamTable
    const outputColumns = aiProposalState.outputSchema?.columns?.map((c) => ({
      name: c.name,
      type: c.type,
    }))

    return buildDeclarativeFromBase({
      taskName: nextTaskName,
      writeTarget: nextWriteTarget,
      engine: nextEngine,
      cron: nextCron,
      materialization: realState.model.materialization,
      upstreamTable: nextSource,
      sqlReference: nextSql,
      outputColumns,
    })
  }, [aiProposalState, realState])

  const hasAiDiff = aiProposalState !== null
  const yamlChanged =
    hasAiDiff && proposedState.transformations.yaml !== realState.transformations.yaml

  const acceptProposal = () => {
    if (!aiProposalState) return
    setRealState(proposedState)
    setAiProposalState(null)
    prevPayloadRef.current = null
  }

  const rejectProposal = () => {
    setAiProposalState(null)
    prevPayloadRef.current = null
  }

  const diffClass = (real: unknown, proposed: unknown) =>
    hasAiDiff && JSON.stringify(real) !== JSON.stringify(proposed)
      ? 'border-emerald-300/40 ring-1 ring-emerald-500/20'
      : 'border-white/10'

  const inputClass = (key: string) =>
    cn(
      'h-9 w-full rounded-lg border bg-slate-950/70 px-2 text-xs text-slate-100 outline-none transition focus:border-cyan-300/40',
      flashKeys.has(key) && 'ai-filled-flash',
    )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 text-slate-100">
      {(hasAiDiff || aiPayload) && aiProposalState && (
        <div className="shrink-0 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-3">
          <div className="mb-2 text-xs font-semibold text-emerald-200">AI 建议 Diff（可一键应用）</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={acceptProposal}
              className="rounded-xl border border-emerald-300/40 bg-emerald-400/15 px-3 py-2 text-xs text-emerald-200 transition hover:bg-emerald-400/25"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={rejectProposal}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10"
            >
              Reject
            </button>
            <span className="ml-auto text-[11px] text-slate-300">
              以“声明式结构”级别叠加更新（不需要手工写 DDL）
            </span>
          </div>
        </div>
      )}

      {/* A: Data Source Declaration */}
      <section
        className={cn(
          'rounded-2xl border bg-white/[0.03] p-4',
          hasAiDiff && diffClass(realState.source.upstreamTable, proposedState.source.upstreamTable).includes('emerald'),
        )}
      >
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-cyan-200/90">
          <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">A</span>
          Data Source Declaration
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="text-slate-400">上游模式</span>
            <select
              value={realState.source.upstreamMode}
              onChange={(e) =>
                setRealState((s) => ({
                  ...s,
                  source: { ...s.source, upstreamMode: e.target.value as DataSourceDecl['upstreamMode'] },
                }))
              }
              className={cn(inputClass('source.upstreamMode'), diffClass(realState.source.upstreamMode, proposedState.source.upstreamMode))}
            >
              {UPSTREAM_MODE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {hasAiDiff && proposedState.source.upstreamMode !== realState.source.upstreamMode && (
              <div className="text-[10px] text-emerald-200">
                <span className="line-through text-slate-500">{realState.source.upstreamMode}</span>
                <span className="ml-2 text-emerald-200">
                  {proposedState.source.upstreamMode}
                </span>
              </div>
            )}
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-400">上游节点（流或表）</span>
            <input
              value={realState.source.upstreamTable}
              onChange={(e) =>
                setRealState((s) => ({
                  ...s,
                  source: { ...s.source, upstreamTable: e.target.value },
                }))
              }
              className={cn(inputClass('source.upstreamTable'), diffClass(realState.source.upstreamTable, proposedState.source.upstreamTable))}
            />
            {hasAiDiff && proposedState.source.upstreamTable !== realState.source.upstreamTable && (
              <div className="text-[10px] text-emerald-200">
                <span className="line-through text-slate-500">{realState.source.upstreamTable}</span>
                <span className="ml-2 text-emerald-200">{proposedState.source.upstreamTable}</span>
              </div>
            )}
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">依赖视图缩略映射</div>
          <div className="grid gap-2 md:grid-cols-2">
            {realState.transformations.rules.slice(0, 6).map((r, idx) => {
              const proposed = proposedState.transformations.rules[idx]
              const changed = hasAiDiff && proposed && proposed.expression !== r.expression
              return (
                <div
                  key={r.targetField}
                  className={cn(
                    'rounded-xl border bg-white/[0.02] p-3 text-xs',
                    changed ? 'border-emerald-300/40 ring-1 ring-emerald-500/15' : 'border-white/10',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Target</span>
                    <span className="truncate font-medium text-slate-100">{r.targetField}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {realState.source.dependencyThumbnails[idx]?.sources?.slice(0, 3).map((src) => (
                      <span key={src} className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] text-slate-300">
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* B: Schema & Model Declaration */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-cyan-200/90">
          <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">B</span>
          Schema & Model Declaration
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="space-y-1 text-xs">
            <span className="text-slate-400">模型名称</span>
            <input
              value={realState.model.name}
              onChange={(e) => setRealState((s) => ({ ...s, model: { ...s.model, name: e.target.value } }))}
              className={cn(inputClass('model.name'), diffClass(realState.model.name, proposedState.model.name))}
            />
            {hasAiDiff && proposedState.model.name !== realState.model.name && (
              <div className="text-[10px] text-emerald-200">
                <span className="line-through text-slate-500">{realState.model.name}</span>
                <span className="ml-2 text-emerald-200">{proposedState.model.name}</span>
              </div>
            )}
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-400">写入目标</span>
            <input
              value={realState.model.writeTarget}
              onChange={(e) =>
                setRealState((s) => ({ ...s, model: { ...s.model, writeTarget: e.target.value } }))
              }
              className={cn(inputClass('model.writeTarget'), diffClass(realState.model.writeTarget, proposedState.model.writeTarget))}
            />
            {hasAiDiff && proposedState.model.writeTarget !== realState.model.writeTarget && (
              <div className="text-[10px] text-emerald-200">
                <span className="line-through text-slate-500">{realState.model.writeTarget}</span>
                <span className="ml-2 text-emerald-200">{proposedState.model.writeTarget}</span>
              </div>
            )}
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-400">调度周期</span>
            <select
              value={realState.model.cron}
              onChange={(e) => setRealState((s) => ({ ...s, model: { ...s.model, cron: e.target.value } }))}
              className={cn(inputClass('model.cron'), diffClass(realState.model.cron, proposedState.model.cron))}
            >
              {CRON_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {hasAiDiff && proposedState.model.cron !== realState.model.cron && (
              <div className="text-[10px] text-emerald-200">
                <span className="line-through text-slate-500">{realState.model.cron}</span>
                <span className="ml-2 text-emerald-200">{proposedState.model.cron}</span>
              </div>
            )}
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-400">物化模式</span>
            <select
              value={realState.model.materialization}
              onChange={(e) =>
                setRealState((s) => ({
                  ...s,
                  model: { ...s.model, materialization: e.target.value as MaterializationMode },
                }))
              }
              className={cn(
                inputClass('model.materialization'),
                diffClass(realState.model.materialization, proposedState.model.materialization),
              )}
            >
              {MATERIALIZATION_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">字段清单</div>
            {hasAiDiff && realState.model.schema.columns.length !== proposedState.model.schema.columns.length && (
              <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">
                Schema 结构已变更
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">字段</th>
                  <th className="px-3 py-2 text-left">类型</th>
                  <th className="px-3 py-2 text-left">角色</th>
                  <th className="px-3 py-2 text-left">主键</th>
                  <th className="px-3 py-2 text-left">脱敏</th>
                </tr>
              </thead>
              <tbody>
                {realState.model.schema.columns.map((col, idx) => {
                  const pCol = proposedState.model.schema.columns[idx]
                  const roleChanged = hasAiDiff && pCol && pCol.attrs.role !== col.attrs.role
                  const pkChanged = hasAiDiff && pCol && pCol.attrs.primaryKey !== col.attrs.primaryKey
                  const maskChanged = hasAiDiff && pCol && pCol.attrs.masking !== col.attrs.masking
                  const rowChanged = Boolean(roleChanged || pkChanged || maskChanged)

                  return (
                    <tr key={col.name} className={rowChanged ? 'bg-emerald-400/[0.06]' : undefined}>
                      <td className="border-b border-white/10 px-3 py-2 font-medium text-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 items-center rounded-lg border border-white/10 bg-black/20 px-2 text-[11px] text-slate-300">
                            {col.attrs.role === 'dimension' ? '🧊' : '⚡'}
                          </span>
                          <span className="truncate">{col.name}</span>
                        </div>
                      </td>
                      <td className="border-b border-white/10 px-3 py-2 text-slate-400">{col.dataType}</td>
                      <td className="border-b border-white/10 px-3 py-2">
                        <select
                          value={col.attrs.role}
                          onChange={(e) =>
                            setRealState((s) => ({
                              ...s,
                              model: {
                                ...s.model,
                                schema: {
                                  ...s.model.schema,
                                  columns: s.model.schema.columns.map((c, i) =>
                                    i === idx ? { ...c, attrs: { ...c.attrs, role: e.target.value as FieldRole } } : c,
                                  ),
                                },
                              },
                            }))
                          }
                          className={cn('h-8 rounded-lg border bg-slate-950/80 px-2 text-[11px] text-slate-100 outline-none', roleChanged ? 'border-emerald-300/40' : 'border-white/15')}
                        >
                          <option value="dimension">Dimension</option>
                          <option value="metric">Metric</option>
                        </select>
                      </td>
                      <td className="border-b border-white/10 px-3 py-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={col.attrs.primaryKey}
                            onChange={(e) =>
                              setRealState((s) => ({
                                ...s,
                                model: {
                                  ...s.model,
                                  schema: {
                                    ...s.model.schema,
                                    columns: s.model.schema.columns.map((c, i) =>
                                      i === idx ? { ...c, attrs: { ...c.attrs, primaryKey: e.target.checked } } : c,
                                    ),
                                  },
                                },
                              }))
                            }
                            className="accent-cyan-300"
                          />
                        </label>
                      </td>
                      <td className="border-b border-white/10 px-3 py-2">
                        <select
                          value={col.attrs.masking}
                          onChange={(e) =>
                            setRealState((s) => ({
                              ...s,
                              model: {
                                ...s.model,
                                schema: {
                                  ...s.model.schema,
                                  columns: s.model.schema.columns.map((c, i) =>
                                    i === idx ? { ...c, attrs: { ...c.attrs, masking: e.target.value as MaskingLevel } } : c,
                                  ),
                                },
                              },
                            }))
                          }
                          className={cn('h-8 rounded-lg border bg-slate-950/80 px-2 text-[11px] text-slate-100 outline-none', maskChanged ? 'border-emerald-300/40' : 'border-white/15')}
                        >
                          <option value="none">none</option>
                          <option value="partial">partial</option>
                          <option value="full">full</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* C: Transformation & Mapping */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-cyan-200/90">
          <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">C</span>
          Transformation & Mapping
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">表达式直配</div>
              {hasAiDiff && (
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">
                  将自动重生成 YAML 声明
                </span>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left">目标字段</th>
                    <th className="px-3 py-2 text-left">Expression</th>
                  </tr>
                </thead>
                <tbody>
                  {realState.transformations.rules.map((rule, idx) => {
                    const proposedRule = proposedState.transformations.rules[idx]
                    const changed = hasAiDiff && proposedRule && proposedRule.expression !== rule.expression
                    return (
                      <tr key={rule.targetField} className={changed ? 'bg-emerald-400/[0.06]' : undefined}>
                        <td className="border-b border-white/10 px-3 py-2 font-medium text-slate-100">
                          {rule.targetField}
                        </td>
                        <td className="border-b border-white/10 px-3 py-2">
                          <input
                            value={rule.expression}
                            onChange={(e) =>
                              setRealState((s) => ({
                                ...s,
                                transformations: {
                                  ...s.transformations,
                                  rules: s.transformations.rules.map((r, i) =>
                                    i === idx ? { ...r, expression: e.target.value } : r,
                                  ),
                                },
                              }))
                            }
                            className={cn(
                              'h-8 w-full rounded-lg border bg-slate-950/80 px-2 text-[11px] text-slate-100 outline-none',
                              changed ? 'border-emerald-300/40' : 'border-white/15',
                            )}
                          />
                        {changed && proposedRule && (
                          <div className="mt-1 text-[10px] text-emerald-200">
                            <span className="line-through text-slate-500">{rule.expression}</span>
                            <span className="ml-2 text-emerald-200">{proposedRule.expression}</span>
                          </div>
                        )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">声明式 YAML</div>
              <span className="text-[11px] text-slate-400">Declarative rules</span>
            </div>

            <div
              className={cn(
                'rounded-xl border bg-slate-950/70 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]',
                hasAiDiff && flashKeys.has('transform.yaml') && 'border-emerald-300/40 ring-1 ring-emerald-500/20',
              )}
            >
              {yamlChanged ? (
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2">
                    <div className="mb-1 text-[11px] text-slate-400">real</div>
                    <textarea
                      value={realState.transformations.yaml}
                      onChange={(e) =>
                        setRealState((s) => ({
                          ...s,
                          transformations: { ...s.transformations, yaml: e.target.value },
                        }))
                      }
                      className="h-[340px] w-full resize-none rounded-lg border-0 bg-slate-950/60 p-3 font-mono text-[12px] leading-relaxed text-emerald-50/95 outline-none"
                      spellCheck={false}
                    />
                  </div>
                  <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/[0.06] p-2">
                    <div className="mb-1 text-[11px] text-emerald-200">aiProposal</div>
                    <textarea
                      readOnly
                      value={proposedState.transformations.yaml}
                      className="h-[340px] w-full resize-none rounded-lg border-0 bg-emerald-400/[0.06] p-3 font-mono text-[12px] leading-relaxed text-emerald-100/95 outline-none"
                      spellCheck={false}
                    />
                  </div>
                </div>
              ) : (
                <textarea
                  value={realState.transformations.yaml}
                  onChange={(e) =>
                    setRealState((s) => ({
                      ...s,
                      transformations: { ...s.transformations, yaml: e.target.value },
                    }))
                  }
                  className="h-[340px] w-full resize-none rounded-xl border-0 bg-slate-950/70 p-3 font-mono text-[12px] leading-relaxed text-emerald-50/95 outline-none"
                  spellCheck={false}
                />
              )}
            </div>

            {/* optional hint: do not show a "placeholder" string */}
            <div className="mt-2 text-[11px] text-slate-400">
              YAML 由 Expression 与 Schema 元信息生成；AI 提案到来时会触发 Diff/闪烁并提供 Accept/Reject。
            </div>
          </div>
        </div>
      </section>

      {/* D: Sink & Serving Declaration */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-cyan-200/90">
          <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">D</span>
          Sink & Serving Declaration
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-1 text-xs">
            <span className="text-slate-400">TTL（天）</span>
            <input
              type="number"
              value={realState.sink.ttlDays}
              onChange={(e) =>
                setRealState((s) => ({ ...s, sink: { ...s.sink, ttlDays: Math.max(0, Number(e.target.value || 0)) } }))
              }
              className={cn(inputClass('sink.ttlDays'), diffClass(realState.sink.ttlDays, proposedState.sink.ttlDays))}
            />
            {hasAiDiff && proposedState.sink.ttlDays !== realState.sink.ttlDays && (
              <div className="text-[10px] text-emerald-200">
                <span className="line-through text-slate-500">{realState.sink.ttlDays}</span>
                <span className="ml-2 text-emerald-200">{proposedState.sink.ttlDays}</span>
              </div>
            )}
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-400">分区字段</span>
            <input
              value={realState.sink.partitionField}
              onChange={(e) =>
                setRealState((s) => ({ ...s, sink: { ...s.sink, partitionField: e.target.value } }))
              }
              className={cn(inputClass('sink.partitionField'), diffClass(realState.sink.partitionField, proposedState.sink.partitionField))}
            />
            {hasAiDiff && proposedState.sink.partitionField !== realState.sink.partitionField && (
              <div className="text-[10px] text-emerald-200">
                <span className="line-through text-slate-500">{realState.sink.partitionField}</span>
                <span className="ml-2 text-emerald-200">{proposedState.sink.partitionField}</span>
              </div>
            )}
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-slate-400">索引（选择字段）</span>
            <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2">
              <div className="flex flex-wrap gap-2">
                {realState.model.schema.columns.slice(0, 8).map((c) => {
                  const checked = realState.sink.indexes.includes(c.name)
                  return (
                    <button
                      type="button"
                      key={c.name}
                      onClick={() =>
                        setRealState((s) => {
                          const exists = s.sink.indexes.includes(c.name)
                          const next = exists ? s.sink.indexes.filter((x) => x !== c.name) : [...s.sink.indexes, c.name]
                          return { ...s, sink: { ...s.sink, indexes: next } }
                        })
                      }
                      className={cn(
                        'rounded-full border px-3 py-1 text-[11px] transition',
                        checked ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-black/20 text-slate-300',
                      )}
                      title={checked ? '取消索引' : '添加索引'}
                    >
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </label>
        </div>
      </section>

      {/* Small collapsed SQL reference for power users (not a placeholder) */}
      <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <summary className="cursor-pointer text-xs font-semibold text-slate-200">
          SQL Reference（可折叠）
        </summary>
        <div className="mt-3">
          <div className="mb-2 text-[11px] text-slate-400">用于回溯 AI 推衍证据；声明式界面主要以 Expression/YAML 驱动。</div>
          <Editor
            value={realState.sqlReference}
            onChange={(v) =>
              setRealState((s) => ({
                ...s,
                sqlReference: v ?? '',
                // 保持 YAML/规则一致性：用户改了 SQL，则以规则推衍方式刷新表达式。
                transformations: (() => {
                  const aliases = extractSqlSelectAliases(v ?? '')
                  const rules = s.model.schema.columns.map((col) => {
                    const found = aliases.find((a) => a.alias === col.name)
                    return { targetField: col.name, expression: found?.expression ?? col.name }
                  })
                  const yaml = [
                    'declarative_pipeline:',
                    `  model: ${s.model.name}`,
                    `  engine: ${s.model.engine}`,
                    `  cron: ${s.model.cron}`,
                    '  schema:',
                    ...s.model.schema.columns.map((c) => {
                      return `    - name: ${c.name}\n      type: ${c.dataType}\n      role: ${c.attrs.role}\n      primaryKey: ${
                        c.attrs.primaryKey ? 'true' : 'false'
                      }\n      masking: ${c.attrs.masking}`
                    }),
                    '  transformations:',
                    ...rules.map((r) => `    - target: ${r.targetField}\n      expression: ${r.expression}`),
                    '  sink:',
                    `    ttlDays: ${s.sink.ttlDays}`,
                    `    partitionField: ${s.sink.partitionField}`,
                    `    indexes: [${s.sink.indexes.join(', ')}]`,
                  ].join('\n')
                  return { ...s.transformations, rules, yaml }
                })(),
              }))
            }
            language="sql"
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 12, bottom: 12 },
            }}
            height="240px"
          />
        </div>
      </details>
    </div>
  )
}

