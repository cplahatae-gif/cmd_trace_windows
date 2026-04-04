import type { AppSettings, AgentType } from '../types'

export default function SettingsPanel({ settings, onSettingsChange }: {
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
}) {
  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
      <h2 className="text-xl font-bold text-slate-100 mb-6">설정</h2>

      <div className="max-w-lg space-y-6">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="font-semibold text-slate-200 mb-3">터미널</h3>
          <div className="space-y-2">
            {([
              { value: 'wt', label: 'Windows Terminal', desc: '추천' },
              { value: 'powershell', label: 'PowerShell', desc: '' },
              { value: 'cmd', label: 'Command Prompt (cmd)', desc: '' },
            ] as const).map(opt => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="terminal"
                  value={opt.value}
                  checked={settings.terminal === opt.value}
                  onChange={() => onSettingsChange({ ...settings, terminal: opt.value })}
                  className="accent-brand-500"
                />
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                  {opt.label} {opt.desc && <span className="text-brand-400 text-xs">({opt.desc})</span>}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="font-semibold text-slate-200 mb-3">AI 도구</h3>
          <div className="space-y-2">
            {([
              { value: 'claude', label: 'Claude Code' },
              { value: 'opencode', label: 'OpenCode' },
            ] as const).map(opt => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="agentType"
                  value={opt.value}
                  checked={settings.agentType === opt.value}
                  onChange={() => onSettingsChange({ ...settings, agentType: opt.value as AgentType })}
                  className="accent-brand-500"
                />
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-semibold text-slate-200">권한 우회 모드</p>
              <p className="text-xs text-slate-500 mt-0.5">--dangerously-skip-permissions 플래그 사용</p>
            </div>
            <button
              onClick={() => onSettingsChange({ ...settings, bypassPermissions: !settings.bypassPermissions })}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings.bypassPermissions ? 'bg-brand-500' : 'bg-slate-600'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                settings.bypassPermissions ? 'left-6' : 'left-1'
              }`} />
            </button>
          </label>
        </div>
      </div>
    </div>
  )
}
