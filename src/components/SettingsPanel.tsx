import type { AppSettings, AgentType } from '../types'

export default function SettingsPanel({ settings, onSettingsChange }: {
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
}) {
  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-surface-soft">
      <div className="max-w-lg">
        <h2 className="text-base font-semibold text-ink-primary mb-5">설정</h2>

        <div className="space-y-3">
          {/* 터미널 설정 */}
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.08)] p-4 shadow-card">
            <h3 className="text-xs font-semibold text-ink-primary mb-3">터미널</h3>
            <div className="space-y-2">
              {([
                { value: 'wt', label: 'Windows Terminal', desc: '추천' },
                { value: 'powershell', label: 'PowerShell', desc: '' },
                { value: 'cmd', label: 'Command Prompt (cmd)', desc: '' },
              ] as const).map(opt => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-surface-soft transition-colors group">
                  <input
                    type="radio"
                    name="terminal"
                    value={opt.value}
                    checked={settings.terminal === opt.value}
                    onChange={() => onSettingsChange({ ...settings, terminal: opt.value })}
                    className="accent-brand-500"
                  />
                  <span className="text-sm text-ink-primary group-hover:text-ink-primary transition-colors">
                    {opt.label}
                    {opt.desc && <span className="ml-1.5 text-[10px] font-semibold text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded-full">{opt.desc}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* AI 도구 설정 */}
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.08)] p-4 shadow-card">
            <h3 className="text-xs font-semibold text-ink-primary mb-3">AI 도구</h3>
            <div className="space-y-2">
              {([
                { value: 'claude', label: 'Claude Code' },
                { value: 'opencode', label: 'OpenCode' },
              ] as const).map(opt => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-surface-soft transition-colors group">
                  <input
                    type="radio"
                    name="agentType"
                    value={opt.value}
                    checked={settings.agentType === opt.value}
                    onChange={() => onSettingsChange({ ...settings, agentType: opt.value as AgentType })}
                    className="accent-brand-500"
                  />
                  <span className="text-sm text-ink-primary">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 권한 우회 모드 */}
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.08)] p-4 shadow-card">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-semibold text-ink-primary">권한 우회 모드</p>
                <p className="text-[11px] text-ink-muted mt-0.5">--dangerously-skip-permissions 플래그 사용</p>
              </div>
              <button
                onClick={() => onSettingsChange({ ...settings, bypassPermissions: !settings.bypassPermissions })}
                className={`w-10 h-5.5 rounded-full transition-all relative ${
                  settings.bypassPermissions ? 'bg-brand-500' : 'bg-surface-subtle border border-[rgba(0,0,0,0.12)]'
                }`}
                style={{ height: '22px', width: '40px' }}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                  settings.bypassPermissions ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
