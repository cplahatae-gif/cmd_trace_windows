import { useState, useEffect, useCallback } from 'react'
import { Play, FolderOpen, Tag, Edit2, BarChart2, MessageSquare, Loader2, Check, X, Trash2, Star, Pin, Download, FolderPlus, ChevronDown, ExternalLink } from 'lucide-react'
import type { Session, Message, SessionInsights, AppSettings, ExportFormat, Project } from '../types'
import { PROJECT_COLORS } from '../types'
import MessageView from './MessageView'
import InsightsView from './InsightsView'
import ProjectModal from './ProjectModal'
import type { ProjectFormData } from './ProjectModal'

interface Props {
  session: Session
  settings: AppSettings
  isActive?: boolean
  onUpdateMeta: (id: string, updates: { customName?: string; tags?: string[]; isFavorited?: boolean; isPinned?: boolean }) => Promise<void>
  onDelete: (id: string) => void
  projects?: Project[]
  folders?: string[]
  onAssignSession?: (sessionId: string, projectId: string | null) => void
  onCreateProjectFromSession?: (sessionId: string, data: ProjectFormData) => void
}

type Tab = 'messages' | 'insights'

export default function SessionDetail({ session, settings, isActive = false, onUpdateMeta, onDelete, projects, folders, onAssignSession, onCreateProjectFromSession }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [insights, setInsights] = useState<SessionInsights | null>(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('messages')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [isResuming, setIsResuming] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [insightError, setInsightError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)

  const loadMessages = useCallback(async () => {
    if (!window.electronAPI) return
    setIsLoadingMessages(true)
    setMessageError(null)
    try {
      const msgs = await window.electronAPI.loadMessages(session.projectFolder, session.fileName)
      setMessages(msgs)
    } catch (err) {
      console.error('메시지 로드 실패:', err)
      setMessageError('메시지를 불러오는 데 실패했습니다.')
    } finally {
      setIsLoadingMessages(false)
    }
  }, [session.projectFolder, session.fileName])

  useEffect(() => {
    setMessages([])
    setInsights(null)
    setActiveTab('messages')
    setMessageError(null)
    setInsightError(null)
    loadMessages()
  }, [session.id, loadMessages])

  const loadInsights = async () => {
    if (!window.electronAPI || insights) return
    setIsLoadingInsights(true)
    setInsightError(null)
    try {
      const data = await window.electronAPI.loadInsights(session.projectFolder, session.fileName)
      setInsights(data)
    } catch (err) {
      console.error('인사이트 로드 실패:', err)
      setInsightError('인사이트를 불러오는 데 실패했습니다.')
    } finally {
      setIsLoadingInsights(false)
    }
  }

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    if (tab === 'insights') loadInsights()
  }

  const handleResume = async () => {
    if (!window.electronAPI) return
    setIsResuming(true)
    try {
      await window.electronAPI.resumeSession(
        session.sessionId,
        session.project,
        settings.terminal,
        settings.bypassPermissions
      )
    } finally {
      setTimeout(() => setIsResuming(false), 1000)
    }
  }

  const handleOpenFolder = () => {
    if (window.electronAPI && session.project) {
      window.electronAPI.openFolder(session.project)
    }
  }

  const handleToggleFavorite = () =>
    onUpdateMeta(session.id, { isFavorited: !session.isFavorited })

  const handleTogglePin = () =>
    onUpdateMeta(session.id, { isPinned: !session.isPinned })

  const handleExport = async (format: ExportFormat) => {
    if (!window.electronAPI) return
    setShowExportMenu(false)
    setIsExporting(true)
    try {
      let content = ''
      if (format === 'json') {
        content = JSON.stringify({ session, messages }, null, 2)
      } else if (format === 'html') {
        content = buildHtmlExport(session, messages)
      } else {
        content = buildMarkdownExport(session, messages)
      }
      await window.electronAPI.exportSession(content, format, displayTitle)
    } finally {
      setIsExporting(false)
    }
  }

  const handleSaveName = async () => {
    await onUpdateMeta(session.id, { customName: editName.trim() || undefined })
    setIsEditingName(false)
  }

  const handleAddTag = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !tagInput.trim()) return
    const newTag = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (!session.tags.includes(newTag)) {
      await onUpdateMeta(session.id, { tags: [...session.tags, newTag] })
    }
    setTagInput('')
  }

  const handleRemoveTag = async (tag: string) => {
    await onUpdateMeta(session.id, { tags: session.tags.filter(t => t !== tag) })
  }

  const displayTitle = session.customName || session.preview.slice(0, 80) || session.sessionId
  const projectName = session.project.split(/[\\/]/).pop() || session.project
  const assignedProject = projects?.find(p => p.id === session.projectId)

  const prefillProject: Project = {
    id: '',
    name: session.customName || session.preview.slice(0, 50).trim(),
    description: session.preview.slice(0, 120).trim(),
    color: PROJECT_COLORS[0],
    status: 'active',
    folderPath: session.project,
    createdAt: '',
    updatedAt: '',
    sessionIds: [],
  }

  const handleCreateProject = (data: ProjectFormData) => {
    onCreateProjectFromSession?.(session.id, data)
    setShowNewProjectModal(false)
  }

  const handleAssignToProject = (projectId: string) => {
    onAssignSession?.(session.id, projectId)
    setShowProjectMenu(false)
  }

  const handleUnassignProject = () => {
    onAssignSession?.(session.id, null)
  }

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border bg-surface-base shrink-0">
        {/* 타이틀 */}
        <div className="flex items-start gap-2 mb-2">
          {isEditingName ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false) }}
                className="flex-1 px-2.5 py-1 bg-surface-base border border-brand-400 rounded-lg text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-100 selectable"
                placeholder="세션 이름 입력..."
              />
              <button onClick={handleSaveName} className="text-green-500 hover:text-green-600 p-1">
                <Check size={15} />
              </button>
              <button onClick={() => setIsEditingName(false)} className="text-ink-muted hover:text-ink-secondary p-1">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isActive && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-600 text-[10px] font-semibold rounded-md border border-green-200 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  실행 중
                </span>
              )}
              <h2 className="text-base font-semibold text-ink-primary truncate flex-1 selectable">{displayTitle}</h2>
              <button
                onClick={() => { setEditName(session.customName || ''); setIsEditingName(true) }}
                className="text-ink-faint hover:text-ink-muted shrink-0 p-1 rounded hover:bg-surface-subtle"
              >
                <Edit2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* 메타 정보 */}
        <div className="flex items-center gap-2 text-xs text-ink-muted mb-2">
          <span className="truncate">{projectName}</span>
          <span className="text-ink-faint">·</span>
          <span>{session.messageCount}개</span>
          {session.firstTimestamp && (
            <>
              <span className="text-ink-faint">·</span>
              <span>{formatDuration(session.firstTimestamp, session.lastActivity)}</span>
            </>
          )}
        </div>

        {/* 태그 */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {session.tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-brand-50 text-brand-600 rounded-full font-medium">
              #{tag}
              <button onClick={() => handleRemoveTag(tag)} className="hover:text-brand-800 ml-0.5">
                <X size={9} />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1">
            <Tag size={10} className="text-ink-faint" />
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="w-20 bg-transparent text-[11px] text-ink-secondary focus:outline-none placeholder-ink-faint"
              placeholder="태그 추가..."
            />
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResume}
            disabled={isResuming}
            className="btn-primary"
          >
            {isResuming ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            세션 재개
          </button>
          <button onClick={handleOpenFolder} className="btn-secondary">
            <FolderOpen size={12} />
            폴더
          </button>

          {/* 즐겨찾기 */}
          <button
            onClick={handleToggleFavorite}
            title={session.isFavorited ? '즐겨찾기 해제' : '즐겨찾기'}
            className={`p-1.5 rounded-lg transition-colors ${
              session.isFavorited
                ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                : 'text-ink-faint hover:text-amber-500 hover:bg-amber-50'
            }`}
          >
            <Star size={13} fill={session.isFavorited ? 'currentColor' : 'none'} />
          </button>

          {/* 핀 */}
          <button
            onClick={handleTogglePin}
            title={session.isPinned ? '핀 해제' : '핀'}
            className={`p-1.5 rounded-lg transition-colors ${
              session.isPinned
                ? 'text-brand-500 bg-brand-50 hover:bg-brand-100'
                : 'text-ink-faint hover:text-brand-500 hover:bg-brand-50'
            }`}
          >
            <Pin size={13} fill={session.isPinned ? 'currentColor' : 'none'} />
          </button>

          {/* Obsidian 프로젝트 노트 열기 */}
          {assignedProject?.obsidianNotePath && (
            <button
              onClick={() => window.electronAPI?.openObsidianNote(assignedProject.obsidianNotePath!)}
              title="이 세션이 속한 프로젝트의 Obsidian 노트 열기"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-100 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <ExternalLink size={12} />
              Obsidian
            </button>
          )}

          {/* 프로젝트 등록/배정 */}
          {(projects !== undefined) && (
            <div className="relative">
              {assignedProject ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface-base text-xs text-ink-secondary">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: assignedProject.color }} />
                  <span className="max-w-[80px] truncate">{assignedProject.name}</span>
                  <button
                    onClick={handleUnassignProject}
                    className="text-ink-faint hover:text-ink-secondary ml-0.5"
                    title="프로젝트에서 제거"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowProjectMenu(v => !v)}
                  className="btn-secondary"
                  title="프로젝트에 추가"
                >
                  <FolderPlus size={12} />
                  프로젝트
                  <ChevronDown size={10} />
                </button>
              )}
              {showProjectMenu && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-surface-base rounded-xl border border-border shadow-panel z-20 py-1 max-h-64 overflow-y-auto">
                  {projects.filter(p => p.id !== session.projectId).length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-medium text-ink-faint uppercase tracking-wide">기존 프로젝트에 추가</div>
                      {projects.filter(p => p.id !== session.projectId).map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleAssignToProject(p.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink-secondary hover:bg-surface-soft transition-colors"
                        >
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="truncate">{p.name}</span>
                        </button>
                      ))}
                      <div className="border-t border-border my-1" />
                    </>
                  )}
                  <button
                    onClick={() => { setShowProjectMenu(false); setShowNewProjectModal(true) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-brand-600 font-medium hover:bg-brand-50 transition-colors"
                  >
                    <FolderPlus size={12} />
                    새 프로젝트로 등록
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 내보내기 */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(v => !v)}
              disabled={isExporting || messages.length === 0}
              title="내보내기"
              className="btn-secondary disabled:opacity-40"
            >
              {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              내보내기
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-surface-base rounded-xl border border-border shadow-panel z-10 py-1">
                {(['md', 'json', 'html'] as ExportFormat[]).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    className="w-full text-left px-3 py-2 text-xs text-ink-secondary hover:bg-surface-soft transition-colors"
                  >
                    {fmt === 'md' ? '📝 Markdown' : fmt === 'json' ? '📦 JSON' : '🌐 HTML'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-ink-secondary">삭제?</span>
                <button
                  onClick={() => onDelete(session.id)}
                  className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg"
                >
                  이동
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1 bg-surface-subtle hover:bg-surface-soft text-ink-secondary text-xs rounded-lg border border-border"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 text-ink-faint hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                title="세션 삭제"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-border shrink-0 bg-surface-base px-1">
        {([
          { id: 'messages' as const, icon: MessageSquare, label: '대화 내용' },
          { id: 'insights' as const, icon: BarChart2, label: '인사이트' },
        ]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-ink-muted hover:text-ink-secondary'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-hidden bg-surface-soft">
        {activeTab === 'messages' ? (
          isLoadingMessages ? (
            <div className="flex items-center justify-center h-full text-ink-muted">
              <Loader2 size={18} className="animate-spin mr-2" />
              <span className="text-sm">로딩 중...</span>
            </div>
          ) : messageError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <span className="text-red-500 text-sm">⚠️ {messageError}</span>
              <button onClick={loadMessages} className="btn-secondary">
                다시 시도
              </button>
            </div>
          ) : (
            <MessageView messages={messages} />
          )
        ) : (
          isLoadingInsights ? (
            <div className="flex items-center justify-center h-full text-ink-muted">
              <Loader2 size={18} className="animate-spin mr-2" />
              <span className="text-sm">로딩 중...</span>
            </div>
          ) : insightError ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-red-500 text-sm">⚠️ {insightError}</span>
            </div>
          ) : insights ? (
            <InsightsView insights={insights} />
          ) : null
        )}
      </div>

      {/* 새 프로젝트 생성 모달 (세션 정보 자동 채움) */}
      {showNewProjectModal && (
        <ProjectModal
          project={prefillProject}
          folders={folders}
          onSave={handleCreateProject}
          onClose={() => setShowNewProjectModal(false)}
        />
      )}
    </div>
  )
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}분`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hours}시간 ${rem}분` : `${hours}시간`
}

function buildMarkdownExport(session: Session, messages: Message[]): string {
  const title = session.customName || session.preview.slice(0, 80) || session.sessionId
  const lines = [
    `# ${title}`,
    '',
    `> **프로젝트**: ${session.project}  `,
    `> **메시지**: ${session.messageCount}개  `,
    `> **날짜**: ${session.firstTimestamp ? new Date(session.firstTimestamp).toLocaleDateString('ko-KR') : '-'}`,
    '',
    '---',
    '',
  ]
  for (const m of messages) {
    const role = m.role === 'user' ? '👤 **User**' : '🤖 **Assistant**'
    lines.push(role, '', m.content, '', '---', '')
  }
  return lines.join('\n')
}

function buildHtmlExport(session: Session, messages: Message[]): string {
  const title = session.customName || session.preview.slice(0, 80) || session.sessionId
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const msgHtml = messages.map(m => `
    <div class="msg ${m.role}">
      <div class="role">${m.role === 'user' ? '👤 User' : '🤖 Assistant'}</div>
      <div class="content">${escape(m.content)}</div>
    </div>`).join('\n')

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>${escape(title)}</title>
<style>
  body { font-family: 'Pretendard', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; background: #f5f6f8; color: #1a1d23; }
  h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
  .meta { font-size: 0.8rem; color: #9ca3af; margin-bottom: 2rem; }
  .msg { background: white; border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 0.75rem; border: 1px solid rgba(0,0,0,0.08); }
  .msg.user { border-left: 3px solid #635bff; }
  .role { font-size: 0.75rem; font-weight: 600; color: #6b7280; margin-bottom: 0.5rem; }
  .content { white-space: pre-wrap; font-size: 0.875rem; line-height: 1.6; }
</style></head><body>
<h1>${escape(title)}</h1>
<div class="meta">${session.project} · ${session.messageCount}개 메시지</div>
${msgHtml}
</body></html>`
}
