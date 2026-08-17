import { useEffect, useRef, useMemo } from 'react'
import type { Message } from '../types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useDarkMode } from '../hooks/useDarkMode'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'

SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('js', javascript)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('py', python)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('html', markup)
SyntaxHighlighter.registerLanguage('xml', markup)
import type { Components } from 'react-markdown'

interface Props {
  messages: Message[]
}

// GFM 지원 컴포넌트 — isDark prop으로 syntax highlighter 테마 전환
function makeMarkdownComponents(isDark: boolean): Components {
  return {
  code({ className, children, ...rest }) {
    const match = /language-(\w+)/.exec(className || '')
    const isInline = !match && !(rest as { node?: unknown }).node
    if (isInline) {
      return (
        <code className="bg-surface-soft border border-border text-brand-600 dark:text-brand-300 px-1 py-0.5 rounded text-[0.85em] font-mono" {...rest}>
          {children}
        </code>
      )
    }
    return (
      <SyntaxHighlighter
        style={isDark ? oneDark : oneLight}
        language={match ? match[1] : 'text'}
        PreTag="div"
        className="!rounded-lg !border !border-border !text-xs !my-2"
        customStyle={{ margin: 0 }}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    )
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="text-xs border-collapse w-full">{children}</table>
      </div>
    )
  },
  th({ children }) {
    return <th className="border border-border px-2 py-1 bg-surface-soft text-ink-secondary font-semibold text-left">{children}</th>
  },
  td({ children }) {
    return <td className="border border-border px-2 py-1 text-ink-primary">{children}</td>
  },
  input({ type, checked }) {
    if (type === 'checkbox') {
      return <input type="checkbox" checked={checked} readOnly className="mr-1.5 accent-brand-500" />
    }
    return null
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
        {children}
      </a>
    )
  },
}}

export default function MessageView({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const isDark = useDarkMode()

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
        <MessageBubble key={`${msg.timestamp ?? ''}-${idx}`} message={msg} isDark={isDark} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

function MessageBubble({ message, isDark }: { message: Message; isDark: boolean }) {
  // isDark 변경 시에만 재생성 (매 렌더마다 새 객체 방지)
  const components = useMemo(() => makeMarkdownComponents(isDark), [isDark])
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

        {/* 내용 — remark-gfm으로 테이블·체크박스·취소선 지원 */}
        <div className={`prose prose-sm max-w-none ${
          isUser
            ? 'prose-invert'
            : 'prose-neutral prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 prose-code:text-brand-600 prose-code:bg-brand-50 prose-code:px-1 prose-code:rounded prose-code:text-xs'
        }`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
