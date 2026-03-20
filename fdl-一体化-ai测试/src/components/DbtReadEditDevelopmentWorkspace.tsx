import { useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { Dispatch, SetStateAction } from 'react'
import { cn } from '../lib/utils'
import type { DevelopmentAiPayload } from './DevelopmentModule'

export type MaterializationMode = 'table' | 'view' | 'incremental' | 'ephemeral'

export type DbtRealState = {
  sql: string
  tableName: string
  database: string
  materialization: MaterializationMode
  schedule: string
}

type DbtAiProposal = Partial<DbtRealState>

type TabKey = 'schema' | 'preview' | 'sql'

type DbtReadEditDevelopmentWorkspaceProps = {
  editable: boolean
  isEditing: boolean

  devState: DbtRealState
  setDevState: Dispatch<SetStateAction<DbtRealState>>

  aiPayload?: DevelopmentAiPayload | null
  onAiPayloadConsumed?: () => void

  targetDatabaseOptions: string[]

  onEnterEdit: () => void
  onCancel: () => void
  onPublish: (next: DbtRealState) => Promise<void> | void
}

const MATERIALIZATION_OPTIONS: Array<{ id: MaterializationMode; label: string }> = [
  { id: 'table', label: 'Table' },
  { id: 'view', label: 'View' },
  { id: 'incremental', label: 'Incremental（增量表）' },
  { id: 'ephemeral', label: 'ephemeral' },
]

function extractDatabaseFromQualifiedName(qualified: string | undefined): string {
  if (!qualified) return ''
  const parts = qualified.split('.').filter(Boolean)
  if (parts.length <= 1) return qualified
  return parts[0] ?? ''
}

function extractTableNameFromQualifiedName(qualified: string | undefined): string {
  if (!qualified) return ''
  const parts = qualified.split('.').filter(Boolean)
  if (parts.length === 0) return ''
  return parts[parts.length - 1] ?? ''
}

function normalizeCron(input: string | undefined): string {
  return (input ?? '').trim() || 'Daily'
}

function extractSqlSelectAliases(sql: string): Array<{ expression: string; alias: string }> {
  const upper = sql.toUpperCase()
  // 处理 CTE：优先取“最后一个 SELECT”到其后第一个 FROM 的投影列表
  const selectIdx = upper.lastIndexOf('SELECT')
  if (selectIdx === -1) return []
  const fromIdx = upper.indexOf('FROM', selectIdx + 'SELECT'.length)
  if (fromIdx === -1 || fromIdx <= selectIdx) return []
  const selectBody = sql.slice(selectIdx + 'SELECT'.length, fromIdx).trim()
  if (!selectBody) return []

  // 注意：这里是轻量解析，仅服务演示/模拟视图。
  const parts = selectBody
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  return parts
    .map((part) => {
      const asMatch = part.match(/^(.*?)(?:\s+AS\s+|\s+)([a-zA-Z_][a-zA-Z0-9_]*)$/i)
      if (asMatch) {
        return { expression: asMatch[1].trim(), alias: asMatch[2].trim() }
      }
      const tokens = part.split(/\s+/).filter(Boolean)
      const alias = tokens[tokens.length - 1] ?? part
      return { expression: part, alias }
    })
    .filter((x) => x.alias)
}

function inferSchemaColumnsFromSql(sql: string): Array<{ name: string; type: string }> {
  const aliases = extractSqlSelectAliases(sql)
  if (aliases.length === 0) return []
  return aliases.map((a) => {
    const e = a.expression.toLowerCase()
    let type = 'STRING'
    if (e.includes('count(')) type = 'BIGINT'
    else if (e.includes('sum(') || e.includes('avg(')) type = 'DECIMAL(18,2)'
    else if (e.includes('case') || e.includes('when') || a.alias.toLowerCase().includes('flag')) {
      // 常见高价值标签/标志位：CASE WHEN ... THEN 1 ELSE 0
      if (e.includes('then 1') || e.includes('then 0') || e.includes('case')) type = 'INT'
    }
    else if (e.includes('max(') || e.includes('min(')) {
      if (a.alias.toLowerCase().includes('date')) type = 'DATE'
      else if (a.alias.toLowerCase().includes('time') || a.alias.toLowerCase().includes('timestamp')) type = 'TIMESTAMP'
      else type = 'TIMESTAMP'
    } else if (a.alias.toLowerCase().includes('id')) type = 'BIGINT'
    return { name: a.alias, type }
  })
}

function buildPreviewRows(
  columns: Array<{ name: string; type: string }>,
): Array<Record<string, string | number>> {
  const rows: Array<Record<string, string | number>> = []
  const rowCount = Math.min(8, Math.max(3, columns.length ? 6 : 4))

  for (let i = 0; i < rowCount; i += 1) {
    const r: Record<string, string | number> = { _row: i + 1 }
    for (const c of columns) {
      const nameLower = c.name.toLowerCase()
      if (nameLower.includes('id')) r[c.name] = 1000 + i
      else if (nameLower.includes('cnt') || nameLower.includes('count')) r[c.name] = 10 + i
      else if (nameLower.includes('flag') || nameLower.includes('high_value') || nameLower.includes('is_')) {
        r[c.name] = i % 2
      }
      else if (nameLower.includes('date')) r[c.name] = '2026-03-20'
      else if (nameLower.includes('time') || nameLower.includes('timestamp')) r[c.name] = '2026-03-20 10:00:00'
      else if (c.type.includes('DECIMAL')) r[c.name] = Number((i + 1) * 37.42).toFixed(2)
      else r[c.name] = `${c.name}_${i + 1}`
    }
    rows.push(r)
  }
  return rows
}

export default function DbtReadEditDevelopmentWorkspace({
  editable,
  isEditing,
  devState,
  setDevState,
  aiPayload,
  onAiPayloadConsumed,
  targetDatabaseOptions,
  onEnterEdit,
  onCancel,
  onPublish,
}: DbtReadEditDevelopmentWorkspaceProps) {
  const [aiProposalState, setAiProposalState] = useState<DbtAiProposal | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('schema')
  const [isPublishing, setIsPublishing] = useState(false)
  const [sqlViewMode, setSqlViewMode] = useState<'real' | 'ai'>('real')

  const prevPayloadSigRef = useRef<string | null>(null)

  const hasAiDiff = aiProposalState !== null

  const displayState = useMemo<DbtRealState>(() => {
    if (!aiProposalState) return devState
    return {
      ...devState,
      ...aiProposalState,
      materialization: (aiProposalState.materialization ?? devState.materialization) as MaterializationMode,
      schedule: aiProposalState.schedule ?? devState.schedule,
      database: aiProposalState.database ?? devState.database,
      tableName: aiProposalState.tableName ?? devState.tableName,
      sql: aiProposalState.sql ?? devState.sql,
    }
  }, [aiProposalState, devState])

  useEffect(() => {
    if (!hasAiDiff) setSqlViewMode('real')
  }, [hasAiDiff])

  // AI payload -> aiProposalState
  useEffect(() => {
    if (!aiPayload || Object.keys(aiPayload).length === 0) {
      setAiProposalState(null)
      prevPayloadSigRef.current = null
      return
    }
    const sig = JSON.stringify(aiPayload)
    if (prevPayloadSigRef.current === sig) return
    prevPayloadSigRef.current = sig

    const next: DbtAiProposal = {
      tableName: extractTableNameFromQualifiedName(aiPayload.outputSchema?.table) || aiPayload.taskName,
      database: extractDatabaseFromQualifiedName(aiPayload.outputSchema?.table) || devState.database,
      schedule: normalizeCron(aiPayload.schedule),
      sql: aiPayload.code,
    }
    setAiProposalState(next)
    onAiPayloadConsumed?.()
  }, [aiPayload, onAiPayloadConsumed, devState.database])

  const onCancelLocal = () => {
    setAiProposalState(null)
    prevPayloadSigRef.current = null
    onCancel()
  }

  const onPublishLocal = async () => {
    if (isPublishing) return
    if (!devState.tableName.trim() || !displayState.sql.trim()) return

    setIsPublishing(true)
    const nextToPublish = hasAiDiff ? displayState : devState
    try {
      await onPublish(nextToPublish)
      setAiProposalState(null)
      prevPayloadSigRef.current = null
    } finally {
      setIsPublishing(false)
    }
  }

  const inputBaseClass =
    'h-10 rounded-lg border bg-slate-950/80 px-3 text-xs text-slate-100 outline-none transition focus:border-cyan-400/40'

  const fieldRing = (key: keyof DbtRealState) =>
    hasAiDiff &&
    aiProposalState &&
    aiProposalState[key] != null &&
    aiProposalState[key] !== devState[key]
      ? 'border-emerald-300/40 ring-1 ring-emerald-500/20'
      : 'border-white/10'

  const proposedFieldLine = (key: keyof DbtRealState) => {
    if (!hasAiDiff || !aiProposalState) return null
    const proposed = displayState[key]
    const real = devState[key]
    if (proposed === real) return null
    return (
      <div className="mt-1 text-[10px] text-emerald-200">
        <span className="line-through text-slate-500">{String(real)}</span>
        <span className="ml-2">{String(proposed)}</span>
      </div>
    )
  }

  const derivedSchemaColumns =
    aiPayload?.outputSchema?.columns?.map((c) => ({ name: c.name, type: c.type })) ??
    inferSchemaColumnsFromSql(displayState.sql)

  const previewRows = useMemo(() => buildPreviewRows(derivedSchemaColumns), [derivedSchemaColumns])

  const renderReadHeader = () => {
    const tn = displayState.tableName.trim() ? displayState.tableName : '未命名模型'
    const db = displayState.database.trim() ? displayState.database : '—'
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-slate-100">{tn}</div>
            {hasAiDiff && (
              <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">
                AI 提议
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">
              {displayState.materialization}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">
              {db}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">
              {displayState.schedule}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {editable ? (
            <button
              type="button"
              onClick={onEnterEdit}
              className="rounded-xl border border-cyan-300/40 bg-cyan-400/20 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/25"
            >
              ✏️ 编辑模型 (Edit Model)
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-500"
            >
              只读
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderReadBody = () => {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center gap-2">
          {[
            { key: 'schema', label: 'Schema 字段结构' },
            { key: 'preview', label: 'Data Preview 数据预览' },
            { key: 'sql', label: 'SQL 逻辑' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as TabKey)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs transition',
                activeTab === t.key
                  ? 'border-cyan-300/60 bg-cyan-400/20 text-cyan-100'
                  : 'border-white/20 bg-white/5 text-slate-300 hover:bg-white/10',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'schema' && (
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-300">
              Output Schema（模拟）
            </div>
            <div className="h-full min-h-0 overflow-y-auto p-4">
              {derivedSchemaColumns.length === 0 ? (
                <div className="text-xs text-slate-500">暂无字段（模型未定义或 SQL 为空）</div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-white/5 text-slate-300">
                    <tr>
                      <th className="border-b border-white/10 px-3 py-2 text-left">字段</th>
                      <th className="border-b border-white/10 px-3 py-2 text-left">类型</th>
                      <th className="border-b border-white/10 px-3 py-2 text-left">角色</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derivedSchemaColumns.map((c) => {
                      const role =
                        c.name.toLowerCase().includes('cnt') ||
                        c.name.toLowerCase().includes('count') ||
                        c.name.toLowerCase().includes('amt') ||
                        c.name.toLowerCase().includes('amount') ||
                        c.name.toLowerCase().includes('total')
                          ? 'Metrics'
                          : 'Dimension'
                      return (
                        <tr key={c.name}>
                          <td className="border-b border-white/10 px-3 py-2 text-slate-100">{c.name}</td>
                          <td className="border-b border-white/10 px-3 py-2 text-slate-400">{c.type}</td>
                          <td className="border-b border-white/10 px-3 py-2 text-emerald-200/80">{role}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-300">
              Data Preview（模拟）
            </div>
            <div className="h-full min-h-0 overflow-y-auto p-4">
              {derivedSchemaColumns.length === 0 ? (
                <div className="text-xs text-slate-500">暂无数据预览</div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-white/5 text-slate-300">
                    <tr>
                      {derivedSchemaColumns.slice(0, 6).map((c) => (
                        <th key={c.name} className="border-b border-white/10 px-3 py-2 text-left">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, idx) => (
                      <tr key={idx}>
                        {derivedSchemaColumns.slice(0, 6).map((c) => (
                          <td key={c.name} className="border-b border-white/10 px-3 py-2 text-slate-100">
                            {String(r[c.name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'sql' && (
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-300">
              SQL Logic（只读）
            </div>
            <div className="h-full min-h-0">
              <Editor
                value={displayState.sql}
                onChange={() => undefined}
                language="sql"
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  fontSize: 13,
                  fontFamily: 'Fira Code, Consolas, monospace',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 12, bottom: 12 },
                  readOnly: true,
                }}
                height="100%"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderEditTop = () => {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-200">
              Edit Model
            </span>
            {hasAiDiff && (
              <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">
                AI Diff 待发布
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">受控状态：devState + aiProposalState（差异叠加）</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPublishing}
            onClick={onCancelLocal}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10"
          >
            取消 (Cancel)
          </button>
          <button
            type="button"
            disabled={isPublishing || !devState.tableName.trim() || !displayState.sql.trim()}
            onClick={onPublishLocal}
            className={cn(
              'rounded-xl border px-3 py-2 text-xs font-semibold transition',
              isPublishing || !devState.tableName.trim() || !displayState.sql.trim()
                ? 'cursor-not-allowed border-emerald-300/20 bg-emerald-400/10 text-emerald-200/60'
                : 'border-emerald-300/50 bg-emerald-400/25 text-emerald-100 hover:bg-emerald-400/35',
            )}
          >
            {isPublishing ? '编译中…' : '🚀 编译并发布 (Compile & Publish)'}
          </button>
        </div>
      </div>
    )
  }

  const renderEditBody = () => {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        {/* 上部：属性表单 */}
        <div className="min-h-[170px] rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-[11px] text-slate-400">Table Name（表名称）</div>
              <input
                value={devState.tableName}
                onChange={(e) => setDevState((s) => ({ ...s, tableName: e.target.value }))}
                disabled={!editable}
                className={cn(inputBaseClass, fieldRing('tableName'))}
              />
              {proposedFieldLine('tableName')}
            </label>

            <label className="block">
              <div className="mb-1 text-[11px] text-slate-400">Target Schema（写入目标库）</div>
              <select
                value={devState.database}
                onChange={(e) => setDevState((s) => ({ ...s, database: e.target.value }))}
                disabled={!editable}
                className={cn(inputBaseClass, fieldRing('database'))}
              >
                {targetDatabaseOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {proposedFieldLine('database')}
            </label>

            <label className="block">
              <div className="mb-1 text-[11px] text-slate-400">Materialization（物化模式）</div>
              <select
                value={devState.materialization}
                onChange={(e) => setDevState((s) => ({ ...s, materialization: e.target.value as MaterializationMode }))}
                disabled={!editable}
                className={cn(inputBaseClass, fieldRing('materialization'))}
              >
                {MATERIALIZATION_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {proposedFieldLine('materialization')}
            </label>

            <label className="block">
              <div className="mb-1 text-[11px] text-slate-400">Schedule（调度配置 Cron）</div>
              <input
                value={devState.schedule}
                onChange={(e) => setDevState((s) => ({ ...s, schedule: e.target.value }))}
                disabled={!editable}
                className={cn(inputBaseClass, fieldRing('schedule'))}
                placeholder="0 2 * * *"
              />
              {proposedFieldLine('schedule')}
            </label>
          </div>
        </div>

        {/* 下部：全宽 SQL 画布 */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <div className="flex items-center justify-end gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2">
            {hasAiDiff && (
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setSqlViewMode('real')}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] transition',
                    sqlViewMode === 'real' ? 'bg-cyan-400/15 text-cyan-100' : 'text-slate-300 hover:bg-white/10',
                  )}
                >
                  real
                </button>
                <button
                  type="button"
                  onClick={() => setSqlViewMode('ai')}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] transition',
                    sqlViewMode === 'ai' ? 'bg-emerald-400/15 text-emerald-200' : 'text-slate-300 hover:bg-white/10',
                  )}
                >
                  ai
                </button>
              </div>
            )}
          </div>
          <Editor
            value={sqlViewMode === 'ai' ? displayState.sql : devState.sql}
            onChange={(v) => {
              if (!editable) return
              if (sqlViewMode !== 'real') return
              setDevState((s) => ({ ...s, sql: v ?? '' }))
            }}
            language="sql"
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              lineNumbers: 'on',
              fontSize: 13,
              fontFamily: 'Fira Code, Consolas, monospace',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 12, bottom: 12 },
              readOnly: !editable || sqlViewMode !== 'real',
            }}
            height="100%"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {isEditing ? (
        <>
          {renderEditTop()}
          {renderEditBody()}
        </>
      ) : (
        <>
          {renderReadHeader()}
          <div className="min-h-0 flex-1">{renderReadBody()}</div>
        </>
      )}
    </div>
  )
}

