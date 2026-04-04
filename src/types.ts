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
}

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
export type ThemeType = 'dark' | 'light'

export interface AppSettings {
  terminal: TerminalType
  theme: ThemeType
  bypassPermissions: boolean
  agentType: AgentType
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
    }
  }
}
