import { useState, useEffect, useCallback } from 'react'
import { Play, FolderOpen, Tag, Edit2, BarChart2, MessageSquare, Loader2, Check, X } from 'lucide-react'
import type { Session, Message, SessionInsights, AppSettings } from '../types'
import MessageView from './MessageView'
import InsightsView from './InsightsView'

interface Props {
  session: Session
  settings: AppSettings
  onUpdateMeta: (id: string, updates: { customName?: string; tags?: string[] }) => Promise<void>
}

type Tab = 'messages' | 'insights'

export default function SessionDetail({ session, settings, onUpdateMeta }: Props) {
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

  // I-6: loadMessages를 의존성에 포함
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
    <div className="flex flex-col h-full bg-slate-950">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-900 shrink-0">
        {/* 타이틀 */}
        <div className="flex items-start gap-2 mb-2">
          {isEditingName ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false) }}
                className="flex-1 px-2 py-1 bg-slate-700 border border-brand-500 rounded text-sm text-slate-100 focus:outline-none selectable"
                placeholder="세션 이름 입력..."
              />
              <button onClick={handleSaveName} className="text-green-400 hover:text-green-300">
                <Check size={16} />
              </button>
              <button onClick={() => setIsEditingName(false)} className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-slate-100 truncate flex-1 selectable">{displayTitle}</h2>
              <button
                onClick={() => { setEditName(session.customName || ''); setIsEditingName(true) }}
                className="text-slate-600 hover:text-slate-400 shrink-0"
              >
                <Edit2 size={13} />
              </button>
            </div>
          )}
        </div>

        {/* 메타 정보 */}
        <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
          <span className="truncate">{projectName}</span>
          <span>•</span>
          <span>{session.messageCount}개 메시지</span>
          {session.firstTimestamp && (
            <>
              <span>•</span>
              <span>{formatDuration(session.firstTimestamp, session.lastActivity)}</span>
            </>
          )}
        </div>

        {/* 태그 */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {session.tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 bg-brand-900/40 text-brand-300 rounded-full">
              #{tag}
              <button onClick={() => handleRemoveTag(tag)} className="hover:text-brand-100">
                <X size={10} />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1">
            <Tag size={11} className="text-slate-600" />
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="w-20 bg-transparent text-[11px] text-slate-400 focus:outline-none placeholder-slate-600"
              placeholder="태그 추가..."
            />
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleResume}
            disabled={isResuming}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {isResuming ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            세션 재개
          </button>
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors"
          >
            <FolderOpen size={12} />
            폴더 열기
          </button>
          <button
            onClick={() => window.electronAPI?.resetPanes?.()}
            title="패널 레이아웃 초기화 (다음 재개부터 왼쪽부터 시작)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs rounded-lg transition-colors"
          >
            ⊞ 리셋
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-slate-800 shrink-0 bg-slate-900">
        {([
          { id: 'messages' as const, icon: MessageSquare, label: '대화 내용' },
          { id: 'insights' as const, icon: BarChart2, label: '인사이트' },
        ]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors ${
              activeTab === id
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'messages' ? (
          isLoadingMessages ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <Loader2 size={20} className="animate-spin mr-2" />
              <span className="text-sm">메시지 로딩 중...</span>
            </div>
          ) : messageError ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
              <span className="text-red-400 text-sm">⚠️ {messageError}</span>
              <button onClick={loadMessages} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg">
                다시 시도
              </button>
            </div>
          ) : (
            <MessageView messages={messages} />
          )
        ) : (
          isLoadingInsights ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <Loader2 size={20} className="animate-spin mr-2" />
              <span className="text-sm">인사이트 로딩 중...</span>
            </div>
          ) : insightError ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-red-400 text-sm">⚠️ {insightError}</span>
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
