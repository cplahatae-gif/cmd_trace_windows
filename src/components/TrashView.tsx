import { RotateCcw } from 'lucide-react'
import type { Session } from '../types'

interface Props {
  sessions: Session[]
  onRestore: (id: string) => void
}

export default function TrashView({ sessions, onRestore }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
        <span className="text-5xl">🗑️</span>
        <p className="text-sm">휴지통이 비어 있습니다</p>
      </div>
    )
  }

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-slate-100">휴지통</h2>
        <span className="text-sm text-slate-500">{sessions.length}개 세션</span>
      </div>

      <div className="space-y-2">
        {sessions.map(s => {
          const projectName = s.project.split(/[\\/]/).pop() || s.project
          const displayTitle = s.customName || s.preview.slice(0, 80) || s.sessionId

          return (
            <div key={s.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-start gap-3 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">{displayTitle}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{projectName}</p>
                <p className="text-xs text-slate-600 mt-0.5">{s.messageCount}개 메시지</p>
              </div>
              <button
                onClick={() => onRestore(s.id)}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-brand-600 text-slate-400 hover:text-white text-xs rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="복원"
              >
                <RotateCcw size={12} />
                복원
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
