import type { Session } from '../types'

export default function Dashboard({ sessions }: { sessions: Session[] }) {
  const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0)
  const projects = Array.from(new Set(sessions.map(s => s.project))).length
  const today = sessions.filter(s => new Date(s.lastActivity).toDateString() === new Date().toDateString()).length

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
      <h2 className="text-xl font-bold text-slate-100 mb-6">대시보드</h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: '전체 세션', value: sessions.length, icon: '💬' },
          { label: '전체 메시지', value: totalMessages.toLocaleString(), icon: '📨' },
          { label: '프로젝트 수', value: projects, icon: '📁' },
          { label: '오늘 활동', value: today, icon: '📅' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold text-slate-100">{stat.value}</div>
            <div className="text-sm text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-semibold text-slate-200 mb-4">최근 활동 세션</h3>
      <div className="space-y-2">
        {sessions.slice(0, 10).map(s => (
          <div key={s.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{s.customName || s.preview}</p>
              <p className="text-xs text-slate-500 truncate">{s.project}</p>
            </div>
            <span className="text-xs text-slate-500 ml-4 shrink-0">{s.messageCount}개</span>
          </div>
        ))}
      </div>
    </div>
  )
}
