import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Session, AgentType, AppSettings } from './types'
import Sidebar from './components/Sidebar'
import SessionList from './components/SessionList'
import SessionDetail from './components/SessionDetail'
import TitleBar from './components/TitleBar'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

const DEFAULT_SETTINGS: AppSettings = {
  terminal: 'wt',
  theme: 'dark',
  bypassPermissions: false,
  agentType: 'claude',
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [activeView, setActiveView] = useState<'sessions' | 'dashboard' | 'settings'>('sessions')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<Record<string, { customName?: string; tags?: string[] }>>({})

  // H-1: 앱 시작 시 설정 불러오기
  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.loadSettings().then(saved => {
      if (saved) setSettings(saved)
    }).catch(() => { /* 설정 파일 없으면 기본값 사용 */ })
  }, [])

  // 세션 로드 (I-1: catch 블록 추가)
  const loadSessions = useCallback(async () => {
    if (!window.electronAPI) return
    setIsLoading(true)
    setError(null)
    try {
      const raw  = await window.electronAPI.loadSessions(settings.agentType)
      const meta = await window.electronAPI.loadMetadata() as Record<string, { customName?: string; tags?: string[] }>
      setMetadata(meta)

      const merged = raw.map(s => ({
        ...s,
        customName: meta[s.id]?.customName ?? s.customName,
        tags: meta[s.id]?.tags ?? s.tags,
      }))
      setSessions(merged)
      setFilteredSessions(merged)
    } catch (err) {
      console.error('세션 로드 실패:', err)
      setError('세션을 불러오는 데 실패했습니다. 새로고침을 시도해보세요.')
    } finally {
      setIsLoading(false)
    }
  }, [settings.agentType])

  useEffect(() => { loadSessions() }, [loadSessions])

  // 검색 + 태그 필터
  useEffect(() => {
    let result = sessions
    if (selectedTag) result = result.filter(s => s.tags.includes(selectedTag))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s =>
        s.preview.toLowerCase().includes(q) ||
        s.project.toLowerCase().includes(q) ||
        (s.customName ?? '').toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    setFilteredSessions(result)
  }, [searchQuery, sessions, selectedTag])

  // 세션 메타 업데이트
  const updateSessionMeta = async (sessionId: string, updates: { customName?: string; tags?: string[] }) => {
    const newMeta = { ...metadata, [sessionId]: { ...metadata[sessionId], ...updates } }
    setMetadata(newMeta)
    const updated = sessions.map(s => s.id === sessionId ? { ...s, ...updates } : s)
    setSessions(updated)
    if (selectedSession?.id === sessionId) {
      setSelectedSession(prev => prev ? { ...prev, ...updates } : prev)
    }
    if (window.electronAPI) await window.electronAPI.saveMetadata(newMeta)
  }

  // H-1: 설정 변경 시 저장
  const handleSettingsChange = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings)
    if (window.electronAPI) {
      window.electronAPI.saveSettings(newSettings as unknown as Record<string, unknown>)
        .catch(err => console.error('설정 저장 실패:', err))
    }
  }, [])

  // M-3: useMemo로 allTags 최적화
  const allTags = useMemo(
    () => Array.from(new Set(sessions.flatMap(s => s.tags))).sort(),
    [sessions]
  )

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200">
      <TitleBar />

      {/* I-1: 에러 배너 */}
      {error && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-900/60 border-b border-red-700 text-red-200 text-sm">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-300 hover:text-white">✕</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          allTags={allTags}
          selectedTag={selectedTag}
          onTagSelect={setSelectedTag}
          sessionCount={sessions.length}
          settings={settings}
          onSettingsChange={handleSettingsChange}
        />

        {activeView === 'sessions' && (
          <SessionList
            sessions={filteredSessions}
            selectedSession={selectedSession}
            onSelectSession={setSelectedSession}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isLoading={isLoading}
            onRefresh={loadSessions}
            formatRelativeTime={(date: string) =>
              formatDistanceToNow(new Date(date), { addSuffix: true, locale: ko })
            }
          />
        )}

        <div className="flex-1 overflow-hidden">
          {activeView === 'sessions' && selectedSession ? (
            <SessionDetail
              session={selectedSession}
              settings={settings}
              onUpdateMeta={updateSessionMeta}
            />
          ) : activeView === 'sessions' ? (
            <EmptyState onRefresh={loadSessions} />
          ) : activeView === 'dashboard' ? (
            <Dashboard sessions={sessions} />
          ) : (
            <SettingsPanel settings={settings} onSettingsChange={handleSettingsChange} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 빈 상태 ──────────────────────────────────────────────
function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
      <div className="text-6xl">🖥️</div>
      <p className="text-lg font-medium text-slate-400">세션을 선택하세요</p>
      <p className="text-sm">왼쪽 목록에서 세션을 클릭하면 대화 내용을 볼 수 있습니다</p>
      <button
        onClick={onRefresh}
        className="mt-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm transition-colors"
      >
        새로고침
      </button>
    </div>
  )
}

// ─── 대시보드 ──────────────────────────────────────────────
function Dashboard({ sessions }: { sessions: Session[] }) {
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

// ─── 설정 패널 ──────────────────────────────────────────────
function SettingsPanel({ settings, onSettingsChange }: {
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
