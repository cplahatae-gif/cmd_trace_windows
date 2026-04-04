import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Session, AppSettings } from './types'
import Sidebar from './components/Sidebar'
import SessionList from './components/SessionList'
import SessionDetail from './components/SessionDetail'
import TitleBar from './components/TitleBar'
import Dashboard from './components/Dashboard'
import SettingsPanel from './components/SettingsPanel'
import TrashView from './components/TrashView'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

const DEFAULT_SETTINGS: AppSettings = {
  terminal: 'wt',
  theme: 'dark',
  bypassPermissions: false,
  agentType: 'claude',
}

type ActiveView = 'sessions' | 'dashboard' | 'settings' | 'trash'

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [activeView, setActiveView] = useState<ActiveView>('sessions')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<Record<string, { customName?: string; tags?: string[]; isDeleted?: boolean }>>({})

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
      const meta = await window.electronAPI.loadMetadata() as Record<string, { customName?: string; tags?: string[]; isDeleted?: boolean }>
      setMetadata(meta)

      const merged = raw.map(s => ({
        ...s,
        customName: meta[s.id]?.customName ?? s.customName,
        tags: meta[s.id]?.tags ?? s.tags,
        isDeleted: meta[s.id]?.isDeleted ?? false,
      }))
      setSessions(merged)
    } catch (err) {
      console.error('세션 로드 실패:', err)
      setError('세션을 불러오는 데 실패했습니다. 새로고침을 시도해보세요.')
    } finally {
      setIsLoading(false)
    }
  }, [settings.agentType])

  useEffect(() => { loadSessions() }, [loadSessions])

  // 삭제되지 않은 세션만 표시
  const activeSessions = useMemo(() => sessions.filter(s => !s.isDeleted), [sessions])
  const deletedSessions = useMemo(() => sessions.filter(s => s.isDeleted), [sessions])

  // 검색 + 태그 필터 (활성 세션에만 적용)
  useEffect(() => {
    let result = activeSessions
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
  }, [searchQuery, activeSessions, selectedTag])

  // 세션 메타 업데이트 (공통 헬퍼)
  const applyMetaUpdate = async (
    sessionId: string,
    updates: { customName?: string; tags?: string[]; isDeleted?: boolean }
  ) => {
    const newMeta = { ...metadata, [sessionId]: { ...metadata[sessionId], ...updates } }
    setMetadata(newMeta)
    const updated = sessions.map(s => s.id === sessionId ? { ...s, ...updates } : s)
    setSessions(updated)
    if (selectedSession?.id === sessionId) {
      setSelectedSession(prev => prev ? { ...prev, ...updates } : prev)
    }
    if (window.electronAPI) await window.electronAPI.saveMetadata(newMeta)
  }

  const updateSessionMeta = (sessionId: string, updates: { customName?: string; tags?: string[] }) =>
    applyMetaUpdate(sessionId, updates)

  // 소프트 삭제
  const deleteSession = async (sessionId: string) => {
    await applyMetaUpdate(sessionId, { isDeleted: true })
    if (selectedSession?.id === sessionId) setSelectedSession(null)
  }

  // 복원
  const restoreSession = async (sessionId: string) => {
    await applyMetaUpdate(sessionId, { isDeleted: false })
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
    () => Array.from(new Set(activeSessions.flatMap(s => s.tags))).sort(),
    [activeSessions]
  )

  return (
    <div className="flex flex-col h-screen bg-white text-ink-primary">
      <TitleBar />

      {/* 에러 배너 */}
      {error && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-50 border-b border-red-100 text-red-600 text-xs">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600 p-0.5">✕</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          allTags={allTags}
          selectedTag={selectedTag}
          onTagSelect={setSelectedTag}
          sessionCount={activeSessions.length}
          trashCount={deletedSessions.length}
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
            onDelete={deleteSession}
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
              onDelete={deleteSession}
            />
          ) : activeView === 'sessions' ? (
            <EmptyState onRefresh={loadSessions} />
          ) : activeView === 'dashboard' ? (
            <Dashboard sessions={activeSessions} />
          ) : activeView === 'trash' ? (
            <TrashView
              sessions={deletedSessions}
              onRestore={restoreSession}
            />
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
    <div className="flex flex-col items-center justify-center h-full text-ink-muted gap-3 bg-surface-soft">
      <div className="w-14 h-14 rounded-2xl bg-white border border-[rgba(0,0,0,0.08)] shadow-card flex items-center justify-center text-2xl">
        💬
      </div>
      <p className="text-sm font-medium text-ink-secondary">세션을 선택하세요</p>
      <p className="text-xs text-ink-muted">왼쪽 목록에서 세션을 클릭하면 대화 내용을 볼 수 있습니다</p>
      <button
        onClick={onRefresh}
        className="mt-1 btn-primary"
      >
        새로고침
      </button>
    </div>
  )
}
