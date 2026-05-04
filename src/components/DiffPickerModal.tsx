import { useState, useMemo } from 'react'
import { Search, X, GitCompare } from 'lucide-react'
import type { Session } from '../types'

interface Props {
  currentSession: Session
  allSessions: Session[]
  onSelect: (session: Session) => void
  onClose: () => void
}

export default function DiffPickerModal({ currentSession, allSessions, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')

  const candidates = useMemo(() => {
    const q = query.toLowerCase().trim()
    return allSessions
      .filter(s => s.id !== currentSession.id)
      .filter(s => {
        if (!q) return true
        const name = (s.customName || s.preview || s.sessionId).toLowerCase()
        const proj = s.project.toLowerCase()
        return name.includes(q) || proj.includes(q)
      })
      .slice(0, 50)
  }, [allSessions, currentSession.id, query])

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-base rounded-2xl border border-border shadow-panel w-[480px] max-h-[60vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <GitCompare size={16} className="text-brand-500 shrink-0" />
          <span className="text-sm font-semibold text-ink-primary flex-1">비교할 세션 선택</span>
          <button onClick={onClose} className="p-1 text-ink-muted hover:text-ink-secondary rounded-lg">
            <X size={14} />
          </button>
        </div>

        {/* 검색 */}
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="세션 이름 또는 프로젝트 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface-soft border border-border rounded-lg focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        {/* 세션 목록 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {candidates.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-ink-muted text-sm">
              {query ? '검색 결과 없음' : '비교 가능한 세션이 없습니다'}
            </div>
          ) : (
            candidates.map(s => {
              const name = s.customName || s.preview.slice(0, 70) || s.sessionId
              const proj = s.project.split(/[\\/]/).pop() || s.project
              const date = new Date(s.lastActivity).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })

              return (
                <button
                  key={s.id}
                  onClick={() => onSelect(s)}
                  className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-surface-soft transition-colors border-b border-border/50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-primary truncate">{name}</p>
                    <p className="text-[11px] text-ink-muted mt-0.5">{proj} · {date} · {s.messageCount}개</p>
                  </div>
                  {s.tags.slice(0, 2).map(t => (
                    <span key={t} className="shrink-0 text-[10px] px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded-full">#{t}</span>
                  ))}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
