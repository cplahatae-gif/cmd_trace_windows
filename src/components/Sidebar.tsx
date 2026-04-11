import { MessageSquare, LayoutDashboard, Settings, Tag, Trash2, FolderKanban } from 'lucide-react'

interface Props {
  activeView: 'sessions' | 'dashboard' | 'projects' | 'settings' | 'trash'
  onViewChange: (v: 'sessions' | 'dashboard' | 'projects' | 'settings' | 'trash') => void
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
    { id: 'projects' as const, icon: FolderKanban, label: '프로젝트' },
    { id: 'settings' as const, icon: Settings, label: '설정' },
    { id: 'trash' as const, icon: Trash2, label: '휴지통', badge: trashCount },
  ]

  return (
    <div className="w-16 flex flex-col items-center py-3 bg-surface-soft border-r border-border shrink-0">
      {navItems.map(({ id, icon: Icon, label, badge }) => (
        <button
          key={id}
          title={label}
          onClick={() => onViewChange(id)}
          className={`relative w-11 h-11 flex items-center justify-center rounded-xl mb-1 transition-all ${
            activeView === id
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-ink-muted hover:text-ink-primary hover:bg-surface-subtle'
          }`}
        >
          <Icon size={20} />
          {badge !== undefined && badge > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 text-[10px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center ${
              activeView === id ? 'bg-surface-base text-brand-600' : 'bg-brand-100 text-brand-600'
            }`} style={{ minWidth: '18px', height: '18px', fontSize: '10px' }}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </button>
      ))}

      {/* 태그 필터 */}
      {allTags.length > 0 && (
        <>
          <div className="w-7 border-t border-border my-2" />
          <button
            title="태그 필터 전체"
            onClick={() => onTagSelect(null)}
            className={`w-11 h-11 flex items-center justify-center rounded-xl mb-1 transition-all ${
              selectedTag === null
                ? 'text-brand-500'
                : 'text-ink-faint hover:text-ink-muted'
            }`}
          >
            <Tag size={18} />
          </button>
          {allTags.slice(0, 6).map(tag => (
            <button
              key={tag}
              title={`#${tag}`}
              onClick={() => onTagSelect(selectedTag === tag ? null : tag)}
              className={`w-11 h-7 flex items-center justify-center rounded-lg text-[11px] font-semibold mb-0.5 transition-all truncate px-1 ${
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
