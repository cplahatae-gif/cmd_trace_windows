import { useMemo, useState } from 'react'
import { Search, RefreshCw, Loader2, Trash2, Star, Pin, Layers, Check, X } from 'lucide-react'
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
  selectedSessionIds: Set<string>
  onToggleSelect: (id: string) => void
  onSaveAsWorkspace: () => void
  onClearSelection: () => void
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
  selectedSessionIds,
  onToggleSelect,
  onSaveAsWorkspace,
  onClearSelection,
}: Props) {
  const grouped = useMemo(() => groupByDate(sessions), [sessions])

  return (
    <div className="w-80 flex flex-col border-r border-border bg-surface-soft shrink-0">
      {/* 검색 헤더 */}
      <div className="px-4 py-3 border-b border-border space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-primary">세션 목록</span>
          <span className="text-xs text-ink-muted">({sessions.length})</span>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="ml-auto text-ink-muted hover:text-ink-secondary transition-colors p-1.5 rounded-lg hover:bg-surface-subtle"
          >
            {isLoading
              ? <Loader2 size={15} className="animate-spin" />
              : <RefreshCw size={15} />
            }
          </button>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface-base border border-border rounded-lg text-sm text-ink-primary placeholder-ink-muted focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
          />
        </div>
      </div>

      {/* 멀티셀렉트 액션바 */}
      {selectedSessionIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-brand-50 border-b border-brand-100">
          <span className="text-xs text-brand-700 font-medium flex-1">
            {selectedSessionIds.size}개 선택됨
          </span>
          <button
            onClick={onSaveAsWorkspace}
            className="flex items-center gap-1 px-2.5 py-1 bg-brand-500 text-white text-xs font-semibold rounded-lg hover:bg-brand-600 transition-colors"
          >
            <Layers size={11} />
            워크스페이스로 저장
          </button>
          <button
            onClick={onClearSelection}
            className="text-brand-400 hover:text-brand-600 p-1 rounded transition-colors"
            title="선택 해제"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* 세션 목록 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-ink-muted">
            <Loader2 size={20} className="animate-spin mr-2" />
            <span className="text-sm">로딩 중...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-ink-muted gap-2">
            <span className="text-3xl">📭</span>
            <span className="text-sm">세션이 없습니다</span>
          </div>
        ) : (
          grouped.map(({ label, items }) => (
            <div key={label}>
              <div className="px-4 py-2 text-xs font-semibold text-ink-muted uppercase tracking-widest bg-surface-soft sticky top-0">
                {label}
              </div>
              {items.map(session => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isSelected={selectedSession?.id === session.id}
                  isChecked={selectedSessionIds.has(session.id)}
                  onSelect={() => onSelectSession(session)}
                  onDelete={() => onDelete(session.id)}
                  onToggleSelect={() => onToggleSelect(session.id)}
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
  isChecked,
  onSelect,
  onDelete,
  onToggleSelect,
  relativeTime,
}: {
  session: Session
  isSelected: boolean
  isChecked: boolean
  onSelect: () => void
  onDelete: () => void
  onToggleSelect: () => void
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
    <div
      className={`flex items-stretch border-b border-border transition-colors group relative ${
        isSelected ? 'bg-brand-50 border-l-2 border-l-brand-500' : 'bg-surface-soft hover:bg-surface-base'
      }`}
    >
      {/* 체크박스 영역: hover 시 또는 체크됐을 때 표시 */}
      <div
        onClick={e => { e.stopPropagation(); onToggleSelect() }}
        className={`flex items-center justify-center w-8 shrink-0 cursor-pointer transition-opacity ${
          isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
          isChecked ? 'bg-brand-500 border-brand-500' : 'border-border bg-surface-base hover:border-brand-300'
        }`}>
          {isChecked && <Check size={10} className="text-white" />}
        </div>
      </div>

      {/* 세션 콘텐츠 버튼 */}
      <button
        onClick={onSelect}
        className="flex-1 text-left px-3 py-3 min-w-0"
      >
        {showDeleteConfirm ? (
          <div className="flex items-center justify-between gap-2 py-1">
            <span className="text-sm text-ink-secondary">휴지통으로 이동?</span>
            <div className="flex gap-1.5">
              <button
                onClick={handleConfirmDelete}
                className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg"
              >
                삭제
              </button>
              <button
                onClick={handleCancelDelete}
                className="px-2.5 py-1 bg-surface-subtle hover:bg-surface-soft text-ink-secondary text-xs rounded-lg border border-border"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 pr-7">
              {session.isPinned && <Pin size={10} className="text-brand-400 shrink-0" fill="currentColor" />}
              {session.isFavorited && <Star size={10} className="text-amber-400 shrink-0" fill="currentColor" />}
              <p className={`text-sm font-medium truncate leading-snug ${
                isSelected ? 'text-brand-700' : 'text-ink-primary'
              }`}>{displayTitle}</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-ink-muted truncate flex-1">{projectName}</span>
              <span className="text-xs text-ink-faint shrink-0">{relativeTime}</span>
            </div>
            {session.tags.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {session.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-brand-50 text-brand-600 rounded-full font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={handleDeleteClick}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-ink-faint hover:text-red-400 transition-all"
              title="휴지통으로 이동"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </button>
    </div>
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
