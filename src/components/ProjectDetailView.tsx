import { useState, useMemo } from 'react'
import { ArrowLeft, Edit2, Search, Star, Pin, X, MessageSquare } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { Project, ProjectStatus, Session } from '../types'
import ProjectStatusBadge from './ProjectStatusBadge'
import ProjectModal from './ProjectModal'
import type { ProjectFormData } from './ProjectModal'

interface Props {
  project: Project
  sessions: Session[]
  onBack: () => void
  onUpdateProject: (id: string, data: Partial<Project>) => void
  onSelectSession: (session: Session) => void
  onAssignSession: (sessionId: string, projectId: string | null) => void
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'active',   label: '진행 중' },
  { value: 'pending',  label: '대기 중' },
  { value: 'archived', label: '아카이브' },
]

export default function ProjectDetailView({
  project, sessions, onBack, onUpdateProject, onSelectSession, onAssignSession,
}: Props) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesInput, setNotesInput] = useState(project.notes || '')

  // 이 프로젝트에 속한 세션
  const projectSessions = useMemo(
    () => sessions.filter(s => s.projectId === project.id && !s.isDeleted),
    [sessions, project.id]
  )

  // 검색 필터
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return projectSessions
    const q = searchQuery.toLowerCase()
    return projectSessions.filter(s =>
      (s.customName || '').toLowerCase().includes(q) ||
      s.preview.toLowerCase().includes(q)
    )
  }, [projectSessions, searchQuery])

  // 통계
  const totalMessages = useMemo(
    () => projectSessions.reduce((sum, s) => sum + s.messageCount, 0),
    [projectSessions]
  )
  const lastActivity = useMemo(() => {
    if (projectSessions.length === 0) return null
    return new Date(Math.max(...projectSessions.map(s => new Date(s.lastActivity).getTime())))
  }, [projectSessions])
  const firstActivity = useMemo(() => {
    if (projectSessions.length === 0) return null
    const ts = projectSessions.flatMap(s => s.firstTimestamp ? [new Date(s.firstTimestamp).getTime()] : [])
    return ts.length > 0 ? new Date(Math.min(...ts)) : null
  }, [projectSessions])

  // 30일 활동 차트
  const activityData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (29 - i))
      const dateStr = d.toDateString()
      const label = i === 29 ? '오늘' : i === 28 ? '어제' : `${d.getMonth() + 1}/${d.getDate()}`
      return {
        label,
        count: projectSessions.filter(s => new Date(s.lastActivity).toDateString() === dateStr).length,
      }
    })
  }, [projectSessions])

  const handleSaveModal = (data: ProjectFormData) => {
    onUpdateProject(project.id, data)
    setShowEditModal(false)
  }

  const handleStatusChange = (status: ProjectStatus) => {
    onUpdateProject(project.id, { status })
    setShowStatusMenu(false)
  }

  const handleSaveNotes = () => {
    onUpdateProject(project.id, { notes: notesInput.trim() })
    setIsEditingNotes(false)
  }

  const handleCancelNotes = () => {
    setNotesInput(project.notes || '')
    setIsEditingNotes(false)
  }

  const formatDateRange = () => {
    if (!firstActivity && !lastActivity) return '-'
    const fmt = (d: Date) => `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`
    if (firstActivity && lastActivity) {
      if (firstActivity.toDateString() === lastActivity.toDateString()) {
        return `${firstActivity.getFullYear()}.${fmt(firstActivity)}`
      }
      return `${firstActivity.getFullYear()}.${fmt(firstActivity)} ~ ${fmt(lastActivity)}`
    }
    return lastActivity ? formatDistanceToNow(lastActivity, { addSuffix: true, locale: ko }) : '-'
  }

  const stats = [
    { label: '세션', value: projectSessions.length.toString(), icon: '💬' },
    { label: '메시지', value: totalMessages.toLocaleString(), icon: '📨' },
    { label: '활동 기간', value: formatDateRange(), icon: '📅' },
    {
      label: '마지막 활동',
      value: lastActivity ? formatDistanceToNow(lastActivity, { addSuffix: true, locale: ko }) : '-',
      icon: '🕐',
    },
  ]

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-surface-soft">
      <div className="max-w-4xl px-6 py-5 space-y-5">

        {/* 헤더 */}
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-secondary mb-3 transition-colors"
          >
            <ArrowLeft size={13} />
            프로젝트
          </button>

          <div className="flex items-start gap-3">
            <div className="w-4 h-4 rounded-full shrink-0 mt-1" style={{ backgroundColor: project.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-ink-primary">{project.name}</h1>

                {/* 상태 드롭다운 */}
                <div className="relative">
                  <button
                    onClick={() => setShowStatusMenu(v => !v)}
                    className="flex items-center gap-1"
                  >
                    <ProjectStatusBadge status={project.status || 'active'} />
                  </button>
                  {showStatusMenu && (
                    <div className="absolute left-0 top-full mt-1 w-28 bg-white rounded-xl border border-[rgba(0,0,0,0.1)] shadow-panel z-10 py-1">
                      {STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handleStatusChange(opt.value)}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-surface-soft ${
                            (project.status || 'active') === opt.value
                              ? 'text-brand-600 font-medium'
                              : 'text-ink-secondary'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-1.5 text-ink-faint hover:text-ink-secondary hover:bg-surface-subtle rounded-lg transition-colors"
                  title="편집"
                >
                  <Edit2 size={14} />
                </button>
              </div>

              {project.description && (
                <p className="text-sm text-ink-secondary mt-1">{project.description}</p>
              )}
              {project.goal && (
                <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 bg-brand-50 border border-brand-100 rounded-lg">
                  <span className="text-xs">🎯</span>
                  <span className="text-xs text-brand-700 font-medium">{project.goal}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-3">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white rounded-xl p-4 border border-[rgba(0,0,0,0.08)] shadow-card">
              <div className="text-lg mb-1.5">{stat.icon}</div>
              <div className="text-2xl font-bold text-ink-primary leading-none mb-0.5">{stat.value}</div>
              <div className="text-xs text-ink-muted">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* 30일 활동 차트 */}
        {projectSessions.length > 0 && (
          <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-card p-5">
            <h3 className="text-sm font-semibold text-ink-primary mb-4">최근 30일 활동</h3>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={activityData} barSize={6} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  }}
                  formatter={(value: number) => [`${value}개`, '세션']}
                />
                <Bar dataKey="count" fill="#635bff" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 세션 목록 */}
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-card">
          <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-3">
            <span className="text-sm font-semibold text-ink-primary">세션 목록</span>
            <span className="text-xs text-ink-muted">({projectSessions.length}개)</span>
            <div className="ml-auto relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="세션 검색..."
                className="pl-8 pr-3 py-1.5 bg-surface-soft border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-ink-primary focus:outline-none focus:border-brand-400 w-44"
              />
            </div>
          </div>

          <div className="divide-y divide-[rgba(0,0,0,0.05)]">
            {filteredSessions.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-ink-faint text-sm">
                {projectSessions.length === 0 ? '세션이 없습니다' : '검색 결과가 없습니다'}
              </div>
            ) : (
              filteredSessions.map(s => (
                <SessionRow
                  key={s.id}
                  session={s}
                  onSelect={() => onSelectSession(s)}
                  onRemove={() => onAssignSession(s.id, null)}
                />
              ))
            )}
          </div>
        </div>

        {/* 메모 */}
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-primary">메모</h3>
            {!isEditingNotes && (
              <button
                onClick={() => { setNotesInput(project.notes || ''); setIsEditingNotes(true) }}
                className="text-xs text-ink-muted hover:text-ink-secondary px-2.5 py-1 rounded-lg hover:bg-surface-subtle transition-colors"
              >
                편집
              </button>
            )}
          </div>

          {isEditingNotes ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={notesInput}
                onChange={e => setNotesInput(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-brand-300 rounded-lg text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-100 resize-none"
                placeholder="작업 내용, 참고사항, 진행 현황..."
              />
              <div className="flex gap-2">
                <button onClick={handleSaveNotes} className="btn-primary text-xs">저장</button>
                <button onClick={handleCancelNotes} className="btn-secondary text-xs">취소</button>
              </div>
            </div>
          ) : project.notes ? (
            <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{project.notes}</p>
          ) : (
            <p className="text-sm text-ink-faint italic">메모가 없습니다. 편집을 눌러 작성하세요.</p>
          )}
        </div>
      </div>

      {/* 편집 모달 */}
      {showEditModal && (
        <ProjectModal
          project={project}
          onSave={handleSaveModal}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  )
}

// ─── 세션 행 ─────────────────────────────────────────────
function SessionRow({
  session, onSelect, onRemove,
}: {
  session: Session
  onSelect: () => void
  onRemove: () => void
}) {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const title = session.customName || session.preview.slice(0, 80) || session.sessionId
  const projectName = session.project.split(/[\\/]/).pop() || session.project

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-soft transition-colors group">
      <div className="flex items-center gap-1 shrink-0">
        {session.isPinned && <Pin size={11} className="text-brand-400" fill="currentColor" />}
        {session.isFavorited && <Star size={11} className="text-amber-400" fill="currentColor" />}
        {!session.isPinned && !session.isFavorited && <MessageSquare size={11} className="text-ink-faint" />}
      </div>

      <button onClick={onSelect} className="flex-1 text-left min-w-0">
        <p className="text-sm font-medium text-ink-primary truncate">{title}</p>
        <p className="text-xs text-ink-muted truncate">{projectName}</p>
      </button>

      <span className="text-xs text-ink-faint shrink-0 tabular-nums">{session.messageCount}개</span>
      <span className="text-xs text-ink-faint shrink-0">
        {formatDistanceToNow(new Date(session.lastActivity), { addSuffix: true, locale: ko })}
      </span>

      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-all">
        {showRemoveConfirm ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onRemove(); setShowRemoveConfirm(false) }}
              className="px-2 py-0.5 bg-red-500 text-white text-[10px] rounded-md"
            >
              제거
            </button>
            <button
              onClick={() => setShowRemoveConfirm(false)}
              className="p-0.5 text-ink-faint hover:text-ink-secondary"
            >
              <X size={11} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowRemoveConfirm(true)}
            className="text-[10px] text-ink-faint hover:text-red-400 px-1.5 py-0.5 rounded border border-[rgba(0,0,0,0.08)] hover:border-red-200 transition-colors"
          >
            제거
          </button>
        )}
      </div>
    </div>
  )
}
