import { useState, useEffect, useCallback } from 'react'
import { Play, FolderOpen, Tag, Edit2, BarChart2, MessageSquare, Loader2, Check, X, Trash2 } from 'lucide-react'
import type { Session, Message, SessionInsights, AppSettings } from '../types'
import MessageView from './MessageView'
import InsightsView from './InsightsView'

interface Props {
  session: Session
  settings: AppSettings
  onUpdateMeta: (id: string, updates: { customName?: string; tags?: string[] }) => Promise<void>
  onDelete: (id: string) => void
}

type Tab = 'messages' | 'insights'

export default function SessionDetail({ session, settings, onUpdateMeta, onDelete }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [insights, setInsights] = useState<SessionInsights | null>(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('messages')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [isResuming, setIsResuming] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [insightError, setInsightError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-[rgba(0,0,0,0.08)] bg-white shrink-0">
        {/* 타이틀 */}
        <div className="flex items-start gap-2 mb-2">
          {isEditingName ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false) }}
                className="flex-1 px-2.5 py-1 bg-white border border-brand-400 rounded-lg text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-100 selectable"
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
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => window.electronAPI?.resetPanes?.()}
            title="패널 레이아웃 초기화"
            className="btn-secondary"
          >
            ⊞ 리셋
          </button>
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
                  className="px-2.5 py-1 bg-surface-subtle hover:bg-surface-soft text-ink-secondary text-xs rounded-lg border border-[rgba(0,0,0,0.08)]"
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
      <div className="flex border-b border-[rgba(0,0,0,0.08)] shrink-0 bg-white px-1">
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
