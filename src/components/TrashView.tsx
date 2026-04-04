import { RotateCcw } from 'lucide-react'
import type { Session } from '../types'

interface Props {
  sessions: Session[]
  onRestore: (id: string) => void
}

export default function TrashView({ sessions, onRestore }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-ink-muted gap-3 bg-surface-soft">
        <span className="text-4xl">🗑️</span>
        <p className="text-sm text-ink-muted">휴지통이 비어 있습니다</p>
      </div>
    )
  }

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-surface-soft">
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-base font-semibold text-ink-primary">휴지통</h2>
          <span className="text-[11px] font-medium text-ink-muted bg-surface-subtle px-2 py-0.5 rounded-full">{sessions.length}개</span>
        </div>

        <div className="space-y-1.5">
          {sessions.map(s => {
            const projectName = s.project.split(/[\\/]/).pop() || s.project
            const displayTitle = s.customName || s.preview.slice(0, 80) || s.sessionId

            return (
              <div key={s.id} className="bg-white rounded-xl px-4 py-3 border border-[rgba(0,0,0,0.08)] flex items-center gap-3 group shadow-card">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-secondary truncate">{displayTitle}</p>
                  <p className="text-[11px] text-ink-muted truncate mt-0.5">{projectName} · {s.messageCount}개 메시지</p>
                </div>
                <button
                  onClick={() => onRestore(s.id)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-ink-muted hover:text-brand-600 hover:bg-brand-50 text-xs font-medium rounded-lg transition-colors opacity-0 group-hover:opacity-100 border border-[rgba(0,0,0,0.08)]"
                  title="복원"
                >
                  <RotateCcw size={11} />
                  복원
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
