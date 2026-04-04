import type { Session } from '../types'

export default function Dashboard({ sessions }: { sessions: Session[] }) {
  const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0)
  const projects = Array.from(new Set(sessions.map(s => s.project))).length
  const today = sessions.filter(s => new Date(s.lastActivity).toDateString() === new Date().toDateString()).length

  const stats = [
    { label: '전체 세션', value: sessions.length.toLocaleString(), icon: '💬', color: 'bg-brand-50 text-brand-600' },
    { label: '전체 메시지', value: totalMessages.toLocaleString(), icon: '📨', color: 'bg-blue-50 text-blue-600' },
    { label: '프로젝트 수', value: projects.toLocaleString(), icon: '📁', color: 'bg-green-50 text-green-600' },
    { label: '오늘 활동', value: today.toLocaleString(), icon: '📅', color: 'bg-amber-50 text-amber-600' },
  ]

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-surface-soft">
      <div className="max-w-2xl">
        <h2 className="text-base font-semibold text-ink-primary mb-5">대시보드</h2>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white rounded-xl p-4 border border-[rgba(0,0,0,0.08)] shadow-card">
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-base mb-2.5 ${stat.color}`}>
                {stat.icon}
              </div>
              <div className="text-2xl font-bold text-ink-primary">{stat.value}</div>
              <div className="text-xs text-ink-muted mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* 최근 활동 */}
        <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-widest mb-3">최근 활동 세션</h3>
        <div className="space-y-1.5">
          {sessions.slice(0, 10).map(s => (
            <div key={s.id} className="bg-white rounded-xl px-4 py-3 border border-[rgba(0,0,0,0.08)] flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-primary truncate">{s.customName || s.preview}</p>
                <p className="text-xs text-ink-muted truncate mt-0.5">{s.project.split(/[\\/]/).pop()}</p>
              </div>
              <span className="text-[11px] text-ink-faint shrink-0 tabular-nums">{s.messageCount}개</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
