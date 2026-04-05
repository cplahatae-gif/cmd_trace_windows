import { useState, useMemo } from 'react'
import { ArrowLeft, Edit2, Search, Star, Pin, X, MessageSquare } from 'lucide-react'
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
    () => sessions.filter(s => s.projectId === project.id && !s.isDeleted)
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()),
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

  // 키워드 추출 (불용어 제거 + 빈도 상위 8개)
  const keywords = useMemo(() => {
    if (projectSessions.length === 0) return []
    const stopWords = new Set([
      'the','a','an','is','are','was','were','and','or','but','in','on','at','to','for','of','with','by','from','this','that','it','be','as','do','did','have','has','will','can','my','your','we','our','you','i',
      '을','를','이','가','에','에서','의','하','한','해','해줘','좀','그','저','것','수','등','및','할','된','되','인','있','없','거','내','나','뭐','이거','저거','어떻게','왜','무슨','제','어디','지금','다시','어떤',
    ])
    const words = new Map<string, number>()
    for (const s of projectSessions) {
      const text = `${s.customName || ''} ${s.preview}`
      const tokens = text.split(/[\s,.\-:;!?()[\]{}'"\/\\`]+/)
        .map(w => w.toLowerCase().trim())
        .filter(w => w.length > 1 && !stopWords.has(w) && !/^\d+$/.test(w))
      for (const t of tokens) words.set(t, (words.get(t) || 0) + 1)
    }
    return Array.from(words.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word)
  }, [projectSessions])

  // 타임라인: 날짜별 세션 그룹핑
  const timeline = useMemo(() => {
    if (projectSessions.length === 0) return []
    const groups = new Map<string, Session[]>()
    for (const s of projectSessions) {
      const dateKey = new Date(s.lastActivity).toLocaleDateString('ko-KR')
      if (!groups.has(dateKey)) groups.set(dateKey, [])
      groups.get(dateKey)!.push(s)
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .slice(0, 10)
  }, [projectSessions])

  // 프로젝트 폴더 경로 (공통)
  const projectFolder = useMemo(() => {
    if (projectSessions.length === 0) return null
    const folder = projectSessions[0]?.project
    return folder?.split(/[\\/]/).pop() || folder
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

  const stats = [
    { label: '세션', value: projectSessions.length.toString(), icon: '💬' },
    { label: '메시지', value: totalMessages.toLocaleString(), icon: '📨' },
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

        {/* 통계 + 폴더 정보 */}
        <div className="flex gap-3">
          {stats.map(stat => (
            <div key={stat.label} className="flex-1 bg-white rounded-xl p-3.5 border border-[rgba(0,0,0,0.08)] shadow-card">
              <div className="text-base mb-1">{stat.icon}</div>
              <div className="text-xl font-bold text-ink-primary leading-none mb-0.5">{stat.value}</div>
              <div className="text-xs text-ink-muted">{stat.label}</div>
            </div>
          ))}
          {projectFolder && (
            <div className="flex-1 bg-white rounded-xl p-3.5 border border-[rgba(0,0,0,0.08)] shadow-card">
              <div className="text-base mb-1">📂</div>
              <div className="text-sm font-semibold text-ink-primary leading-snug truncate">{projectFolder}</div>
              <div className="text-xs text-ink-muted">작업 폴더</div>
            </div>
          )}
        </div>

        {/* 프로젝트 요약 — 키워드 + 타임라인 */}
        {(keywords.length > 0 || timeline.length > 0) && (
          <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-card p-5">
            <h3 className="text-sm font-semibold text-ink-primary mb-3">프로젝트 요약</h3>

            {/* 키워드 태그 */}
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {keywords.map(kw => (
                  <span key={kw} className="px-2.5 py-0.5 text-[11px] bg-brand-50 text-brand-600 border border-brand-100 rounded-full font-medium">
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* 타임라인 */}
            {timeline.length > 0 && (
              <div className="space-y-3">
                {timeline.map(([dateKey, daySessions]) => (
                  <div key={dateKey}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold text-ink-secondary">{dateKey}</span>
                      <span className="text-[10px] text-ink-faint">({daySessions.length}세션)</span>
                    </div>
                    <div className="pl-3 border-l-2 border-[rgba(0,0,0,0.06)] space-y-1">
                      {daySessions.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <span className="text-[10px] text-ink-faint shrink-0">
                            {i === daySessions.length - 1 ? '└─' : '├─'}
                          </span>
                          <button
                            onClick={() => onSelectSession(s)}
                            className="flex-1 text-left min-w-0 group"
                          >
                            <span className="text-xs text-ink-secondary group-hover:text-ink-primary truncate block transition-colors">
                              {s.customName || s.preview.slice(0, 60) || s.sessionId}
                            </span>
                          </button>
                          <span className="text-[10px] text-ink-faint shrink-0 tabular-nums">{s.messageCount}개</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

          <div className="divide-y divide-[rgba(0,0,0,0.05)] max-h-[400px] overflow-y-auto scrollbar-thin">
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

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-soft transition-colors group">
      <div className="flex items-center gap-1 shrink-0">
        {session.isPinned && <Pin size={11} className="text-brand-400" fill="currentColor" />}
        {session.isFavorited && <Star size={11} className="text-amber-400" fill="currentColor" />}
        {!session.isPinned && !session.isFavorited && <MessageSquare size={11} className="text-ink-faint" />}
      </div>

      <button onClick={onSelect} className="flex-1 text-left min-w-0">
        <p className="text-sm text-ink-primary truncate">{title}</p>
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
