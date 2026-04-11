import { useEffect, useRef } from 'react'
import type { Message } from '../types'
import ReactMarkdown from 'react-markdown'

interface Props {
  messages: Message[]
}

export default function MessageView({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-ink-muted">
        <span className="text-sm">메시지가 없습니다</span>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin px-5 py-5 space-y-4 selectable">
      {messages.map((msg, idx) => (
        <MessageBubble key={idx} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* 아바타 */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5 ${
        isUser
          ? 'bg-brand-500 text-white'
          : message.isToolUse
            ? 'bg-amber-100 text-amber-700'
            : 'bg-surface-subtle text-ink-secondary border border-border'
      }`}>
        {isUser ? 'U' : message.isToolUse ? '⚙' : 'AI'}
      </div>

      {/* 버블 */}
      <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
        isUser
          ? 'bg-brand-500 text-white rounded-tr-sm'
          : message.isToolUse
            ? 'bg-amber-50 border border-amber-100 text-ink-primary rounded-tl-sm'
            : 'bg-surface-base border border-border text-ink-primary rounded-tl-sm shadow-card'
      }`}>
        {/* 라벨 + 시간 */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${
            isUser ? 'text-brand-100' : message.isToolUse ? 'text-amber-600' : 'text-ink-muted'
          }`}>
            {isUser ? 'You' : message.isToolUse ? 'Tool' : `Claude${message.modelId ? ` · ${message.modelId.split('-').slice(-1)[0]}` : ''}`}
          </span>
          {message.timestamp && (
            <span className={`text-[10px] ml-auto ${isUser ? 'text-brand-200' : 'text-ink-faint'}`}>
              {new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* 내용 */}
        <div className={`prose prose-sm max-w-none ${
          isUser
            ? 'prose-invert'
            : 'prose-neutral prose-pre:bg-surface-soft prose-pre:border prose-pre:border-border prose-code:text-brand-600 prose-code:bg-brand-50 prose-code:px-1 prose-code:rounded prose-code:text-xs'
        }`}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
