import type { DevelopmentAiPayload } from '../components/DevelopmentModule'
import type { TableResource } from '../types/domain'
import { DevelopmentDbtPage } from '../modules/data-development/DevelopmentDbtPage'

type PreviewRow = { order_id: string; user_phone: string; amount: string }
type SchemaRow = { id: string; field: string; type: string }

type DevelopmentWorkspaceProps = {
  activeTable: TableResource
  unsaved: boolean
  previewRows: PreviewRow[]
  schemaRows: SchemaRow[]
  aiPayload?: DevelopmentAiPayload | null
  onAiPayloadConsumed?: () => void
}

export function DevelopmentWorkspace({ aiPayload }: DevelopmentWorkspaceProps) {
  return <DevelopmentDbtPage aiPayload={aiPayload} />
}

