import { useMemo, useState } from 'react'
import { Search, RefreshCw, Loader2, Trash2 } from 'lucide-react'
import type { Session } from '../types'

interface Props {
  sessions: Session[]
  selectedSession: Session | null
  onSelectSession: (s: Session) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  isLoading: boolean
  onRefresh: () => void
  onDelete: (id: string) => void
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
  onDelete,
  formatRelativeTime,
}: Props) {
  const grouped = useMemo(() => groupByDate(sessions), [sessions])

  return (
    <div className="w-72 flex flex-col border-r border-[rgba(0,0,0,0.08)] bg-surface-soft shrink-0">
      {/* 검색 헤더 */}
      <div className="px-3 py-2.5 border-b border-[rgba(0,0,0,0.07)] space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-ink-primary">세션 목록</span>
          <span className="text-[11px] text-ink-muted">({sessions.length})</span>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="ml-auto text-ink-muted hover:text-ink-secondary transition-colors p-1 rounded hover:bg-surface-subtle"
          >
            {isLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <RefreshCw size={13} />
            }
          </button>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-[rgba(0,0,0,0.1)] rounded-lg text-xs text-ink-primary placeholder-ink-muted focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100 transition-all"
          />
        </div>
      </div>

      {/* 세션 목록 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-ink-muted">
            <Loader2 size={18} className="animate-spin mr-2" />
            <span className="text-xs">로딩 중...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-ink-muted gap-2">
            <span className="text-2xl">📭</span>
            <span className="text-xs">세션이 없습니다</span>
          </div>
        ) : (
          grouped.map(({ label, items }) => (
            <div key={label}>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-ink-muted uppercase tracking-widest bg-surface-soft sticky top-0">
                {label}
              </div>
              {items.map(session => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isSelected={selectedSession?.id === session.id}
                  onSelect={() => onSelectSession(session)}
                  onDelete={() => onDelete(session.id)}
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
  onDelete,
  relativeTime,
}: {
  session: Session
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  relativeTime: string
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const displayTitle = session.customName || session.preview.slice(0, 60) || session.sessionId
  const projectName = session.project.split(/[\\/]/).pop() || session.project

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(false)
  }

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 border-b border-[rgba(0,0,0,0.05)] transition-colors group relative ${
        isSelected
          ? 'bg-brand-50 border-l-2 border-l-brand-500'
          : 'bg-surface-soft hover:bg-white'
      }`}
    >
      {showDeleteConfirm ? (
        <div className="flex items-center justify-between gap-2 py-0.5">
          <span className="text-xs text-ink-secondary">휴지통으로 이동?</span>
          <div className="flex gap-1">
            <button
              onClick={handleConfirmDelete}
              className="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white text-[11px] font-medium rounded"
            >
              삭제
            </button>
            <button
              onClick={handleCancelDelete}
              className="px-2 py-0.5 bg-surface-subtle hover:bg-surface-soft text-ink-secondary text-[11px] rounded border border-[rgba(0,0,0,0.08)]"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className={`text-[13px] font-medium truncate leading-snug pr-6 ${
            isSelected ? 'text-brand-700' : 'text-ink-primary'
          }`}>{displayTitle}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-ink-muted truncate flex-1">{projectName}</span>
            <span className="text-[10px] text-ink-faint shrink-0">{relativeTime}</span>
          </div>
          {session.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {session.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded-full font-medium">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={handleDeleteClick}
            className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 text-ink-faint hover:text-red-400 transition-all"
            title="휴지통으로 이동"
          >
            <Trash2 size={12} />
          </button>
        </>
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
