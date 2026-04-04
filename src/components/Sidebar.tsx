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
    <div className="w-14 flex flex-col items-center py-3 bg-slate-900 border-r border-slate-800 shrink-0">
      {navItems.map(({ id, icon: Icon, label, badge }) => (
        <button
          key={id}
          title={label}
          onClick={() => onViewChange(id)}
          className={`relative w-10 h-10 flex items-center justify-center rounded-lg mb-1 transition-all ${
            activeView === id
              ? 'bg-brand-600 text-white'
              : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Icon size={18} />
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 text-[10px] bg-slate-600 text-slate-300 rounded-full w-4 h-4 flex items-center justify-center">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </button>
      ))}

      {/* 태그 필터 구분선 */}
      {allTags.length > 0 && (
        <>
          <div className="w-8 border-t border-slate-700 my-2" />
          <button
            title="태그 필터 해제"
            onClick={() => onTagSelect(null)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg mb-1 transition-all ${
              selectedTag === null
                ? 'text-slate-200'
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            <Tag size={16} />
          </button>
          {allTags.slice(0, 6).map(tag => (
            <button
              key={tag}
              title={`#${tag}`}
              onClick={() => onTagSelect(selectedTag === tag ? null : tag)}
              className={`w-10 h-6 flex items-center justify-center rounded text-[10px] font-medium mb-1 transition-all truncate px-1 ${
                selectedTag === tag
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
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
