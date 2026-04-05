import { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, MessageSquare, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react'
import type { Project, ProjectStatus, Session } from '../types'
import ProjectModal from './ProjectModal'
import type { ProjectFormData } from './ProjectModal'
import ProjectStatusBadge from './ProjectStatusBadge'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Props {
  projects: Project[]
  sessions: Session[]
  onCreateProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'sessionIds'>) => void
  onUpdateProject: (id: string, data: Partial<Project>) => void
  onDeleteProject: (id: string) => void
  onAssignSession: (sessionId: string, projectId: string | null) => void
  onSelectSession: (session: Session) => void
  onSelectProject: (projectId: string) => void
}

const STATUS_SECTIONS: { status: ProjectStatus; label: string; defaultOpen: boolean }[] = [
  { status: 'active',   label: '진행 중',   defaultOpen: true },
  { status: 'pending',  label: '대기 중',   defaultOpen: true },
  { status: 'archived', label: '아카이브',  defaultOpen: false },
]

export default function ProjectsView({
  projects, sessions,
  onCreateProject, onUpdateProject, onDeleteProject,
  onAssignSession, onSelectSession, onSelectProject,
}: Props) {
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; project: Project } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [draggingSession, setDraggingSession] = useState<string | null>(null)
  const [dragOverProject, setDragOverProject] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<ProjectStatus, boolean>>({
    active: false, pending: false, archived: true,
  })

  const grouped = useMemo(() => ({
    active:   projects.filter(p => (p.status || 'active') === 'active'),
    pending:  projects.filter(p => p.status === 'pending'),
    archived: projects.filter(p => p.status === 'archived'),
  }), [projects])

  const getProjectSessions = (projectId: string) =>
    sessions.filter(s => s.projectId === projectId && !s.isDeleted)

  const unassignedSessions = sessions.filter(s => !s.projectId && !s.isDeleted)

  const handleDragStart = (sessionId: string) => setDraggingSession(sessionId)
  const handleDragEnd = () => { setDraggingSession(null); setDragOverProject(null) }
  const handleDrop = (projectId: string | null) => {
    if (draggingSession) onAssignSession(draggingSession, projectId)
    setDraggingSession(null)
    setDragOverProject(null)
  }

  const handleSave = (data: ProjectFormData) => {
    if (modal?.mode === 'edit') {
      onUpdateProject(modal.project.id, data)
    } else {
      onCreateProject(data)
    }
    setModal(null)
  }

  const toggleCollapse = (status: ProjectStatus) =>
    setCollapsed(prev => ({ ...prev, [status]: !prev[status] }))

  return (
    <div className="h-full overflow-y-auto scrollbar-thin px-6 py-5 bg-surface-soft">
      <div className="max-w-5xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-ink-primary">프로젝트</h2>
          <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
            <Plus size={14} />
            새 프로젝트
          </button>
        </div>

        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-ink-muted gap-3">
            <span className="text-5xl">📁</span>
            <p className="text-base font-medium text-ink-secondary">프로젝트가 없습니다</p>
            <p className="text-sm">세션을 그룹으로 묶어 관리하려면 프로젝트를 만드세요</p>
          </div>
        )}

        {/* 상태별 섹션 */}
        {STATUS_SECTIONS.map(({ status, label }) => {
          const items = grouped[status]
          if (items.length === 0) return null
          const isCollapsed = collapsed[status]

          return (
            <div key={status} className="mb-6">
              {/* 섹션 헤더 */}
              <button
                onClick={() => toggleCollapse(status)}
                className="flex items-center gap-2 mb-3 group"
              >
                {isCollapsed
                  ? <ChevronRight size={14} className="text-ink-muted" />
                  : <ChevronDown size={14} className="text-ink-muted" />
                }
                <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{label}</span>
                <span className="text-xs text-ink-faint">({items.length})</span>
              </button>

              {!isCollapsed && (
                <div className="grid grid-cols-2 gap-3">
                  {items.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      sessions={getProjectSessions(project.id)}
                      isDragTarget={dragOverProject === project.id}
                      deleteConfirm={deleteConfirm}
                      onSelect={() => onSelectProject(project.id)}
                      onEdit={e => { e.stopPropagation(); setModal({ mode: 'edit', project }) }}
                      onDeleteRequest={e => { e.stopPropagation(); setDeleteConfirm(project.id) }}
                      onDeleteConfirm={e => { e.stopPropagation(); onDeleteProject(project.id); setDeleteConfirm(null) }}
                      onDeleteCancel={e => { e.stopPropagation(); setDeleteConfirm(null) }}
                      onDragOver={e => { e.preventDefault(); setDragOverProject(project.id) }}
                      onDragLeave={() => setDragOverProject(null)}
                      onDrop={() => handleDrop(project.id)}
                      onSessionSelect={onSelectSession}
                      onSessionRemove={sid => onAssignSession(sid, null)}
                      onSessionDragStart={handleDragStart}
                      onSessionDragEnd={handleDragEnd}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* 미분류 세션 */}
        {unassignedSessions.length > 0 && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOverProject('unassigned') }}
            onDragLeave={() => setDragOverProject(null)}
            onDrop={() => handleDrop(null)}
            className={`bg-white rounded-2xl border shadow-card transition-all ${
              dragOverProject === 'unassigned'
                ? 'border-brand-400 ring-2 ring-brand-100'
                : 'border-[rgba(0,0,0,0.08)]'
            }`}
          >
            <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-2">
              <FolderOpen size={14} className="text-ink-muted" />
              <span className="text-sm font-semibold text-ink-secondary">미분류 세션</span>
              <span className="text-xs text-ink-muted ml-1">{unassignedSessions.length}개</span>
            </div>
            <div className="p-2 grid grid-cols-2 gap-1">
              {unassignedSessions.slice(0, 10).map(s => (
                <SessionChip
                  key={s.id}
                  session={s}
                  onSelect={() => onSelectSession(s)}
                  onDragStart={() => handleDragStart(s.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
              {unassignedSessions.length > 10 && (
                <p className="text-xs text-ink-muted text-center py-1 col-span-2">
                  +{unassignedSessions.length - 10}개 더 (세션 목록에서 확인)
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 모달 */}
      {modal && (
        <ProjectModal
          project={modal.mode === 'edit' ? modal.project : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ─── 프로젝트 카드 ─────────────────────────────────────────
function ProjectCard({
  project, sessions, isDragTarget, deleteConfirm,
  onSelect, onEdit, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
  onDragOver, onDragLeave, onDrop,
  onSessionSelect, onSessionRemove, onSessionDragStart, onSessionDragEnd,
}: {
  project: Project
  sessions: Session[]
  isDragTarget: boolean
  deleteConfirm: string | null
  onSelect: () => void
  onEdit: (e: React.MouseEvent) => void
  onDeleteRequest: (e: React.MouseEvent) => void
  onDeleteConfirm: (e: React.MouseEvent) => void
  onDeleteCancel: (e: React.MouseEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: () => void
  onSessionSelect: (s: Session) => void
  onSessionRemove: (id: string) => void
  onSessionDragStart: (id: string) => void
  onSessionDragEnd: () => void
}) {
  const lastActivity = sessions.length > 0
    ? Math.max(...sessions.map(s => new Date(s.lastActivity).getTime()))
    : null

  return (
    <div
      onClick={onSelect}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`bg-white rounded-2xl border shadow-card transition-all cursor-pointer hover:shadow-md hover:border-[rgba(0,0,0,0.12)] ${
        isDragTarget ? 'border-brand-400 ring-2 ring-brand-100' : 'border-[rgba(0,0,0,0.08)]'
      }`}
    >
      {/* 카드 헤더 */}
      <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
        <div className="flex items-start gap-2.5">
          <div className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: project.color }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-ink-primary truncate">{project.name}</p>
              <ProjectStatusBadge status={project.status || 'active'} />
            </div>
            {project.description && (
              <p className="text-xs text-ink-muted truncate">{project.description}</p>
            )}
            {project.goal && (
              <p className="text-xs text-brand-500 truncate mt-0.5">🎯 {project.goal}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={onEdit} className="p-1.5 text-ink-faint hover:text-ink-secondary hover:bg-surface-subtle rounded-lg" title="수정">
              <Edit2 size={12} />
            </button>
            {deleteConfirm === project.id ? (
              <div className="flex items-center gap-1">
                <button onClick={onDeleteConfirm} className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-md">삭제</button>
                <button onClick={onDeleteCancel} className="px-2 py-0.5 bg-surface-subtle text-ink-secondary text-xs rounded-md border border-[rgba(0,0,0,0.08)]">취소</button>
              </div>
            ) : (
              <button onClick={onDeleteRequest} className="p-1.5 text-ink-faint hover:text-red-400 hover:bg-red-50 rounded-lg" title="프로젝트 삭제">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* 세션 수 + 마지막 활동 */}
        <div className="flex items-center gap-2 mt-2 text-xs text-ink-muted">
          <MessageSquare size={10} />
          <span>{sessions.length}개 세션</span>
          {lastActivity && (
            <>
              <span className="text-ink-faint">·</span>
              <span>{formatDistanceToNow(new Date(lastActivity), { addSuffix: true, locale: ko })}</span>
            </>
          )}
        </div>
      </div>

      {/* 세션 칩 목록 */}
      <div className="p-2 space-y-1 min-h-[48px]" onClick={e => e.stopPropagation()}>
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-10 text-xs text-ink-faint">
            세션을 드래그하여 추가
          </div>
        ) : (
          sessions.slice(0, 4).map(s => (
            <SessionChip
              key={s.id}
              session={s}
              onSelect={() => onSessionSelect(s)}
              onRemove={() => onSessionRemove(s.id)}
              onDragStart={() => onSessionDragStart(s.id)}
              onDragEnd={onSessionDragEnd}
            />
          ))
        )}
        {sessions.length > 4 && (
          <p className="text-xs text-ink-muted text-center py-1">
            +{sessions.length - 4}개 더 보기 →
          </p>
        )}
      </div>
    </div>
  )
}

// ─── 세션 칩 ─────────────────────────────────────────────
function SessionChip({
  session, onSelect, onRemove, onDragStart, onDragEnd,
}: {
  session: Session
  onSelect: () => void
  onRemove?: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const title = session.customName || session.preview.slice(0, 40) || session.sessionId
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-soft hover:bg-surface-subtle border border-[rgba(0,0,0,0.06)] cursor-grab group transition-colors"
    >
      <MessageSquare size={10} className="text-ink-faint shrink-0" />
      <button
        onClick={onSelect}
        className="flex-1 text-xs text-ink-secondary truncate text-left hover:text-ink-primary"
        title={title}
      >
        {title}
      </button>
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-red-400 transition-all"
          title="프로젝트에서 제거"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  )
}
