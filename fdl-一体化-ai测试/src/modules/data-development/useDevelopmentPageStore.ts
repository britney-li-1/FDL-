import { create } from 'zustand'
import type {
  DevelopedTableDraft,
  DevelopmentAiProposalState,
  DevelopmentRealState,
  MaterializationMode,
  RegisteredTable,
  Table,
} from './types'

type DevelopmentPageStore = {
  tables: Table[]
  selectedTableId: string | null

  realState: DevelopmentRealState
  aiProposalState: DevelopmentAiProposalState | null

  // actions
  selectTable: (tableId: string) => void
  createDevelopedTableDraft: () => void
  updateRealState: (patch: Partial<DevelopedTableDraft>) => void
  setAiProposalState: (proposal: DevelopmentAiProposalState | null) => void
  acceptProposal: () => void
  rejectProposal: () => void
}

const emptyDraft = (id: string): DevelopedTableDraft => ({
  id,
  name: '',
  writeTarget: '',
  cron: '',
  materialization: 'incremental',
  sql: '',
})

export const useDevelopmentPageStore = create<DevelopmentPageStore>((set, get) => {
  const registered: RegisteredTable[] = [
    {
      id: 'ods_crm_orders',
      kind: 'registered',
      name: 'ods_crm_orders',
      schema: [
        { name: 'order_id', dataType: 'BIGINT' },
        { name: 'mobile', dataType: 'STRING' },
        { name: 'amount', dataType: 'DECIMAL(18,2)' },
      ],
      createdAt: new Date().toISOString(),
    },
  ]

  const developed: Table[] = [
    {
      id: 'dws_user_retention',
      kind: 'developed',
      name: 'dws_user_retention',
      writeTarget: 'warehouse.dws_user_retention',
      cron: '0 2 * * *',
      materialization: 'incremental' satisfies MaterializationMode,
      sql: `SELECT
  user_id,
  retention_days,
  last_active_date
FROM dwd_user_behavior
WHERE dt = '\${biz_date}';`,
      createdAt: new Date().toISOString(),
    },
  ]

  const tables = [...registered, ...developed]
  const initialSelectedId = developed[0].id
  const initialEdited = emptyDraft(initialSelectedId)

  // hydrate initialEdited from developed
  const selectedDeveloped = developed.find((t) => t.kind === 'developed' && t.id === initialSelectedId)
  if (selectedDeveloped && selectedDeveloped.kind === 'developed') {
    initialEdited.name = selectedDeveloped.name
    initialEdited.writeTarget = selectedDeveloped.writeTarget
    initialEdited.cron = selectedDeveloped.cron
    initialEdited.materialization = selectedDeveloped.materialization
    initialEdited.sql = selectedDeveloped.sql
  }

  return {
    tables,
    selectedTableId: initialSelectedId,

    realState: { edited: initialEdited },
    aiProposalState: null,

    selectTable: (tableId) => {
      const table = get().tables.find((t) => t.id === tableId)
      if (!table || table.kind !== 'developed') return
      set({
        selectedTableId: tableId,
        realState: {
          edited: {
            id: table.id,
            name: table.name,
            writeTarget: table.writeTarget,
            cron: table.cron,
            materialization: table.materialization,
            sql: table.sql,
          },
        },
        aiProposalState: null,
      })
    },

    createDevelopedTableDraft: () => {
      const id = `dws_new_${crypto.randomUUID().slice(0, 8)}`
      const draft = emptyDraft(id)
      set({
        selectedTableId: id,
        realState: { edited: draft },
        aiProposalState: null,
      })
    },

    updateRealState: (patch) => {
      set((state) => ({
        realState: {
          ...state.realState,
          edited: { ...state.realState.edited, ...patch },
        },
      }))
    },

    setAiProposalState: (proposal) => set({ aiProposalState: proposal }),

    acceptProposal: () => {
      const proposal = get().aiProposalState
      if (!proposal) return

      const edited = get().realState.edited
      const nextEdited: DevelopedTableDraft = {
        ...edited,
        name: proposal.name ?? edited.name,
        writeTarget: proposal.writeTarget ?? edited.writeTarget,
        cron: proposal.cron ?? edited.cron,
        materialization: (proposal.materialization ?? edited.materialization) as MaterializationMode,
        sql: proposal.sql ?? edited.sql,
      }

      set({
        realState: { edited: nextEdited },
        aiProposalState: null,
      })
    },

    rejectProposal: () => set({ aiProposalState: null }),
  }
})

