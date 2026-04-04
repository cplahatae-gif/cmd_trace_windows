import { MessageSquare, LayoutDashboard, Settings, Tag, Trash2 } from 'lucide-react'

interface Props {
  activeView: 'sessions' | 'dashboard' | 'settings' | 'trash'
  onViewChange: (v: 'sessions' | 'dashboard' | 'settings' | 'trash') => void
  allTags: string[]
  selectedTag: string | null
  onTagSelect: (tag: string | null) => void
  sessionCount: number
  trashCount: number
}

export default function Sidebar({
  activeView,
  onViewChange,
  allTags,
  selectedTag,
  onTagSelect,
  sessionCount,
  trashCount,
}: Props) {
  const navItems = [
    { id: 'sessions' as const, icon: MessageSquare, label: '세션', badge: sessionCount },
    { id: 'dashboard' as const, icon: LayoutDashboard, label: '대시보드' },
    { id: 'settings' as const, icon: Settings, label: '설정' },
    { id: 'trash' as const, icon: Trash2, label: '휴지통', badge: trashCount },
  ]

  return (
    <div className="w-14 flex flex-col items-center py-3 bg-surface-soft border-r border-[rgba(0,0,0,0.08)] shrink-0">
      {navItems.map(({ id, icon: Icon, label, badge }) => (
        <button
          key={id}
          title={label}
          onClick={() => onViewChange(id)}
          className={`relative w-9 h-9 flex items-center justify-center rounded-lg mb-1 transition-all ${
            activeView === id
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-ink-muted hover:text-ink-primary hover:bg-surface-subtle'
          }`}
        >
          <Icon size={17} />
          {badge !== undefined && badge > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 text-[9px] font-semibold rounded-full w-4 h-4 flex items-center justify-center ${
              activeView === id ? 'bg-white text-brand-600' : 'bg-brand-100 text-brand-600'
            }`}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </button>
      ))}

      {/* 태그 필터 */}
      {allTags.length > 0 && (
        <>
          <div className="w-6 border-t border-[rgba(0,0,0,0.08)] my-2" />
          <button
            title="태그 필터 전체"
            onClick={() => onTagSelect(null)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg mb-1 transition-all ${
              selectedTag === null
                ? 'text-brand-500'
                : 'text-ink-faint hover:text-ink-muted'
            }`}
          >
            <Tag size={15} />
          </button>
          {allTags.slice(0, 6).map(tag => (
            <button
              key={tag}
              title={`#${tag}`}
              onClick={() => onTagSelect(selectedTag === tag ? null : tag)}
              className={`w-9 h-6 flex items-center justify-center rounded text-[9px] font-semibold mb-0.5 transition-all truncate px-1 ${
                selectedTag === tag
                  ? 'bg-brand-500 text-white'
                  : 'text-ink-muted hover:text-ink-primary hover:bg-surface-subtle'
              }`}
            >
              #{tag.slice(0, 3)}
            </button>
          ))}
        </>
      )}
    </div>
  )
}
