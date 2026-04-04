import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron'
import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

const isDev = process.env.ELECTRON_DEV === 'true'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// 세션 재개 패널 카운터 (0~3, 2×2 그리드 순환)
// 0=왼쪽, 1=오른쪽, 2=왼쪽 아래, 3=오른쪽 아래
let sessionPaneCount = 0
const WT_WINDOW = 'cmdtrace-sessions' // 전용 WT named window

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // DevTools는 필요할 때만 수동으로 열기 (Ctrl+Shift+I)
    // mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    mainWindow.loadFile(indexPath)
    // 로딩 에러 시 콘솔에 출력
    mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
      console.error('로드 실패:', code, desc, indexPath)
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC: Claude Code 세션 파일 읽기
ipcMain.handle('sessions:load', async (_event, agentType: string) => {
  const homeDir = os.homedir()

  if (agentType === 'claude') {
    // Windows: ~/.claude/projects/ (Claude Code는 Windows에서도 동일 경로 사용)
    const claudeBase = path.join(homeDir, '.claude', 'projects')
    return loadClaudeSessions(claudeBase)
  } else if (agentType === 'opencode') {
    // OpenCode Windows 경로
    const openCodeBase = path.join(homeDir, '.local', 'share', 'opencode', 'storage', 'message')
    return loadOpenCodeSessions(openCodeBase)
  }
  return []
})

// IPC: 특정 세션의 메시지 읽기
ipcMain.handle('session:messages', async (_event, projectFolder: string, fileName: string) => {
  const homeDir = os.homedir()
  const claudeBase = path.join(homeDir, '.claude', 'projects')
  const filePath = path.join(claudeBase, projectFolder, fileName)
  return loadClaudeMessages(filePath)
})

// IPC: 세션 인사이트 읽기 (토큰, 툴 사용 등)
ipcMain.handle('session:insights', async (_event, projectFolder: string, fileName: string) => {
  const homeDir = os.homedir()
  const claudeBase = path.join(homeDir, '.claude', 'projects')
  const filePath = path.join(claudeBase, projectFolder, fileName)
  return loadSessionInsights(filePath)
})

// IPC: Windows Terminal에서 세션 재개
ipcMain.handle('session:resume', async (_event, sessionId: string, projectPath: string, terminal: string, bypass: boolean) => {
  const resumeCmd = bypass
    ? `claude -r ${sessionId} --dangerously-skip-permissions`
    : `claude -r ${sessionId}`

  const cdCmd = projectPath ? `cd /d "${projectPath}" && ` : ''
  const fullCmd = `${cdCmd}${resumeCmd}`

  const dirArgs = projectPath ? ['-d', projectPath] : []
  const shellArgs = terminal === 'powershell'
    ? ['powershell', '-NoExit', '-Command', resumeCmd]
    : ['cmd', '/k', resumeCmd]

  const pane = sessionPaneCount
  sessionPaneCount = (sessionPaneCount + 1) % 4 // 0→1→2→3→0 순환

  switch (terminal) {
    case 'wt':
    case 'powershell': {
      // 2×2 그리드 패턴
      // pane 0: 왼쪽 (새 전용 탭으로 시작)
      // pane 1: 오른쪽 (세로 분할)
      // pane 2: 왼쪽 아래 (pane 0 가로 분할)
      // pane 3: 오른쪽 아래 (pane 1 가로 분할)
      let wtArgs: string[]

      if (pane === 0) {
        // 전용 named window에 새 탭으로 열기 (왼쪽 = 첫 번째 패널)
        wtArgs = ['-w', WT_WINDOW, 'nt', '--title', 'Session 1', ...dirArgs, ...shellArgs]
      } else if (pane === 1) {
        // 현재 패널 세로 분할 → 오른쪽에 새 패널
        wtArgs = ['-w', WT_WINDOW, 'sp', '-V', '--title', 'Session 2', ...dirArgs, ...shellArgs]
      } else if (pane === 2) {
        // pane 0(왼쪽) 기준 가로 분할 → 왼쪽 아래
        wtArgs = [
          '-w', WT_WINDOW,
          'mf', 'left',   // 왼쪽 패널로 포커스 이동
          ';', 'sp', '-H', '--title', 'Session 3', ...dirArgs, ...shellArgs,
        ]
      } else {
        // pane 1(오른쪽) 기준 가로 분할 → 오른쪽 아래
        wtArgs = [
          '-w', WT_WINDOW,
          'mf', 'right',  // 오른쪽 패널로 포커스 이동
          ';', 'sp', '-H', '--title', 'Session 4', ...dirArgs, ...shellArgs,
        ]
      }

      spawn('wt', wtArgs, { detached: true, shell: false })
      break
    }
    case 'cmd':
    default:
      spawn('cmd', ['/c', 'start', 'cmd', '/k', fullCmd], { detached: true, shell: true })
      break
  }
  return { success: true }
})

// IPC: 패널 카운터 리셋 (새로 4-pane 레이아웃 시작)
ipcMain.handle('session:resetPanes', () => {
  sessionPaneCount = 0
  return { success: true }
})

// IPC: 파일 탐색기에서 폴더 열기
ipcMain.handle('shell:openFolder', async (_event, folderPath: string) => {
  shell.openPath(folderPath)
})

// IPC: 영구 메타데이터 저장 (커스텀 이름, 태그)
ipcMain.handle('metadata:save', async (_event, data: Record<string, unknown>) => {
  const metaPath = path.join(os.homedir(), '.claude', 'cmdtrace-meta.json')
  fs.writeFileSync(metaPath, JSON.stringify(data, null, 2), 'utf-8')
  return { success: true }
})

ipcMain.handle('metadata:load', async () => {
  const metaPath = path.join(os.homedir(), '.claude', 'cmdtrace-meta.json')
  if (!fs.existsSync(metaPath)) return {}
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  } catch {
    return {}
  }
})

// ─────────────────────────────────────────────────────
// Claude Code 세션 로더
// ─────────────────────────────────────────────────────
function loadClaudeSessions(claudeBase: string): SessionData[] {
  if (!fs.existsSync(claudeBase)) return []

  const sessions: SessionData[] = []
  const projectDirs = fs.readdirSync(claudeBase, { withFileTypes: true })
    .filter(d => d.isDirectory())

  for (const dir of projectDirs) {
    const dirPath = path.join(claudeBase, dir.name)
    try {
      const files = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'))

      for (const file of files) {
        const filePath = path.join(dirPath, file)
        const session = parseClaudeSession(filePath, dir.name)
        if (session && session.messageCount > 0) {
          sessions.push(session)
        }
      }
    } catch {
      // 읽기 실패한 디렉토리는 건너뜀
    }
  }

  return sessions.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
}

function parseClaudeSession(filePath: string, projectFolder: string): SessionData | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim())

    const fileName = path.basename(filePath)
    let sessionId = fileName.replace('.jsonl', '')
    let preview = ''
    let cwd = ''
    let firstTimestamp: string | null = null
    let lastTimestamp: string | null = null
    let messageCount = 0

    for (const line of lines) {
      try {
        const json = JSON.parse(line)

        if (json.sessionId && sessionId === fileName.replace('.jsonl', '')) {
          sessionId = json.sessionId
        }
        if (!cwd && json.cwd) cwd = json.cwd
        if (json.timestamp) {
          if (!firstTimestamp) firstTimestamp = json.timestamp
          lastTimestamp = json.timestamp
        }
        if (!preview && json.type === 'user' && json.message?.content) {
          preview = String(json.message.content).slice(0, 200)
        }
        if (json.type === 'user' || json.type === 'assistant') {
          messageCount++
        }
      } catch {
        // JSON 파싱 실패 라인 건너뜀
      }
    }

    // Windows용 프로젝트명 변환: -Users-username-... 형식 처리
    const username = os.userInfo().username
    const projectName = projectFolder
      .replace(new RegExp(`-Users-${username}-`, 'g'), '')
      .replace(/-/g, '/')

    const uniqueId = `${projectFolder}/${sessionId}`

    return {
      id: uniqueId,
      sessionId,
      title: preview || sessionId,
      project: cwd || projectName,
      preview: preview || 'No preview available',
      messageCount,
      lastActivity: lastTimestamp || new Date().toISOString(),
      firstTimestamp: firstTimestamp || null,
      projectFolder,
      fileName,
      tags: [],
      customName: null,
    }
  } catch {
    return null
  }
}

function loadClaudeMessages(filePath: string): MessageData[] {
  if (!fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  const messages: MessageData[] = []

  for (const line of lines) {
    try {
      const json = JSON.parse(line)
      if (json.type !== 'user' && json.type !== 'assistant') continue

      const msgObj = json.message
      if (!msgObj) continue

      let msgContent = ''
      let isToolUse = false

      if (typeof msgObj.content === 'string') {
        msgContent = msgObj.content
      } else if (Array.isArray(msgObj.content)) {
        for (const item of msgObj.content) {
          if (item.type === 'text') msgContent += item.text || ''
          else if (item.type === 'tool_use') {
            isToolUse = true
            msgContent += `[Tool: ${item.name}]`
          }
        }
      }

      if (!msgContent) continue

      messages.push({
        role: json.type,
        content: msgContent,
        timestamp: json.timestamp || null,
        modelId: msgObj.model || null,
        agentId: json.agentId || null,
        isToolUse,
      })
    } catch {
      // 파싱 실패 건너뜀
    }
  }

  return messages
}

function loadSessionInsights(filePath: string): InsightsData {
  if (!fs.existsSync(filePath)) return emptyInsights()

  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  const toolCounts: Record<string, number> = {}
  let totalInput = 0, totalOutput = 0, totalCacheCreate = 0, totalCacheRead = 0
  let totalDurationMs = 0
  const modelUsage: Record<string, { count: number; input: number; output: number }> = {}

  for (const line of lines) {
    try {
      const json = JSON.parse(line)

      if (json.type === 'assistant') {
        const msg = json.message
        if (msg?.content && Array.isArray(msg.content)) {
          for (const item of msg.content) {
            if (item.type === 'tool_use') {
              toolCounts[item.name] = (toolCounts[item.name] || 0) + 1
            }
          }
        }
        if (msg?.usage) {
          totalInput += msg.usage.input_tokens || 0
          totalOutput += msg.usage.output_tokens || 0
          totalCacheCreate += msg.usage.cache_creation_input_tokens || 0
          totalCacheRead += msg.usage.cache_read_input_tokens || 0

          if (msg.model) {
            if (!modelUsage[msg.model]) modelUsage[msg.model] = { count: 0, input: 0, output: 0 }
            modelUsage[msg.model].count++
            modelUsage[msg.model].input += msg.usage.input_tokens || 0
            modelUsage[msg.model].output += msg.usage.output_tokens || 0
          }
        }
      }

      if (json.type === 'system' && json.subtype === 'turn_duration') {
        totalDurationMs += json.durationMs || 0
      }
    } catch {
      // 파싱 실패 건너뜀
    }
  }

  return {
    toolStatistics: Object.entries(toolCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    totalTokenUsage: {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheCreationInputTokens: totalCacheCreate,
      cacheReadInputTokens: totalCacheRead,
    },
    modelUsage: Object.entries(modelUsage).map(([model, data]) => ({
      model,
      messageCount: data.count,
      inputTokens: data.input,
      outputTokens: data.output,
    })),
    totalDurationMs,
  }
}

function emptyInsights(): InsightsData {
  return {
    toolStatistics: [],
    totalTokenUsage: { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    modelUsage: [],
    totalDurationMs: 0,
  }
}

function loadOpenCodeSessions(openCodeBase: string): SessionData[] {
  if (!fs.existsSync(openCodeBase)) return []

  const sessions: SessionData[] = []
  const dirs = fs.readdirSync(openCodeBase, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('ses_'))

  for (const dir of dirs) {
    const dirPath = path.join(openCodeBase, dir.name)
    try {
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'))
      let messageCount = 0
      let firstTimestamp: string | null = null
      let lastTimestamp: string | null = null

      for (const file of files) {
        const json = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf-8'))
        if (json.role === 'user' || json.role === 'assistant') messageCount++
        if (json.time?.created) {
          const t = new Date(json.time.created).toISOString()
          if (!firstTimestamp) firstTimestamp = t
          lastTimestamp = t
        }
      }

      if (messageCount === 0) continue

      sessions.push({
        id: dir.name,
        sessionId: dir.name,
        title: dir.name,
        project: dirPath,
        preview: 'OpenCode Session',
        messageCount,
        lastActivity: lastTimestamp || new Date().toISOString(),
        firstTimestamp,
        projectFolder: dirPath,
        fileName: dir.name,
        tags: [],
        customName: null,
      })
    } catch {
      // 읽기 실패 건너뜀
    }
  }

  return sessions.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
}

// 타입 정의
interface SessionData {
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

interface MessageData {
  role: string
  content: string
  timestamp: string | null
  modelId: string | null
  agentId: string | null
  isToolUse: boolean
}

interface InsightsData {
  toolStatistics: { name: string; count: number }[]
  totalTokenUsage: {
    inputTokens: number
    outputTokens: number
    cacheCreationInputTokens: number
    cacheReadInputTokens: number
  }
  modelUsage: { model: string; messageCount: number; inputTokens: number; outputTokens: number }[]
  totalDurationMs: number
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
