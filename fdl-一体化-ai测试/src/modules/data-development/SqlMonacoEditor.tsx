import Editor from '@monaco-editor/react'

type SqlMonacoEditorProps = {
  value: string
  onChange: (next: string) => void
  highlight?: boolean
}

export function SqlMonacoEditor({ value, onChange, highlight }: SqlMonacoEditorProps) {
  return (
    <div
      className={[
        'h-full rounded-2xl border bg-black/20 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]',
        highlight
          ? 'border-emerald-300/40 ring-2 ring-emerald-500/30 ring-offset-2 ring-offset-[#0b1220]'
          : 'border-white/10',
      ].join(' ')}
    >
      <Editor
        value={value}
        onChange={(v) => onChange(v ?? '')}
        language="sql"
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          padding: { top: 12, bottom: 12 },
        }}
        height="100%"
      />
    </div>
  )
}

