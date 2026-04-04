import { Search, RefreshCw, Loader2 } from 'lucide-react'
import type { Session } from '../types'

interface Props {
  sessions: Session[]
  selectedSession: Session | null
  onSelectSession: (s: Session) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  isLoading: boolean
  onRefresh: () => void
  formatRelativeTime: (date: string) => string
}

export default function SessionList({
  sessions,
  selectedSession,
  onSelectSession,
  searchQuery,
  onSearchChange,
  isLoading,
  onRefresh,
  formatRelativeTime,
}: Props) {
  // 날짜 그룹별 묶기
  const grouped = groupByDate(sessions)

  return (
    <div className="w-72 flex flex-col border-r border-slate-800 bg-slate-900 shrink-0">
      {/* 검색 헤더 */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-300">세션 목록</span>
          <span className="text-xs text-slate-500">({sessions.length})</span>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
          >
            {isLoading
              ? <Loader2 size={14} className="animate-spin" />
              : <RefreshCw size={14} />
            }
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
      </div>

      {/* 세션 목록 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500">
            <Loader2 size={20} className="animate-spin mr-2" />
            <span className="text-sm">로딩 중...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500 gap-2">
            <span className="text-2xl">📭</span>
            <span className="text-sm">세션이 없습니다</span>
          </div>
        ) : (
          grouped.map(({ label, items }) => (
            <div key={label}>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-900 sticky top-0">
                {label}
              </div>
              {items.map(session => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isSelected={selectedSession?.id === session.id}
                  onSelect={() => onSelectSession(session)}
                  relativeTime={formatRelativeTime(session.lastActivity)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── 세션 아이템 ──────────────────────────────────────────
function SessionItem({
  session,
  isSelected,
  onSelect,
  relativeTime,
}: {
  session: Session
  isSelected: boolean
  onSelect: () => void
  relativeTime: string
}) {
  const displayTitle = session.customName || session.preview.slice(0, 60) || session.sessionId
  const projectName = session.project.split(/[\\/]/).pop() || session.project

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 border-b border-slate-800 transition-colors ${
        isSelected
          ? 'bg-brand-900/50 border-l-2 border-l-brand-500'
          : 'hover:bg-slate-800/60'
      }`}
    >
      <p className="text-sm text-slate-200 truncate leading-snug">{displayTitle}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[11px] text-slate-500 truncate flex-1">{projectName}</span>
        <span className="text-[10px] text-slate-600 shrink-0">{relativeTime}</span>
      </div>
      {session.tags.length > 0 && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {session.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-brand-900/40 text-brand-300 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

// ─── 날짜 그룹 생성 ──────────────────────────────────────
function groupByDate(sessions: Session[]) {
  const groups: Record<string, Session[]> = {}
  const now = new Date()

  for (const s of sessions) {
    const d = new Date(s.lastActivity)
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)

    let label: string
    if (diffDays === 0) label = '오늘'
    else if (diffDays === 1) label = '어제'
    else if (diffDays < 7) label = '이번 주'
    else if (diffDays < 30) label = '이번 달'
    else label = '이전'

    if (!groups[label]) groups[label] = []
    groups[label].push(s)
  }

  const order = ['오늘', '어제', '이번 주', '이번 달', '이전']
  return order
    .filter(l => groups[l]?.length > 0)
    .map(l => ({ label: l, items: groups[l] }))
}
