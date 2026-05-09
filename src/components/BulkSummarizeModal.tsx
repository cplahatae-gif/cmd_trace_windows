import { useState, useRef } from 'react'
import { Sparkles, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Session, AiSummarySettings } from '../types'

interface Props {
  sessions: Session[]
  aiSummary: AiSummarySettings | undefined
  onClose: () => void
  onSummaryReady: (sessionId: string, summary: string) => Promise<void>
}

type EntryStatus = 'pending' | 'running' | 'done' | 'error'

interface Entry {
  session: Session
  status: EntryStatus
  error?: string
}

export default function BulkSummarizeModal({ sessions, aiSummary, onClose, onSummaryReady }: Props) {
  const [entries, setEntries] = useState<Entry[]>(
    () => sessions.map(s => ({ session: s, status: 'pending' as const }))
  )
  const [isRunning, setIsRunning] = useState(false)
  const cancelRef = useRef(false)

  const provider = aiSummary?.provider ?? 'claude-cli'
  // safeStorage 마이그레이션 실패 시 settings에 남은 평문 키를 fallback으로 전달
  const fallbackKey = provider !== 'claude-cli' ? (aiSummary?.apiKey ?? '') : ''
  const completed = entries.filter(e => e.status === 'done').length
  const errored = entries.filter(e => e.status === 'error').length

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries(prev => prev.map(e => e.session.id === id ? { ...e, ...patch } : e))
  }

  const runAll = async () => {
    if (!window.electronAPI?.summarizeSession) return
    setIsRunning(true)
    cancelRef.current = false

    for (const { session } of entries) {
      if (cancelRef.current) break
      updateEntry(session.id, { status: 'running' })
      try {
        const messages = await window.electronAPI.loadMessages(session.projectFolder, session.fileName)
        const result = await window.electronAPI.summarizeSession(
          messages.map(m => ({ role: m.role, content: m.content })),
          provider,
          fallbackKey
        )
        if (result.ok && result.summary) {
          await onSummaryReady(session.id, result.summary)
          updateEntry(session.id, { status: 'done' })
        } else {
          updateEntry(session.id, { status: 'error', error: result.error || '요약 실패' })
        }
      } catch (err) {
        updateEntry(session.id, { status: 'error', error: String(err) })
      }
    }
    setIsRunning(false)
  }

  const handleCancel = () => {
    cancelRef.current = true
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={isRunning ? undefined : onClose}
    >
      <div
        className="bg-surface-base rounded-2xl shadow-panel w-[480px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-ink-primary">일괄 AI 요약</h3>
            <span className="text-[10px] text-ink-faint px-1.5 py-0.5 bg-surface-soft rounded-full">
              {provider === 'claude-cli' ? 'Claude Code' : provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="p-1 text-ink-muted hover:text-ink-primary rounded disabled:opacity-30"
          >
            <X size={14} />
          </button>
        </div>

        {/* 진행 요약 */}
        <div className="px-5 py-3 border-b border-border bg-surface-soft">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-secondary">
              {completed + errored} / {entries.length} 처리됨
            </span>
            {errored > 0 && (
              <span className="text-red-600">{errored}개 실패</span>
            )}
          </div>
          <div className="h-1.5 bg-surface-subtle rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${(entries.length === 0 ? 0 : ((completed + errored) / entries.length) * 100)}%` }}
            />
          </div>
        </div>

        {/* 세션 목록 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-3 space-y-1.5">
          {entries.map(({ session, status, error }) => (
            <div
              key={session.id}
              className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg hover:bg-surface-soft"
            >
              <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                {status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-ink-faint" />}
                {status === 'running' && <Loader2 size={12} className="text-brand-500 animate-spin" />}
                {status === 'done' && <CheckCircle2 size={12} className="text-green-600" />}
                {status === 'error' && <AlertCircle size={12} className="text-red-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-ink-primary truncate">{session.customName || session.preview.slice(0, 60)}</p>
                {status === 'error' && error && (
                  <p className="text-[10px] text-red-600 truncate">{error}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          {!isRunning && completed + errored === 0 && (
            <>
              <button onClick={onClose} className="btn-secondary">취소</button>
              <button onClick={runAll} className="btn-primary">
                <Sparkles size={11} /> 시작
              </button>
            </>
          )}
          {isRunning && (
            <button onClick={handleCancel} className="btn-secondary text-red-600">
              중지
            </button>
          )}
          {!isRunning && completed + errored > 0 && (
            <button onClick={onClose} className="btn-primary">완료</button>
          )}
        </div>
      </div>
    </div>
  )
}
