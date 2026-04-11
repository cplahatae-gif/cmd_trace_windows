import type { SessionInsights } from '../types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  insights: SessionInsights
}

const COLORS = ['#635bff', '#8b7ef8', '#a99ef5', '#c4beff', '#d8d4ff']

export default function InsightsView({ insights }: Props) {
  const { totalTokenUsage, toolStatistics, modelUsage, totalDurationMs } = insights
  const totalTokens = totalTokenUsage.inputTokens + totalTokenUsage.outputTokens

  return (
    <div className="h-full overflow-y-auto scrollbar-thin px-5 py-5 space-y-5">
      {/* 토큰 사용량 */}
      <Section title="토큰 사용량">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '총 토큰', value: totalTokens.toLocaleString(), accent: 'text-brand-600', bg: 'bg-brand-50' },
            { label: '입력', value: totalTokenUsage.inputTokens.toLocaleString(), accent: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '출력', value: totalTokenUsage.outputTokens.toLocaleString(), accent: 'text-green-600', bg: 'bg-green-50' },
            { label: '캐시', value: totalTokenUsage.cacheReadInputTokens.toLocaleString(), accent: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(({ label, value, accent, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-3 border border-border`}>
              <div className={`text-xl font-bold ${accent} leading-tight`}>{value}</div>
              <div className="text-xs text-ink-muted mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        {totalDurationMs > 0 && (
          <div className="mt-2 text-[11px] text-ink-muted">
            총 실행 시간: {Math.round(totalDurationMs / 1000)}초
          </div>
        )}
      </Section>

      {/* 툴 사용 통계 */}
      {toolStatistics.length > 0 && (
        <Section title="툴 사용 빈도">
          <div className="bg-surface-base rounded-xl border border-border p-3" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toolStatistics.slice(0, 8)} layout="vertical" margin={{ left: 4, right: 20, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} width={90} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  cursor={{ fill: 'rgba(99,91,255,0.05)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {toolStatistics.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* 모델 사용 */}
      {modelUsage.length > 0 && (
        <Section title="모델별 사용">
          <div className="space-y-2">
            {modelUsage.map(m => (
              <div key={m.model} className="flex items-center justify-between bg-surface-base rounded-xl px-4 py-3 border border-border">
                <span className="text-xs font-mono text-ink-primary">{m.model}</span>
                <div className="flex gap-4 text-[11px] text-ink-muted">
                  <span>{m.messageCount}회</span>
                  <span>{(m.inputTokens + m.outputTokens).toLocaleString()} 토큰</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-2.5">{title}</h3>
      {children}
    </div>
  )
}
