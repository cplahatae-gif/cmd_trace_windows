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
      <div className="flex items-center justify-center h-full text-slate-500">
        <span className="text-sm">메시지가 없습니다</span>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin px-4 py-4 space-y-3 selectable">
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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
        isUser
          ? 'bg-brand-700/50 border border-brand-600/30 text-slate-100'
          : message.isToolUse
            ? 'bg-amber-950/30 border border-amber-800/30 text-amber-200'
            : 'bg-slate-800 border border-slate-700 text-slate-200'
      }`}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${
            isUser ? 'text-brand-300' : message.isToolUse ? 'text-amber-400' : 'text-slate-400'
          }`}>
            {isUser ? 'You' : message.isToolUse ? '⚙ Tool' : `AI${message.modelId ? ` · ${message.modelId.split('-').slice(-1)[0]}` : ''}`}
          </span>
          {message.timestamp && (
            <span className="text-[10px] text-slate-600 ml-auto">
              {new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700 prose-code:text-brand-300 prose-code:bg-slate-900/50 prose-code:px-1 prose-code:rounded">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
