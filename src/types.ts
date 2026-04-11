// ─── 세션 ───────────────────────────────────────────────
export interface Session {
  id: string
  sessionId: string
  title: string
  project: string
  preview: string
  messageCount: number
  lastActivity: string
  firstTimestamp: string | null
  projectFolder: string
  fileName: string
  tags: string[]
  customName: string | null
  isDeleted?: boolean
  isFavorited?: boolean
  isPinned?: boolean
  projectId?: string
}

// ─── 프로젝트 ─────────────────────────────────────────────
export type ProjectStatus = 'active' | 'completed' | 'archived'

export interface Project {
  id: string
  name: string
  description?: string
  color: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  folderPath?: string
  obsidianNotePath?: string
  sessionIds: string[]
}

export const PROJECT_COLORS = [
  '#635bff', '#22c55e', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
] as const

// ─── 메시지 ──────────────────────────────────────────────
export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string | null
  modelId: string | null
  agentId: string | null
  isToolUse: boolean
}

// ─── 인사이트 ─────────────────────────────────────────────
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
}

export interface ToolStat {
  name: string
  count: number
}

export interface ModelUsage {
  model: string
  messageCount: number
  inputTokens: number
  outputTokens: number
}

export interface SessionInsights {
  toolStatistics: ToolStat[]
  totalTokenUsage: TokenUsage
  modelUsage: ModelUsage[]
  totalDurationMs: number
}

// ─── 설정 ────────────────────────────────────────────────
export type AgentType = 'claude' | 'opencode'
export type TerminalType = 'wt' | 'powershell' | 'cmd'
export type ThemeType = 'light' | 'dark' | 'system'
export type ExportFormat = 'md' | 'json' | 'html'

export interface ObsidianSettings {
  enabled: boolean
  apiUrl: string
  apiToken: string
  vaultName: string
  autoSync?: boolean  // Step 1: 프로젝트 CRUD 시 Obsidian 노트 자동 upsert
}

export interface UpsertProjectNotePayload {
  id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  sessionCount: number
  recentSessions: { id: string; title: string; lastActivity: string }[]
  previousNotePath?: string
}

export interface AppSettings {
  terminal: TerminalType
  theme: ThemeType
  bypassPermissions: boolean
  agentType: AgentType
  obsidian?: ObsidianSettings
}

// ─── Electron API 타입 ────────────────────────────────────
declare global {
  interface Window {
    electronAPI: {
      loadSessions: (agentType: string) => Promise<Session[]>
      loadMessages: (projectFolder: string, fileName: string) => Promise<Message[]>
      loadInsights: (projectFolder: string, fileName: string) => Promise<SessionInsights>
      resumeSession: (sessionId: string, projectPath: string, terminal: string, bypass: boolean) => Promise<{ success: boolean }>
      openFolder: (folderPath: string) => Promise<void>
      resetPanes: () => Promise<{ success: boolean }>
      saveMetadata: (data: Record<string, unknown>) => Promise<{ success: boolean }>
      loadMetadata: () => Promise<Record<string, unknown>>
      saveSettings: (data: Record<string, unknown>) => Promise<{ success: boolean }>
      loadSettings: () => Promise<AppSettings | null>
      saveProjects: (data: Project[]) => Promise<{ success: boolean }>
      loadProjects: () => Promise<Project[]>
      exportSession: (content: string, format: ExportFormat, sessionName: string) => Promise<{ success: boolean; path?: string }>
      // Obsidian 연동
      searchObsidianNote: (projectName: string) => Promise<{ found: boolean; path?: string; error?: string }>
      openObsidianNote: (filePath: string) => Promise<{ success: boolean; error?: string }>
      testObsidianConnection: () => Promise<{ ok: boolean; error?: string; vault?: string }>
      upsertObsidianProjectNote: (payload: UpsertProjectNotePayload) => Promise<{ ok: boolean; path?: string; error?: string }>
      // 딥링크
      onDeepLink: (callback: (url: string) => void) => void
    }
  }
}
