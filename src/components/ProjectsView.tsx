import { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, MessageSquare } from 'lucide-react'
import type { Project, ProjectStatus, Session } from '../types'
import ProjectModal from './ProjectModal'
import type { ProjectFormData } from './ProjectModal'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Props {
  projects: Project[]
  sessions: Session[]
  folders?: string[]
  onCreateProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'sessionIds'>) => void
  onUpdateProject: (id: string, data: Partial<Project>) => void
  onDeleteProject: (id: string) => void
  onAssignSession: (sessionId: string, projectId: string | null) => void
  onSelectSession: (session: Session) => void
  onSelectProject: (projectId: string) => void
}

const COLUMNS: { status: ProjectStatus; label: string; emptyLabel: string; headerColor: string }[] = [
  { status: 'active',    label: '진행 중',   emptyLabel: '진행 중인 프로젝트 없음', headerColor: 'bg-green-500' },
  { status: 'completed', label: '완료',     emptyLabel: '완료된 프로젝트 없음',    headerColor: 'bg-blue-500' },
  { status: 'archived',  label: '아카이브',  emptyLabel: '아카이브 없음',          headerColor: 'bg-gray-400' },
]

export default function ProjectsView({
  projects, sessions, folders,
  onCreateProject, onUpdateProject, onDeleteProject,
  onAssignSession, onSelectSession, onSelectProject,
}: Props) {
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; project: Project } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<ProjectStatus | null>(null)

  const grouped = useMemo(() => ({
    active:    projects.filter(p => (p.status || 'active') === 'active'),
    completed: projects.filter(p => p.status === 'completed'),
    archived:  projects.filter(p => p.status === 'archived'),
  }), [projects])

  const getSessionCount = (projectId: string) =>
    sessions.filter(s => s.projectId === projectId && !s.isDeleted).length

  const getLastActivity = (projectId: string) => {
    const ps = sessions.filter(s => s.projectId === projectId && !s.isDeleted)
    if (ps.length === 0) return null
    return new Date(Math.max(...ps.map(s => new Date(s.lastActivity).getTime())))
  }

  // 프로젝트 드래그&드롭 (칸반 열 이동)
  const handleProjectDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggingProjectId(projectId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleProjectDragEnd = () => {
    setDraggingProjectId(null)
    setDragOverColumn(null)
  }
  const handleColumnDragOver = (e: React.DragEvent, status: ProjectStatus) => {
    e.preventDefault()
    if (draggingProjectId) setDragOverColumn(status)
  }
  const handleColumnDragLeave = () => setDragOverColumn(null)
  const handleColumnDrop = (status: ProjectStatus) => {
    if (draggingProjectId) {
      onUpdateProject(draggingProjectId, { status })
    }
    setDraggingProjectId(null)
    setDragOverColumn(null)
  }

  const handleSave = (data: ProjectFormData) => {
    if (modal?.mode === 'edit') {
      onUpdateProject(modal.project.id, data)
    } else {
      onCreateProject(data)
    }
    setModal(null)
  }

  return (
    <div className="h-full overflow-hidden flex flex-col bg-surface-soft">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-base shrink-0">
        <h2 className="text-lg font-semibold text-ink-primary">프로젝트</h2>
        <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
          <Plus size={14} />
          새 프로젝트
        </button>
      </div>

      {/* 칸반 보드 */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-5">
        <div className="flex gap-4 h-full min-w-[780px]">
          {COLUMNS.map(({ status, label, emptyLabel, headerColor }) => {
            const items = grouped[status]
            const isDropTarget = dragOverColumn === status && draggingProjectId !== null

            return (
              <div
                key={status}
                onDragOver={e => handleColumnDragOver(e, status)}
                onDragLeave={handleColumnDragLeave}
                onDrop={() => handleColumnDrop(status)}
                className={`flex-1 flex flex-col rounded-2xl border transition-all min-w-[240px] ${
                  isDropTarget
                    ? 'border-brand-400 ring-2 ring-brand-100 bg-brand-50/30'
                    : 'border-border bg-surface-base/60'
                }`}
              >
                {/* 칸반 열 헤더 */}
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full ${headerColor}`} />
                  <span className="text-sm font-semibold text-ink-primary">{label}</span>
                  <span className="text-xs text-ink-faint bg-surface-subtle px-1.5 py-0.5 rounded-full">{items.length}</span>
                </div>

                {/* 카드 목록 */}
                <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
                  {items.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-xs text-ink-faint">
                      {emptyLabel}
                    </div>
                  ) : (
                    items.map(project => (
                      <KanbanCard
                        key={project.id}
                        project={project}
                        sessionCount={getSessionCount(project.id)}
                        lastActivity={getLastActivity(project.id)}
                        isDragging={draggingProjectId === project.id}
                        deleteConfirm={deleteConfirm}
                        onSelect={() => onSelectProject(project.id)}
                        onEdit={e => { e.stopPropagation(); setModal({ mode: 'edit', project }) }}
                        onDeleteRequest={e => { e.stopPropagation(); setDeleteConfirm(project.id) }}
                        onDeleteConfirm={e => { e.stopPropagation(); onDeleteProject(project.id); setDeleteConfirm(null) }}
                        onDeleteCancel={e => { e.stopPropagation(); setDeleteConfirm(null) }}
                        onDragStart={e => handleProjectDragStart(e, project.id)}
                        onDragEnd={handleProjectDragEnd}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 모달 */}
      {modal && (
        <ProjectModal
          project={modal.mode === 'edit' ? modal.project : null}
          folders={folders}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ─── 칸반 카드 ─────────────────────────────────────────────
function KanbanCard({
  project, sessionCount, lastActivity, isDragging, deleteConfirm,
  onSelect, onEdit, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
  onDragStart, onDragEnd,
}: {
  project: Project
  sessionCount: number
  lastActivity: Date | null
  isDragging: boolean
  deleteConfirm: string | null
  onSelect: () => void
  onEdit: (e: React.MouseEvent) => void
  onDeleteRequest: (e: React.MouseEvent) => void
  onDeleteConfirm: (e: React.MouseEvent) => void
  onDeleteCancel: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`bg-surface-base rounded-xl border border-border p-3 cursor-pointer transition-all group shadow-sm
        hover:shadow-md hover:border-border
        ${isDragging ? 'opacity-40 scale-95' : ''}
      `}
    >
      {/* 이름 + 액션 */}
      <div className="flex items-start gap-2">
        <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: project.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-primary truncate">{project.name}</p>
          {project.description && (
            <p className="text-xs text-ink-muted truncate mt-0.5">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1 text-ink-faint hover:text-ink-secondary rounded" title="수정">
            <Edit2 size={11} />
          </button>
          {deleteConfirm === project.id ? (
            <div className="flex items-center gap-0.5">
              <button onClick={onDeleteConfirm} className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded">삭제</button>
              <button onClick={onDeleteCancel} className="px-1.5 py-0.5 bg-surface-subtle text-ink-secondary text-[10px] rounded">취소</button>
            </div>
          ) : (
            <button onClick={onDeleteRequest} className="p-1 text-ink-faint hover:text-red-400 rounded" title="삭제">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* 하단 메타 */}
      <div className="flex items-center gap-2 mt-2 pl-[18px] text-[11px] text-ink-faint">
        <MessageSquare size={10} />
        <span>{sessionCount}개 세션</span>
        {lastActivity && (
          <>
            <span>·</span>
            <span>{formatDistanceToNow(lastActivity, { addSuffix: true, locale: ko })}</span>
          </>
        )}
      </div>
    </div>
  )
}
