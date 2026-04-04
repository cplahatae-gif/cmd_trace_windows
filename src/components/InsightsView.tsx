import type { SessionInsights } from '../types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  insights: SessionInsights
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']

export default function InsightsView({ insights }: Props) {
  const { totalTokenUsage, toolStatistics, modelUsage, totalDurationMs } = insights
  const totalTokens = totalTokenUsage.inputTokens + totalTokenUsage.outputTokens

  return (
    <div className="h-full overflow-y-auto scrollbar-thin px-4 py-4 space-y-4">
      {/* 토큰 사용량 */}
      <Section title="토큰 사용량">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '총 토큰', value: totalTokens.toLocaleString(), color: 'text-brand-300' },
            { label: '입력', value: totalTokenUsage.inputTokens.toLocaleString(), color: 'text-blue-300' },
            { label: '출력', value: totalTokenUsage.outputTokens.toLocaleString(), color: 'text-green-300' },
            { label: '캐시', value: totalTokenUsage.cacheReadInputTokens.toLocaleString(), color: 'text-amber-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
        {totalDurationMs > 0 && (
          <div className="mt-2 text-xs text-slate-500">
            총 실행 시간: {Math.round(totalDurationMs / 1000)}초
          </div>
        )}
      </Section>

      {/* 툴 사용 통계 */}
      {toolStatistics.length > 0 && (
        <Section title="툴 사용 빈도">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toolStatistics.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'rgba(99,102,241,0.1)' }}
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
              <div key={m.model} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2 border border-slate-700">
                <span className="text-sm text-slate-300 font-mono">{m.model}</span>
                <div className="flex gap-4 text-xs text-slate-500">
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
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )
}
