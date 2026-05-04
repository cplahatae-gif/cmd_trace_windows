import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Session, AppSettings, Project, ProjectStatus, Workspace, WorkspaceEntry } from './types'
import Sidebar from './components/Sidebar'
import SessionList from './components/SessionList'
import SessionDetail from './components/SessionDetail'
import TitleBar from './components/TitleBar'
import Dashboard from './components/Dashboard'
import SettingsPanel from './components/SettingsPanel'
import TrashView from './components/TrashView'
import ProjectsView from './components/ProjectsView'
import ProjectDetailView from './components/ProjectDetailView'
import WorkspacesView from './components/WorkspacesView'
import WorkspaceModal from './components/WorkspaceModal'
import type { ProjectFormData } from './components/ProjectModal'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

const DEFAULT_SETTINGS: AppSettings = {
  terminal: 'wt',
  theme: 'light',
  bypassPermissions: false,
  agentType: 'claude',
  obsidian: {
    enabled: false,
    apiUrl: 'https://127.0.0.1:27124',
    apiToken: '',
    vaultName: '',
  },
}

type ActiveView = 'sessions' | 'dashboard' | 'projects' | 'workspaces' | 'settings' | 'trash'

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
  const [metadata, setMetadata] = useState<Record<string, { customName?: string; tags?: string[]; isDeleted?: boolean; isFavorited?: boolean; isPinned?: boolean; projectId?: string }>>({})
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set())
  const [showSaveWorkspaceModal, setShowSaveWorkspaceModal] = useState(false)
  const [activeSessionIds, setActiveSessionIds] = useState<Set<string>>(new Set())

  // 테마 적용 — settings.theme 변경 시 .dark 클래스 토글
  useEffect(() => {
    const apply = (isDark: boolean) => {
      document.documentElement.classList.toggle('dark', isDark)
    }
    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const handler = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    apply(settings.theme === 'dark')
  }, [settings.theme])

  // H-1: 앱 시작 시 설정 + 프로젝트 불러오기
  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.loadSettings().then(saved => {
      if (saved) setSettings(saved)
    }).catch(() => { /* 설정 파일 없으면 기본값 사용 */ })
    window.electronAPI.loadProjects().then(saved => {
      if (Array.isArray(saved)) {
        const normalized = (saved as Project[]).map(p => ({
          ...p,
          // 마이그레이션: pending → completed (Obsidian 상태와 통일)
          status: (p.status as string) === 'pending' ? 'completed' as ProjectStatus : (p.status as ProjectStatus) || 'active',
          updatedAt: p.updatedAt || p.createdAt,
        }))
        setProjects(normalized)
      }
    }).catch(() => {})
    window.electronAPI.loadWorkspaces().then(saved => {
      if (Array.isArray(saved)) setWorkspaces(saved as Workspace[])
    }).catch(() => {})
  }, [])

  // 세션 로드 (I-1: catch 블록 추가)
  const loadSessions = useCallback(async () => {
    if (!window.electronAPI) return
    setIsLoading(true)
    setError(null)
    try {
      const raw  = await window.electronAPI.loadSessions(settings.agentType)
      const meta = await window.electronAPI.loadMetadata() as Record<string, { customName?: string; tags?: string[]; isDeleted?: boolean; isFavorited?: boolean; isPinned?: boolean; projectId?: string }>
      setMetadata(meta)

      const merged = raw.map(s => ({
        ...s,
        customName: meta[s.id]?.customName ?? s.customName,
        tags: meta[s.id]?.tags ?? s.tags,
        isDeleted: meta[s.id]?.isDeleted ?? false,
        isFavorited: meta[s.id]?.isFavorited ?? false,
        isPinned: meta[s.id]?.isPinned ?? false,
        projectId: meta[s.id]?.projectId ?? undefined,
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

  // 파일 감시 — 새 세션 JSONL 생성 시 자동 새로고침 (cleanup으로 누적 등록 방지)
  useEffect(() => {
    const cleanup = window.electronAPI?.onSessionsChanged?.(() => { loadSessions() })
    return () => cleanup?.()
  }, [loadSessions])

  // 실행 중인 세션 10초마다 폴링
  useEffect(() => {
    if (!window.electronAPI?.getActiveSessions) return
    const poll = async () => {
      const ids = await window.electronAPI.getActiveSessions().catch(() => [])
      setActiveSessionIds(new Set(ids))
    }
    poll()
    const timer = setInterval(poll, 10000)
    return () => clearInterval(timer)
  }, [])

  // 삭제되지 않은 세션만 표시
  const activeSessions = useMemo(() => sessions.filter(s => !s.isDeleted), [sessions])
  const deletedSessions = useMemo(() => sessions.filter(s => s.isDeleted), [sessions])

  // folderPath 기반 자동 프로젝트 매칭 (런타임만, 메타 저장 안 함)
  const sessionsWithAutoProject = useMemo(() => {
    const folderToProject = new Map<string, string>()
    for (const p of projects) {
      if (p.folderPath) folderToProject.set(p.folderPath, p.id)
    }
    return activeSessions.map(s => {
      if (s.projectId) return s  // 수동 배정 우선
      const autoId = folderToProject.get(s.project)
      return autoId ? { ...s, projectId: autoId } : s
    })
  }, [activeSessions, projects])

  // 감지된 고유 폴더 목록 (ProjectModal 드롭다운용)
  const uniqueFolders = useMemo(
    () => Array.from(new Set(activeSessions.map(s => s.project))).sort(),
    [activeSessions]
  )

  // 검색 연산자 파서
  const parseSearchQuery = (query: string) => {
    const operators: Record<string, string> = {}
    let plain = query
    const opRe = /(\w+):(\S+)/g
    let m: RegExpExecArray | null
    while ((m = opRe.exec(query)) !== null) {
      operators[m[1]] = m[2]
      plain = plain.replace(m[0], '').trim()
    }
    return { operators, plain }
  }

  // 검색 + 태그 필터 (활성 세션에만 적용) + 검색 연산자 (content:/regex: 비동기)
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      let result = [...activeSessions]
      if (selectedTag) result = result.filter(s => s.tags.includes(selectedTag))

      if (searchQuery.trim()) {
        const { operators, plain } = parseSearchQuery(searchQuery)

        // content: / regex: — 비동기 IPC로 JSONL 본문 전체 검색
        if (operators.content || operators.regex) {
          const q = operators.content || operators.regex
          const isRx = !!operators.regex
          const ids = await window.electronAPI?.searchContent(q, isRx, settings.agentType).catch(() => null)
          if (cancelled) return
          if (ids) {
            const idSet = new Set(ids)
            result = result.filter(s => idSet.has(s.id))
          }
        }

        if (operators.tag) result = result.filter(s => s.tags.includes(operators.tag))
        if (operators.project) {
          const proj = operators.project.toLowerCase()
          result = result.filter(s => s.project.toLowerCase().includes(proj))
        }
        if (operators.is === 'favorited') result = result.filter(s => s.isFavorited)
        if (operators.is === 'pinned') result = result.filter(s => s.isPinned)
        if (operators.date) {
          const target = new Date(operators.date)
          if (!isNaN(target.getTime())) {
            result = result.filter(s => {
              const d = new Date(s.lastActivity)
              return d.toDateString() === target.toDateString()
            })
          }
        }

        if (plain) {
          const q = plain.toLowerCase()
          result = result.filter(s =>
            s.preview.toLowerCase().includes(q) ||
            s.project.toLowerCase().includes(q) ||
            (s.customName ?? '').toLowerCase().includes(q) ||
            s.tags.some(t => t.toLowerCase().includes(q))
          )
        }
      }

      // 핀 우선 정렬
      result = result.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return 0
      })

      if (!cancelled) setFilteredSessions(result)
    })()

    return () => { cancelled = true }
  }, [searchQuery, activeSessions, selectedTag, settings.agentType])

  // 딥링크 수신 (cmdtrace://project/{id})
  useEffect(() => {
    window.electronAPI?.onDeepLink?.((url: string) => {
      const projectMatch = url.match(/cmdtrace:\/\/project\/(.+)/)
      if (projectMatch) {
        const projectId = decodeURIComponent(projectMatch[1])
        setActiveView('projects')
        setSelectedProjectId(projectId)
      }
      const sessionMatch = url.match(/cmdtrace:\/\/session\/(.+)/)
      if (sessionMatch) {
        const sessionId = decodeURIComponent(sessionMatch[1])
        const session = sessions.find(s => s.id === sessionId || s.sessionId === sessionId)
        if (session) {
          setActiveView('sessions')
          setSelectedSession(session)
        }
      }
    })
  }, [sessions])

  // 뷰 전환 시 프로젝트 상세 초기화
  useEffect(() => {
    if (activeView !== 'projects') setSelectedProjectId(null)
  }, [activeView])

  // 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setActiveView('sessions')
        // 검색창 포커스는 SessionList 내부에서 처리
      }
      if (e.ctrlKey && e.key === 'r' && selectedSession) {
        e.preventDefault()
        // 재개는 SessionDetail에서 처리되므로 여기선 건너뜀
      }
      if (e.key === 'Escape') {
        setSelectedSession(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedSession])

  // 세션 메타 업데이트 (공통 헬퍼)
  const applyMetaUpdate = async (
    sessionId: string,
    updates: { customName?: string; tags?: string[]; isDeleted?: boolean; isFavorited?: boolean; isPinned?: boolean; projectId?: string }
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

  const updateSessionMeta = (sessionId: string, updates: { customName?: string; tags?: string[]; isFavorited?: boolean; isPinned?: boolean }) =>
    applyMetaUpdate(sessionId, updates)

  // 벌크 메타 업데이트 — 선택된 세션 전체에 동일 변경사항 적용 (단일 저장)
  const bulkApplyMeta = async (ids: Set<string>, updates: { isFavorited?: boolean; isPinned?: boolean }) => {
    const newMeta = { ...metadata }
    const updated = sessions.map(s => {
      if (!ids.has(s.id) || s.isDeleted) return s  // 삭제된 세션 제외
      newMeta[s.id] = { ...newMeta[s.id], ...updates }
      return { ...s, ...updates }
    })
    setMetadata(newMeta)
    setSessions(updated)
    if (selectedSession && ids.has(selectedSession.id)) {
      setSelectedSession(prev => prev ? { ...prev, ...updates } : prev)
    }
    if (window.electronAPI) await window.electronAPI.saveMetadata(newMeta)
  }

  const bulkPin = async () => {
    const selected = activeSessions.filter(s => selectedSessionIds.has(s.id))
    const allPinned = selected.length > 0 && selected.every(s => s.isPinned)
    await bulkApplyMeta(selectedSessionIds, { isPinned: !allPinned })
  }

  const bulkFavorite = async () => {
    const selected = activeSessions.filter(s => selectedSessionIds.has(s.id))
    const allFavorited = selected.length > 0 && selected.every(s => s.isFavorited)
    await bulkApplyMeta(selectedSessionIds, { isFavorited: !allFavorited })
  }

  // 소프트 삭제
  const deleteSession = async (sessionId: string) => {
    await applyMetaUpdate(sessionId, { isDeleted: true })
    if (selectedSession?.id === sessionId) setSelectedSession(null)
    setSelectedSessionIds(prev => {
      if (!prev.has(sessionId)) return prev
      const next = new Set(prev)
      next.delete(sessionId)
      return next
    })
  }

  // 복원
  const restoreSession = async (sessionId: string) => {
    await applyMetaUpdate(sessionId, { isDeleted: false })
  }

  // ─── 프로젝트 관리 ──────────────────────────────────────
  const saveProjects = useCallback(async (updated: Project[]) => {
    setProjects(updated)
    if (window.electronAPI) {
      await window.electronAPI.saveProjects(updated)
    }
  }, [])

  // ─── 워크스페이스 관리 ─────────────────────────────────
  const saveWorkspaces = useCallback(async (updated: Workspace[]) => {
    setWorkspaces(updated)
    if (window.electronAPI) {
      await window.electronAPI.saveWorkspaces(updated)
    }
  }, [])

  const createWorkspace = async (name: string) => {
    // filteredSessions 대신 activeSessions 사용: 검색 중에도 선택된 모든 세션 포함
    const selected = activeSessions.filter(s => selectedSessionIds.has(s.id))
    if (selected.length === 0) return
    const entries: WorkspaceEntry[] = selected.map((s, i) => ({
      sessionId: s.sessionId,
      sessionRecordId: s.id,
      projectPath: s.project,
      title: s.customName || s.preview.slice(0, 60) || s.sessionId,
      order: i + 1,
      agentType: settings.agentType,
    }))
    const ws: Workspace = {
      id: `ws_${Date.now()}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      entries,
    }
    await saveWorkspaces([...workspaces, ws])
    setSelectedSessionIds(new Set())
    setShowSaveWorkspaceModal(false)
  }

  const saveActiveAsWorkspace = useCallback(() => {
    // 현재 실행 중인 세션(초록 점)만 자동 선택 후 저장 모달 열기
    const activeIds = new Set(
      activeSessions
        .filter(s => activeSessionIds.has(s.sessionId))
        .map(s => s.id)
    )
    if (activeIds.size === 0) return
    setSelectedSessionIds(activeIds)
    setShowSaveWorkspaceModal(true)
  }, [activeSessions, activeSessionIds])

  const deleteWorkspace = useCallback(async (id: string) => {
    await saveWorkspaces(workspaces.filter(w => w.id !== id))
  }, [workspaces, saveWorkspaces])

  const renameWorkspace = useCallback(async (id: string, name: string) => {
    await saveWorkspaces(workspaces.map(w => w.id === id ? { ...w, name: name.trim() } : w))
  }, [workspaces, saveWorkspaces])

  // Obsidian 노트 동기화 헬퍼 (autoSync 켜져 있을 때만, 실패는 조용히 무시)
  // stale closure 방지: setProjects를 functional form으로 호출해 최신 상태를 기준으로 머지.
  const syncProjectToObsidian = useCallback(async (project: Project) => {
    if (!settings.obsidian?.enabled || !settings.obsidian?.autoSync) return
    if (!window.electronAPI?.upsertObsidianProjectNote) return
    const projectSessions = activeSessions
      .filter(s => s.projectId === project.id)
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
    const recentSessions = projectSessions.slice(0, 5).map(s => ({
      id: s.id,
      title: s.customName || s.preview.slice(0, 80),
      lastActivity: s.lastActivity,
    }))
    try {
      const res = await window.electronAPI.upsertObsidianProjectNote({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        sessionCount: projectSessions.length,
        recentSessions,
        previousNotePath: project.obsidianNotePath,
      })
      if (!res.ok || !res.path) return
      // 경로 저장 (다음 동기화 시 이전 위치 정리용) — 최신 projects 상태 위에 머지
      setProjects(prev => {
        const current = prev.find(p => p.id === project.id)
        if (!current) return prev // 삭제된 프로젝트면 무시
        if (current.obsidianNotePath === res.path) return prev // 이미 동일하면 재저장 X
        const next = prev.map(p =>
          p.id === project.id ? { ...p, obsidianNotePath: res.path } : p
        )
        window.electronAPI?.saveProjects(next)
        return next
      })
    } catch (err) {
      console.warn('Obsidian 동기화 실패 (무시):', err)
    }
  }, [settings.obsidian, activeSessions])

  const createProject = async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'sessionIds'>) => {
    const now = new Date().toISOString()
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      ...data,
      createdAt: now,
      updatedAt: now,
      sessionIds: [],
    }
    await saveProjects([...projects, newProject])
    syncProjectToObsidian(newProject)
  }

  const updateProject = async (id: string, data: Partial<Project>) => {
    const updated = projects.map(p =>
      p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
    )
    await saveProjects(updated)
    const target = updated.find(p => p.id === id)
    if (target) syncProjectToObsidian(target)
  }

  const deleteProject = async (id: string) => {
    if (selectedProjectId === id) setSelectedProjectId(null)
    // 프로젝트 삭제 시 소속 세션의 projectId 제거
    const updated = sessions.map(s => s.projectId === id ? { ...s, projectId: undefined } : s)
    const newMeta = { ...metadata }
    for (const s of updated) {
      if (metadata[s.id]?.projectId === id) {
        newMeta[s.id] = { ...newMeta[s.id], projectId: undefined }
      }
    }
    setMetadata(newMeta)
    setSessions(updated)
    if (window.electronAPI) await window.electronAPI.saveMetadata(newMeta)
    await saveProjects(projects.filter(p => p.id !== id))
  }

  const assignSessionToProject = async (sessionId: string, projectId: string | null) => {
    await applyMetaUpdate(sessionId, { projectId: projectId === null ? undefined : projectId })
  }

  // Step 2: Obsidian 노트 임포트 — 새 프로젝트 생성 + 노트에 cmdtrace_id 백필
  const importProjectsFromObsidian = async (
    picks: { candidate: { path: string; name: string; status: 'active' | 'completed' | 'archived'; description?: string }; name: string; color: string }[]
  ) => {
    if (picks.length === 0) return
    const now = new Date().toISOString()
    const newProjects: Project[] = picks.map((p, i) => ({
      id: `proj_${Date.now()}_${i}`,
      name: p.name,
      description: p.candidate.description,
      color: p.color,
      status: p.candidate.status,
      createdAt: now,
      updatedAt: now,
      sessionIds: [],
      obsidianNotePath: p.candidate.path,
    }))
    await saveProjects([...projects, ...newProjects])

    // 각 노트에 cmdtrace_id 백필 (병렬, 실패는 무시)
    if (window.electronAPI?.backfillObsidianCmdtraceId) {
      await Promise.allSettled(
        newProjects.map(p =>
          window.electronAPI.backfillObsidianCmdtraceId(p.obsidianNotePath!, p.id)
        )
      )
    }
  }

  const createProjectFromSession = async (sessionId: string, data: ProjectFormData) => {
    const now = new Date().toISOString()
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      ...data,
      createdAt: now,
      updatedAt: now,
      sessionIds: [],
    }
    await saveProjects([...projects, newProject])
    await applyMetaUpdate(sessionId, { projectId: newProject.id })
    syncProjectToObsidian(newProject)
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
    <div className="flex flex-col h-screen bg-surface-base text-ink-primary">
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
          workspaceCount={workspaces.length}
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
            activeSessionIds={activeSessionIds}
            selectedSessionIds={selectedSessionIds}
            onToggleSelect={(id) => setSelectedSessionIds(prev => {
              const next = new Set(prev)
              next.has(id) ? next.delete(id) : next.add(id)
              return next
            })}
            onSaveAsWorkspace={() => setShowSaveWorkspaceModal(true)}
            onClearSelection={() => setSelectedSessionIds(new Set())}
            onSaveActiveAsWorkspace={saveActiveAsWorkspace}
            onBulkPin={bulkPin}
            onBulkFavorite={bulkFavorite}
          />
        )}

        <div className="flex-1 overflow-hidden">
          {activeView === 'sessions' && selectedSession ? (
            <SessionDetail
              session={sessionsWithAutoProject.find(s => s.id === selectedSession.id) ?? selectedSession}
              settings={settings}
              isActive={activeSessionIds.has(selectedSession.sessionId)}
              onUpdateMeta={updateSessionMeta}
              onDelete={deleteSession}
              projects={projects}
              folders={uniqueFolders}
              onAssignSession={assignSessionToProject}
              onCreateProjectFromSession={createProjectFromSession}
            />
          ) : activeView === 'sessions' ? (
            <EmptyState onRefresh={loadSessions} />
          ) : activeView === 'dashboard' ? (
            <Dashboard sessions={activeSessions} />
          ) : activeView === 'projects' ? (
            selectedProjectId && projects.find(p => p.id === selectedProjectId) ? (
              <ProjectDetailView
                project={projects.find(p => p.id === selectedProjectId)!}
                sessions={sessionsWithAutoProject}
                onBack={() => setSelectedProjectId(null)}
                onUpdateProject={updateProject}
                onSelectSession={s => { setSelectedSession(s); setActiveView('sessions') }}
                onAssignSession={assignSessionToProject}
              />
            ) : (
            <ProjectsView
              projects={projects}
              sessions={sessionsWithAutoProject}
              folders={uniqueFolders}
              obsidianEnabled={!!settings.obsidian?.enabled}
              onCreateProject={createProject}
              onUpdateProject={updateProject}
              onDeleteProject={deleteProject}
              onAssignSession={assignSessionToProject}
              onSelectSession={s => { setSelectedSession(s); setActiveView('sessions') }}
              onSelectProject={setSelectedProjectId}
              onImportFromObsidian={importProjectsFromObsidian}
            />
            )
          ) : activeView === 'workspaces' ? (
            <WorkspacesView
              workspaces={workspaces}
              settings={settings}
              onDelete={deleteWorkspace}
              onRename={renameWorkspace}
            />
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

      {showSaveWorkspaceModal && (
        <WorkspaceModal
          sessionCount={selectedSessionIds.size}
          onSave={createWorkspace}
          onClose={() => setShowSaveWorkspaceModal(false)}
        />
      )}
    </div>
  )
}

// ─── 빈 상태 ──────────────────────────────────────────────
function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-ink-muted gap-4 bg-surface-soft">
      <div className="w-16 h-16 rounded-2xl bg-surface-base border border-border shadow-card flex items-center justify-center text-3xl">
        💬
      </div>
      <p className="text-base font-semibold text-ink-secondary">세션을 선택하세요</p>
      <p className="text-sm text-ink-muted">왼쪽 목록에서 세션을 클릭하면 대화 내용을 볼 수 있습니다</p>
      <button
        onClick={onRefresh}
        className="mt-1 btn-primary"
      >
        새로고침
      </button>
    </div>
  )
}
