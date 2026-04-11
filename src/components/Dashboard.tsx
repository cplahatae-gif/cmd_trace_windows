import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { Session } from '../types'

export default function Dashboard({ sessions }: { sessions: Session[] }) {
  const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0)
  const uniqueProjects = Array.from(new Set(sessions.map(s => s.project))).length
  const today = sessions.filter(s => new Date(s.lastActivity).toDateString() === new Date().toDateString()).length
  const favorited = sessions.filter(s => s.isFavorited).length

  const stats = [
    { label: '전체 세션', value: sessions.length.toLocaleString(), icon: '💬', color: 'bg-brand-50 text-brand-600' },
    { label: '전체 메시지', value: totalMessages.toLocaleString(), icon: '📨', color: 'bg-blue-50 text-blue-600' },
    { label: '프로젝트 수', value: uniqueProjects.toLocaleString(), icon: '📁', color: 'bg-green-50 text-green-600' },
    { label: '오늘 활동', value: today.toLocaleString(), icon: '📅', color: 'bg-amber-50 text-amber-600' },
  ]

  // 최근 30일 일별 세션 수
  const activityData = useMemo(() => {
    const now = new Date()
    const days: { date: string; count: number; label: string }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toDateString()
      const label = i === 0 ? '오늘' : i === 1 ? '어제' : `${d.getMonth() + 1}/${d.getDate()}`
      days.push({
        date: dateStr,
        count: sessions.filter(s => new Date(s.lastActivity).toDateString() === dateStr).length,
        label,
      })
    }
    return days
  }, [sessions])

  // 프로젝트별 세션 분포 (상위 7개 + 기타)
  const projectData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of sessions) {
      const name = s.project.split(/[\\/]/).pop() || s.project
      map[name] = (map[name] || 0) + 1
    }
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 7).map(([name, count]) => ({ name, count }))
    const othersCount = sorted.slice(7).reduce((sum, [, c]) => sum + c, 0)
    if (othersCount > 0) top.push({ name: '기타', count: othersCount })
    return top
  }, [sessions])

  const PIE_COLORS = ['#635bff', '#818cf8', '#a5b4fc', '#6ee7b7', '#fbbf24', '#f87171', '#60a5fa', '#d1d5db']

  const maxActivity = Math.max(...activityData.map(d => d.count), 1)

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-surface-soft">
      <div className="max-w-3xl space-y-6">
        <h2 className="text-lg font-semibold text-ink-primary">대시보드</h2>

        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-3">
          {stats.map(stat => (
            <div key={stat.label} className="bg-surface-base rounded-xl p-4 border border-border shadow-card">
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-base mb-2.5 ${stat.color}`}>
                {stat.icon}
              </div>
              <div className="text-3xl font-bold text-ink-primary">{stat.value}</div>
              <div className="text-sm text-ink-muted mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* 즐겨찾기/핀 요약 */}
        {(favorited > 0 || sessions.filter(s => s.isPinned).length > 0) && (
          <div className="flex gap-3">
            {favorited > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
                ⭐ 즐겨찾기 {favorited}개
              </div>
            )}
            {sessions.filter(s => s.isPinned).length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-100 rounded-xl text-sm text-brand-700">
                📌 핀 {sessions.filter(s => s.isPinned).length}개
              </div>
            )}
          </div>
        )}

        {/* 30일 활동 차트 */}
        <div className="bg-surface-base rounded-2xl border border-border shadow-card p-5">
          <h3 className="text-sm font-semibold text-ink-primary mb-4">최근 30일 활동</h3>
          {sessions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-ink-faint text-sm">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={activityData} barSize={6} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  domain={[0, maxActivity]}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  }}
                  labelStyle={{ color: 'var(--ink-secondary)', fontWeight: 600 }}
                  formatter={(value: number) => [`${value}개`, '세션']}
                />
                <Bar dataKey="count" fill="#635bff" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 프로젝트별 분포 */}
        {projectData.length > 0 && (
          <div className="bg-surface-base rounded-2xl border border-border shadow-card p-5">
            <h3 className="text-sm font-semibold text-ink-primary mb-4">프로젝트별 세션 분포</h3>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={projectData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                  >
                    {projectData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface-base)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      fontSize: '12px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    }}
                    formatter={(value: number) => [`${value}개`, '세션']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {projectData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-ink-secondary truncate flex-1">{d.name}</span>
                    <span className="text-xs text-ink-muted tabular-nums shrink-0">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 최근 활동 세션 */}
        <div>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">최근 활동 세션</h3>
          <div className="space-y-1.5">
            {sessions.slice(0, 8).map(s => (
              <div key={s.id} className="bg-surface-base rounded-xl px-4 py-3 border border-border flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-primary truncate">{s.customName || s.preview}</p>
                  <p className="text-xs text-ink-muted truncate mt-0.5">{s.project.split(/[\\/]/).pop()}</p>
                </div>
                <span className="text-xs text-ink-faint shrink-0 tabular-nums">{s.messageCount}개</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
