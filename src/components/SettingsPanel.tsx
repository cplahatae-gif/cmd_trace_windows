import { useState } from 'react'
import type { AppSettings, AgentType, AiSummarySettings, ObsidianSettings, ThemeType } from '../types'
type AiProvider = AiSummarySettings['provider']

const DEFAULT_AI_SUMMARY: AiSummarySettings = {
  provider: 'claude-cli',
  apiKey: '',
}

const DEFAULT_OBSIDIAN: ObsidianSettings = {
  enabled: false,
  apiUrl: 'https://127.0.0.1:27124',
  apiToken: '',
  vaultName: '',
  autoSync: false,
}

export default function SettingsPanel({ settings, onSettingsChange }: {
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
}) {
  const obsidian = settings.obsidian ?? DEFAULT_OBSIDIAN
  const aiSummary = settings.aiSummary ?? DEFAULT_AI_SUMMARY
  const [showToken, setShowToken] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testStatus, setTestStatus] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'error'; message?: string }>({ kind: 'idle' })

  const updateAiSummary = (patch: Partial<AiSummarySettings>) => {
    onSettingsChange({ ...settings, aiSummary: { ...aiSummary, ...patch } })
  }

  const updateObsidian = (patch: Partial<ObsidianSettings>) => {
    onSettingsChange({ ...settings, obsidian: { ...obsidian, ...patch } })
    if (testStatus.kind !== 'idle') setTestStatus({ kind: 'idle' })
  }

  const testConnection = async () => {
    if (!window.electronAPI?.testObsidianConnection) {
      setTestStatus({ kind: 'error', message: 'Electron API 사용 불가' })
      return
    }
    setTestStatus({ kind: 'testing' })
    try {
      const result = await window.electronAPI.testObsidianConnection()
      if (result.ok) {
        setTestStatus({ kind: 'ok', message: result.vault ? `연결됨 — ${result.vault}` : '연결됨' })
      } else {
        setTestStatus({ kind: 'error', message: result.error || '연결 실패' })
      }
    } catch (err) {
      setTestStatus({ kind: 'error', message: String(err) })
    }
  }

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin bg-surface-soft">
      <div className="max-w-lg">
        <h2 className="text-lg font-semibold text-ink-primary mb-5">설정</h2>

        <div className="space-y-3">
          {/* 터미널 설정 */}
          <div className="bg-surface-base rounded-xl border border-border p-4 shadow-card">
            <h3 className="text-sm font-semibold text-ink-primary mb-3">터미널</h3>
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
                  <span className="text-sm text-ink-primary transition-colors">
                    {opt.label}
                    {opt.desc && <span className="ml-1.5 text-[10px] font-semibold text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded-full">{opt.desc}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* AI 도구 설정 */}
          <div className="bg-surface-base rounded-xl border border-border p-4 shadow-card">
            <h3 className="text-sm font-semibold text-ink-primary mb-3">AI 도구</h3>
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

          {/* 테마 설정 */}
          <div className="bg-surface-base rounded-xl border border-border p-4 shadow-card">
            <h3 className="text-sm font-semibold text-ink-primary mb-3">테마</h3>
            <div className="space-y-2">
              {([
                { value: 'light', label: '라이트' },
                { value: 'dark', label: '다크' },
                { value: 'system', label: '시스템 설정 따르기' },
              ] as const).map(opt => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-surface-soft transition-colors">
                  <input
                    type="radio"
                    name="theme"
                    value={opt.value}
                    checked={settings.theme === opt.value}
                    onChange={() => onSettingsChange({ ...settings, theme: opt.value as ThemeType })}
                    className="accent-brand-500"
                  />
                  <span className="text-sm text-ink-primary">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 권한 우회 모드 */}
          <div className="bg-surface-base rounded-xl border border-border p-4 shadow-card">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-ink-primary">권한 우회 모드</p>
                <p className="text-xs text-ink-muted mt-0.5">--dangerously-skip-permissions 플래그 사용</p>
              </div>
              <button
                onClick={() => onSettingsChange({ ...settings, bypassPermissions: !settings.bypassPermissions })}
                className={`w-10 h-5.5 rounded-full transition-all relative ${
                  settings.bypassPermissions ? 'bg-brand-500' : 'bg-surface-subtle border border-border'
                }`}
                style={{ height: '22px', width: '40px' }}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-surface-base rounded-full shadow-sm transition-transform ${
                  settings.bypassPermissions ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </label>
          </div>

          {/* Obsidian 연동 */}
          <div className="bg-surface-base rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">Obsidian 연동</h3>
                <p className="text-xs text-ink-muted mt-0.5">Local REST API 플러그인이 필요합니다</p>
              </div>
              <button
                onClick={() => updateObsidian({ enabled: !obsidian.enabled })}
                className={`relative rounded-full transition-all ${
                  obsidian.enabled ? 'bg-brand-500' : 'bg-surface-subtle border border-border'
                }`}
                style={{ height: '22px', width: '40px' }}
                aria-label="Obsidian 연동 토글"
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-surface-base rounded-full shadow-sm transition-transform ${
                  obsidian.enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {obsidian.enabled && (
              <div className="space-y-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">API URL</label>
                  <input
                    type="text"
                    value={obsidian.apiUrl}
                    onChange={(e) => updateObsidian({ apiUrl: e.target.value })}
                    placeholder="https://127.0.0.1:27124"
                    className="w-full px-3 py-1.5 text-sm bg-surface-soft border border-border rounded-lg focus:outline-none focus:border-brand-500 focus:bg-surface-base transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">API 토큰</label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={obsidian.apiToken}
                      onChange={(e) => updateObsidian({ apiToken: e.target.value })}
                      placeholder="Local REST API 플러그인의 토큰"
                      className="w-full px-3 py-1.5 pr-16 text-sm bg-surface-soft border border-border rounded-lg focus:outline-none focus:border-brand-500 focus:bg-surface-base transition-colors font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-muted hover:text-ink-primary px-1.5 py-0.5 rounded"
                    >
                      {showToken ? '숨김' : '보기'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">볼트 이름</label>
                  <input
                    type="text"
                    value={obsidian.vaultName}
                    onChange={(e) => updateObsidian({ vaultName: e.target.value })}
                    placeholder="MyVault"
                    className="w-full px-3 py-1.5 text-sm bg-surface-soft border border-border rounded-lg focus:outline-none focus:border-brand-500 focus:bg-surface-base transition-colors"
                  />
                  <p className="text-[10px] text-ink-muted mt-1">obsidian:// URI에 사용되는 볼트 이름 (정확히 일치)</p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={testConnection}
                    disabled={testStatus.kind === 'testing' || !obsidian.apiToken}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testStatus.kind === 'testing' ? '테스트 중…' : '연결 테스트'}
                  </button>
                  {testStatus.kind === 'ok' && (
                    <span className="text-xs text-emerald-600 font-medium">✓ {testStatus.message}</span>
                  )}
                  {testStatus.kind === 'error' && (
                    <span className="text-xs text-red-600 font-medium">✗ {testStatus.message}</span>
                  )}
                </div>

                <div className="pt-3 border-t border-border mt-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!obsidian.autoSync}
                      onChange={(e) => updateObsidian({ autoSync: e.target.checked })}
                      className="accent-brand-500 mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink-primary">프로젝트 자동 동기화</p>
                      <p className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">
                        프로젝트 생성/수정 시 Obsidian에 노트를 자동 upsert합니다.
                        <br />
                        <code className="text-[10px]">70. Outputs/74. Projects/&#123;inProgress|done|archive&#125;/🔖 &#123;이름&#125;.md</code>
                        <br />
                        CmdTrace가 관리하는 frontmatter(<code className="text-[10px]">cmdtrace_*</code>)와 <code className="text-[10px]">&lt;!-- cmdtrace:sessions --&gt;</code> 섹션만 갱신 — 사용자 본문은 보존됩니다.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* AI 요약 설정 */}
          <div className="bg-surface-base rounded-xl border border-border p-4 shadow-card">
            <h3 className="text-sm font-semibold text-ink-primary mb-3">AI 요약</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">AI 제공자</label>
                <div className="space-y-1.5">
                  {([
                    { value: 'claude-cli', label: 'Claude Code (claude -p)', desc: '추천 · API 키 불필요' },
                    { value: 'anthropic', label: 'Anthropic API (claude-haiku-4-5)', desc: '' },
                    { value: 'openai', label: 'OpenAI API (gpt-4o-mini)', desc: '' },
                  ] as { value: AiProvider; label: string; desc: string }[]).map(opt => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-surface-soft transition-colors">
                      <input
                        type="radio"
                        name="aiProvider"
                        value={opt.value}
                        checked={aiSummary.provider === opt.value}
                        onChange={() => updateAiSummary({ provider: opt.value })}
                        className="accent-brand-500"
                      />
                      <span className="text-sm text-ink-primary">
                        {opt.label}
                        {opt.desc && <span className="ml-1.5 text-[10px] font-semibold text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded-full">{opt.desc}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* claude-cli 설명 */}
              {aiSummary.provider === 'claude-cli' && (
                <div className="px-3 py-2 bg-surface-soft rounded-lg text-[11px] text-ink-muted leading-relaxed">
                  Claude Code CLI의 기존 로그인 세션을 사용합니다.<br />
                  <code className="text-brand-500">claude -p</code> 명령이 설치되어 있어야 합니다.
                </div>
              )}

              {/* API 키 — claude-cli 선택 시 숨김 */}
              {aiSummary.provider !== 'claude-cli' && (
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">API 키</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={aiSummary.apiKey}
                    onChange={(e) => updateAiSummary({ apiKey: e.target.value })}
                    placeholder={aiSummary.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                    className="w-full px-3 py-1.5 pr-16 text-sm bg-surface-soft border border-border rounded-lg focus:outline-none focus:border-brand-500 focus:bg-surface-base transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-muted hover:text-ink-primary px-1.5 py-0.5 rounded"
                  >
                    {showApiKey ? '숨김' : '보기'}
                  </button>
                </div>
                <p className="text-[10px] text-ink-muted mt-1">세션 상세 화면의 "AI 요약" 버튼에서 사용됩니다. 키는 로컬에만 저장됩니다.</p>
              </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
