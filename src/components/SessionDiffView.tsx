import { X, MessageSquare } from 'lucide-react'
import type { Session, Message } from '../types'

interface Props {
  sessionA: Session
  sessionB: Session
  messagesA: Message[]
  messagesB: Message[]
  onClose: () => void
}

export default function SessionDiffView({ sessionA, sessionB, messagesA, messagesB, onClose }: Props) {
  const titleA = sessionA.customName || sessionA.preview.slice(0, 60) || sessionA.sessionId
  const titleB = sessionB.customName || sessionB.preview.slice(0, 60) || sessionB.sessionId

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-soft shrink-0">
        <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">세션 비교</span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-medium rounded-lg truncate max-w-[40%]">
            <MessageSquare size={11} />
            {titleA}
          </span>
          <span className="text-ink-faint text-xs">vs</span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg truncate max-w-[40%]">
            <MessageSquare size={11} />
            {titleB}
          </span>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-1.5 text-ink-muted hover:text-ink-secondary hover:bg-surface-subtle rounded-lg transition-colors"
          title="비교 닫기"
        >
          <X size={14} />
        </button>
      </div>

      {/* 통계 바 */}
      <div className="flex border-b border-border bg-surface-soft shrink-0 text-xs text-ink-muted divide-x divide-border">
        <div className="flex-1 px-4 py-1.5 flex items-center gap-2">
          <span className="text-brand-500 font-medium">A</span>
          <span>{messagesA.length}개 메시지</span>
          <span className="text-ink-faint">·</span>
          <span>{new Date(sessionA.lastActivity).toLocaleDateString('ko-KR')}</span>
        </div>
        <div className="flex-1 px-4 py-1.5 flex items-center gap-2">
          <span className="text-green-600 font-medium">B</span>
          <span>{messagesB.length}개 메시지</span>
          <span className="text-ink-faint">·</span>
          <span>{new Date(sessionB.lastActivity).toLocaleDateString('ko-KR')}</span>
        </div>
      </div>

      {/* 비교 패널 */}
      <div className="flex flex-1 overflow-hidden divide-x divide-border">
        <DiffPanel messages={messagesA} accent="brand" />
        <DiffPanel messages={messagesB} accent="green" />
      </div>
    </div>
  )
}

function DiffPanel({ messages, accent }: { messages: Message[]; accent: 'brand' | 'green' }) {
  const userBg    = accent === 'brand' ? 'bg-brand-50 text-brand-900' : 'bg-green-50 text-green-900'
  const aiBg      = 'bg-surface-subtle text-ink-primary'
  const toolBg    = 'bg-amber-50 text-amber-800'
  const avatarUser = accent === 'brand' ? 'bg-brand-500 text-white' : 'bg-green-600 text-white'

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">
        메시지 없음
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-3">
      {messages.map((msg, idx) => {
        const isUser = msg.role === 'user'
        const bubbleCls = isUser ? userBg : msg.isToolUse ? toolBg : aiBg

        return (
          <div key={idx} className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* 아바타 */}
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5 ${
              isUser ? avatarUser : msg.isToolUse ? 'bg-amber-100 text-amber-700' : 'bg-surface-subtle text-ink-secondary border border-border'
            }`}>
              {isUser ? 'U' : msg.isToolUse ? '⚙' : 'A'}
            </div>

            {/* 버블 */}
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${bubbleCls}`}>
              <p className="whitespace-pre-wrap break-words line-clamp-[20]">
                {msg.content.slice(0, 800)}{msg.content.length > 800 ? '…' : ''}
              </p>
              {msg.timestamp && (
                <p className="mt-1 text-[10px] opacity-50">
                  {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
