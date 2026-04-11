import { app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog, nativeImage } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as https from 'https'

const isDev = process.env.ELECTRON_DEV === 'true'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ─── 상수 (중복 제거) ──────────────────────────────────────
const CLAUDE_BASE     = path.join(os.homedir(), '.claude', 'projects')
const META_PATH       = path.join(os.homedir(), '.claude', 'cmdtrace-meta.json')
const SETTINGS_PATH   = path.join(os.homedir(), '.claude', 'cmdtrace-settings.json')
const PROJECTS_PATH   = path.join(os.homedir(), '.claude', 'cmdtrace-projects.json')

// ─── Obsidian 연동 — 설정에서 동적 로드 ────────────────────
interface ObsidianConfig {
  enabled: boolean
  apiUrl: string
  apiToken: string
  vaultName: string
}

function loadObsidianConfig(): ObsidianConfig | null {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return null
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    const o = settings?.obsidian
    if (!o || !o.enabled || !o.apiUrl || !o.apiToken) return null
    return {
      enabled: !!o.enabled,
      apiUrl: String(o.apiUrl).replace(/\/$/, ''),
      apiToken: String(o.apiToken),
      vaultName: String(o.vaultName || ''),
    }
  } catch {
    return null
  }
}

// 세션 재개 패널 카운터 (0~3, 2×2 그리드 순환)
let sessionPaneCount = 0
const WT_WINDOW = 'cmdtrace-sessions'

// ─── 보안 유틸리티 ──────────────────────────────────────────

/** C-1: sessionId 검증 — 영문숫자·하이픈·언더스코어만 허용 */
function sanitizeSessionId(id: string): string | null {
  if (typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id)) return id
  return null
}

/** C-2 / C-4: 경로가 특정 베이스 디렉토리 안에 있는지 검증 (경로 순회 방지) */
function validatePathInBase(filePath: string, baseDir: string): boolean {
  const resolved    = path.resolve(filePath)
  const resolvedBase = path.resolve(baseDir)
  return resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase
}

/** C-2: 경로가 실제로 존재하는 디렉토리인지 검증 */
function isValidDirectory(dirPath: string): boolean {
  try { return fs.statSync(dirPath).isDirectory() } catch { return false }
}

// ─── 윈도우 생성 ───────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    mainWindow.loadFile(indexPath)
    mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
      console.error('로드 실패:', code, desc, indexPath)
    })
  }

  // 최소화 시 트레이로 숨김 (트레이가 활성화된 경우)
  mainWindow.on('minimize', ((e: Electron.Event) => {
    if (tray && mainWindow) {
      e.preventDefault()
      mainWindow.hide()
    }
  }) as (...args: unknown[]) => void)

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── 트레이 아이콘 경로 해석 ───────────────────────────────
function resolveTrayIconPath(): string {
  // packaged: process.resourcesPath/Resources/AppIcon.png
  // dev: <repo>/Resources/AppIcon.png
  const candidates = [
    path.join(process.resourcesPath, 'Resources', 'AppIcon.png'),
    path.join(__dirname, '..', 'Resources', 'AppIcon.png'),
    path.join(__dirname, '..', '..', 'Resources', 'AppIcon.png'),
  ]
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p } catch { /* skip */ }
  }
  return ''
}

// ─── IPC: 세션 목록 ────────────────────────────────────────
ipcMain.handle('sessions:load', async (_event, agentType: string) => {
  if (agentType === 'claude') {
    return loadClaudeSessions(CLAUDE_BASE)
  } else if (agentType === 'opencode') {
    const openCodeBase = path.join(os.homedir(), '.local', 'share', 'opencode', 'storage', 'message')
    return loadOpenCodeSessions(openCodeBase)
  }
  return []
})

// ─── IPC: 세션 메시지 (C-3 + C-4 수정) ────────────────────
ipcMain.handle('session:messages', async (_event, projectFolder: string, fileName: string) => {
  // OpenCode 세션: projectFolder가 절대경로
  if (path.isAbsolute(projectFolder)) {
    return loadOpenCodeMessages(projectFolder)
  }
  // Claude 세션: 경로 순회 방지 검증
  const filePath = path.join(CLAUDE_BASE, projectFolder, fileName)
  if (!validatePathInBase(filePath, CLAUDE_BASE)) {
    console.error('[보안] 경로 순회 차단:', filePath)
    return []
  }
  return loadClaudeMessages(filePath)
})

// ─── IPC: 세션 인사이트 (C-3 + C-4 수정) ──────────────────
ipcMain.handle('session:insights', async (_event, projectFolder: string, fileName: string) => {
  if (path.isAbsolute(projectFolder)) {
    return emptyInsights() // OpenCode는 인사이트 미지원
  }
  const filePath = path.join(CLAUDE_BASE, projectFolder, fileName)
  if (!validatePathInBase(filePath, CLAUDE_BASE)) {
    console.error('[보안] 경로 순회 차단:', filePath)
    return emptyInsights()
  }
  return loadSessionInsights(filePath)
})

// ─── IPC: 세션 재개 (C-1 수정) ────────────────────────────
ipcMain.handle('session:resume', async (_event, sessionId: string, projectPath: string, terminal: string, bypass: boolean) => {
  // sessionId 검증 (C-1: 명령어 인젝션 방지)
  const safeId = sanitizeSessionId(sessionId)
  if (!safeId) {
    console.error('[보안] 유효하지 않은 sessionId:', sessionId)
    return { success: false, error: 'Invalid session ID' }
  }

  // projectPath 검증 (빈 문자열은 허용, 있으면 실제 디렉토리여야 함)
  if (projectPath && !isValidDirectory(projectPath)) {
    console.error('[보안] 유효하지 않은 projectPath:', projectPath)
    return { success: false, error: 'Invalid project path' }
  }

  // 안전한 claude 명령어 인수 배열 (문자열 연결 금지)
  const claudeArgs = bypass
    ? ['claude', '-r', safeId, '--dangerously-skip-permissions']
    : ['claude', '-r', safeId]
  const resumeCmd = claudeArgs.join(' ') // safeId는 알파뉴메릭만 허용되므로 안전

  const dirArgs = projectPath ? ['-d', projectPath] : []

  const shellArgs = terminal === 'powershell'
    ? ['powershell', '-NoExit', '-Command', resumeCmd]
    : ['cmd', '/k', resumeCmd]

  const pane = sessionPaneCount
  sessionPaneCount = (sessionPaneCount + 1) % 4

  const spawnAndWatch = (cmd: string, args: string[], opts: object): void => {
    const proc: ChildProcess = spawn(cmd, args, opts)
    proc.on('error', (err) => console.error(`[spawn] ${cmd} 오류:`, err))
  }

  switch (terminal) {
    case 'wt':
    case 'powershell': {
      let wtArgs: string[]
      if (pane === 0) {
        wtArgs = ['-w', WT_WINDOW, 'nt', '--title', 'Session 1', ...dirArgs, ...shellArgs]
      } else if (pane === 1) {
        wtArgs = ['-w', WT_WINDOW, 'sp', '-V', '--title', 'Session 2', ...dirArgs, ...shellArgs]
      } else if (pane === 2) {
        wtArgs = ['-w', WT_WINDOW, 'mf', 'left', ';', 'sp', '-H', '--title', 'Session 3', ...dirArgs, ...shellArgs]
      } else {
        wtArgs = ['-w', WT_WINDOW, 'mf', 'right', ';', 'sp', '-H', '--title', 'Session 4', ...dirArgs, ...shellArgs]
      }
      spawnAndWatch('wt', wtArgs, { detached: true, shell: false })
      break
    }
    case 'cmd':
    default: {
      // shell: false 사용, start /d 로 작업 디렉토리 지정
      const startArgs = projectPath
        ? ['/c', 'start', '/d', projectPath, 'cmd', '/k', resumeCmd]
        : ['/c', 'start', 'cmd', '/k', resumeCmd]
      spawnAndWatch('cmd', startArgs, { detached: true, shell: false })
      break
    }
  }
  return { success: true }
})

// ─── IPC: 패널 카운터 리셋 ─────────────────────────────────
ipcMain.handle('session:resetPanes', () => {
  sessionPaneCount = 0
  return { success: true }
})

// ─── IPC: 폴더 열기 (C-2 수정) ────────────────────────────
ipcMain.handle('shell:openFolder', async (_event, folderPath: string) => {
  if (!isValidDirectory(folderPath)) {
    console.error('[보안] 유효하지 않은 폴더 경로:', folderPath)
    return
  }
  await shell.openPath(folderPath)
})

// ─── IPC: 메타데이터 저장/불러오기 ────────────────────────
ipcMain.handle('metadata:save', async (_event, data: Record<string, unknown>) => {
  try {
    fs.writeFileSync(META_PATH, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true }
  } catch (err) {
    console.error('메타데이터 저장 실패:', err)
    return { success: false }
  }
})

ipcMain.handle('metadata:load', async () => {
  if (!fs.existsSync(META_PATH)) return {}
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf-8'))
  } catch {
    return {}
  }
})

// ─── IPC: 설정 저장/불러오기 (H-1: 설정 영속성) ───────────
ipcMain.handle('settings:save', async (_event, data: Record<string, unknown>) => {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true }
  } catch (err) {
    console.error('설정 저장 실패:', err)
    return { success: false }
  }
})

ipcMain.handle('settings:load', async () => {
  if (!fs.existsSync(SETTINGS_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
  } catch {
    return null
  }
})

// ─── IPC: 프로젝트 저장/불러오기 ──────────────────────────
ipcMain.handle('projects:save', async (_event, data: unknown[]) => {
  try {
    fs.writeFileSync(PROJECTS_PATH, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true }
  } catch (err) {
    console.error('프로젝트 저장 실패:', err)
    return { success: false }
  }
})

ipcMain.handle('projects:load', async () => {
  if (!fs.existsSync(PROJECTS_PATH)) return []
  try {
    return JSON.parse(fs.readFileSync(PROJECTS_PATH, 'utf-8'))
  } catch {
    return []
  }
})

// ─── IPC: Obsidian 연동 ────────────────────────────────────

/** Obsidian REST API 요청 헬퍼 (자체서명 인증서 허용) */
function obsidianRequest(
  config: ObsidianConfig,
  method: string,
  apiPath: string,
  body?: string,
): Promise<{ ok: boolean; status: number; data: string }> {
  return new Promise((resolve) => {
    const url = new URL(apiPath, config.apiUrl)
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      rejectUnauthorized: false,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode || 0, data }))
    })
    req.on('error', () => resolve({ ok: false, status: 0, data: '' }))
    if (body) req.write(body)
    req.end()
  })
}

ipcMain.handle('obsidian:searchNote', async (_event, projectName: string) => {
  const config = loadObsidianConfig()
  if (!config) {
    return { found: false, error: 'Obsidian 연동이 설정되지 않았습니다. 설정에서 연결 정보를 입력하세요.' }
  }

  /** 검색어로 74. Projects 폴더 내 노트 찾기 */
  async function searchInProjects(query: string): Promise<string | null> {
    const res = await obsidianRequest(config!, 'POST', `/search/simple/?query=${encodeURIComponent(query)}`)
    if (!res.ok) return null
    const results: { filename: string; score: number }[] = JSON.parse(res.data)
    if (!Array.isArray(results) || results.length === 0) return null
    const match = results.find(r => r.filename.includes('74. Projects'))
    return match ? match.filename : null
  }

  try {
    // 1차: 프로젝트명으로 검색
    let found = await searchInProjects(projectName)

    // 2차: 실패 시 프로젝트명에서 주요 단어 추출하여 재시도 (영문 우선)
    if (!found) {
      const words = projectName.split(/[\s\-_]+/).filter(w => w.length > 2)
      const sorted = [...words].sort((a, b) => {
        const aEng = /^[a-zA-Z]/.test(a) ? 0 : 1
        const bEng = /^[a-zA-Z]/.test(b) ? 0 : 1
        return aEng - bEng
      })
      for (const word of sorted) {
        found = await searchInProjects(word)
        if (found) break
      }
    }

    if (found) return { found: true, path: found }

    const ping = await obsidianRequest(config, 'GET', '/')
    if (!ping.ok) return { found: false, error: 'Obsidian 연결 실패. Obsidian이 실행 중인지 확인하세요.' }

    return { found: false, error: `"${projectName}" 관련 프로젝트 노트를 찾을 수 없습니다.` }
  } catch (err) {
    console.error('Obsidian 검색 실패:', err)
    return { found: false, error: 'Obsidian API 요청 실패' }
  }
})

ipcMain.handle('obsidian:openNote', async (_event, filePath: string) => {
  const config = loadObsidianConfig()
  if (!config || !config.vaultName) {
    return { success: false, error: 'Obsidian 볼트 이름이 설정되지 않았습니다.' }
  }
  try {
    const uri = `obsidian://open?vault=${encodeURIComponent(config.vaultName)}&file=${encodeURIComponent(filePath)}`
    await shell.openExternal(uri)
    return { success: true }
  } catch (err) {
    console.error('Obsidian 노트 열기 실패:', err)
    return { success: false, error: 'Obsidian 노트를 열 수 없습니다.' }
  }
})

ipcMain.handle('obsidian:testConnection', async () => {
  const config = loadObsidianConfig()
  if (!config) {
    return { ok: false, error: '설정이 비어 있거나 연동이 비활성화 상태입니다.' }
  }
  try {
    const res = await obsidianRequest(config, 'GET', '/')
    if (!res.ok) {
      return { ok: false, error: `연결 실패 (status ${res.status}). API 키 또는 URL을 확인하세요.` }
    }
    let vault: string | undefined
    try {
      const parsed = JSON.parse(res.data)
      vault = parsed?.manifest?.id || parsed?.service
    } catch { /* ignore */ }
    return { ok: true, vault }
  } catch (err) {
    console.error('Obsidian 연결 테스트 실패:', err)
    return { ok: false, error: 'Obsidian REST API에 도달할 수 없습니다. Obsidian 실행 여부를 확인하세요.' }
  }
})

// ─── IPC: 세션 내보내기 ────────────────────────────────────
ipcMain.handle('session:export', async (_event, content: string, format: string, sessionName: string) => {
  const ext = format === 'json' ? 'json' : format === 'html' ? 'html' : 'md'
  const safe = sessionName.replace(/[^a-zA-Z0-9가-힣_\- ]/g, '').slice(0, 50) || 'session'
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: '세션 내보내기',
    defaultPath: `${safe}.${ext}`,
    filters: [
      { name: ext.toUpperCase(), extensions: [ext] },
      { name: '모든 파일', extensions: ['*'] },
    ],
  })
  if (canceled || !filePath) return { success: false }
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    shell.showItemInFolder(filePath)
    return { success: true, path: filePath }
  } catch (err) {
    console.error('내보내기 실패:', err)
    return { success: false }
  }
})

// ─── Claude 세션 로더 ──────────────────────────────────────
function loadClaudeSessions(claudeBase: string): SessionData[] {
  if (!fs.existsSync(claudeBase)) return []

  const sessions: SessionData[] = []
  let projectDirs: fs.Dirent[]
  try {
    projectDirs = fs.readdirSync(claudeBase, { withFileTypes: true }).filter(d => d.isDirectory())
  } catch {
    return []
  }

  for (const dir of projectDirs) {
    const dirPath = path.join(claudeBase, dir.name)
    try {
      const files = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'))

      for (const file of files) {
        const filePath = path.join(dirPath, file)
        const session = parseClaudeSession(filePath, dir.name)
        if (session && session.messageCount > 0) sessions.push(session)
      }
    } catch {
      // 읽기 실패한 디렉토리 건너뜀
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
    let preview = '', cwd = ''
    let firstTimestamp: string | null = null
    let lastTimestamp: string | null = null
    let messageCount = 0

    for (const line of lines) {
      try {
        const json = JSON.parse(line)
        if (json.sessionId && sessionId === fileName.replace('.jsonl', '')) sessionId = json.sessionId
        if (!cwd && json.cwd) cwd = json.cwd
        if (json.timestamp) {
          if (!firstTimestamp) firstTimestamp = json.timestamp
          lastTimestamp = json.timestamp
        }
        if (!preview && json.type === 'user' && json.message?.content) {
          preview = String(json.message.content).slice(0, 200)
        }
        if (json.type === 'user' || json.type === 'assistant') messageCount++
      } catch { /* JSON 파싱 실패 건너뜀 */ }
    }

    const username = os.userInfo().username
    const projectName = projectFolder
      .replace(new RegExp(`-Users-${username}-`, 'g'), '')
      .replace(/-/g, '/')

    return {
      id: `${projectFolder}/${sessionId}`,
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

// ─── Claude 메시지 로더 (I-3: try/catch 추가) ──────────────
function loadClaudeMessages(filePath: string): MessageData[] {
  if (!fs.existsSync(filePath)) return []

  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch (err) {
    console.error('파일 읽기 실패:', filePath, err)
    return []
  }

  const lines = content.split('\n').filter(l => l.trim())
  const messages: MessageData[] = []

  for (const line of lines) {
    try {
      const json = JSON.parse(line)
      if (json.type !== 'user' && json.type !== 'assistant') continue

      const msgObj = json.message
      if (!msgObj) continue

      let msgContent = '', isToolUse = false

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
        role: json.type as 'user' | 'assistant',  // I-4: 타입 명시
        content: msgContent,
        timestamp: json.timestamp || null,
        modelId: msgObj.model || null,
        agentId: json.agentId || null,
        isToolUse,
      })
    } catch { /* 파싱 실패 건너뜀 */ }
  }

  return messages
}

// ─── OpenCode 메시지 로더 (C-3: 신규 추가) ─────────────────
function loadOpenCodeMessages(dirPath: string): MessageData[] {
  if (!fs.existsSync(dirPath)) return []

  const messages: MessageData[] = []
  try {
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json')).sort()
    for (const file of files) {
      try {
        const json = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf-8'))
        if (json.role !== 'user' && json.role !== 'assistant') continue

        let content = ''
        if (typeof json.content === 'string') {
          content = json.content
        } else if (Array.isArray(json.content)) {
          for (const item of json.content) {
            if (item.type === 'text') content += item.text || ''
            else if (item.type === 'tool_use') content += `[Tool: ${item.name}]`
          }
        }
        if (!content) continue

        messages.push({
          role: json.role as 'user' | 'assistant',
          content,
          timestamp: json.time?.created ? new Date(json.time.created).toISOString() : null,
          modelId: json.model || null,
          agentId: null,
          isToolUse: false,
        })
      } catch { /* 개별 파일 파싱 실패 건너뜀 */ }
    }
  } catch { /* 디렉토리 읽기 실패 */ }

  return messages
}

// ─── 인사이트 로더 ─────────────────────────────────────────
function loadSessionInsights(filePath: string): InsightsData {
  if (!fs.existsSync(filePath)) return emptyInsights()

  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return emptyInsights()
  }

  const lines = content.split('\n').filter(l => l.trim())
  const toolCounts: Record<string, number> = {}
  let totalInput = 0, totalOutput = 0, totalCacheCreate = 0, totalCacheRead = 0, totalDurationMs = 0
  const modelUsage: Record<string, { count: number; input: number; output: number }> = {}

  for (const line of lines) {
    try {
      const json = JSON.parse(line)
      if (json.type === 'assistant') {
        const msg = json.message
        if (msg?.content && Array.isArray(msg.content)) {
          for (const item of msg.content) {
            if (item.type === 'tool_use') toolCounts[item.name] = (toolCounts[item.name] || 0) + 1
          }
        }
        if (msg?.usage) {
          totalInput       += msg.usage.input_tokens || 0
          totalOutput      += msg.usage.output_tokens || 0
          totalCacheCreate += msg.usage.cache_creation_input_tokens || 0
          totalCacheRead   += msg.usage.cache_read_input_tokens || 0
          if (msg.model) {
            if (!modelUsage[msg.model]) modelUsage[msg.model] = { count: 0, input: 0, output: 0 }
            modelUsage[msg.model].count++
            modelUsage[msg.model].input  += msg.usage.input_tokens || 0
            modelUsage[msg.model].output += msg.usage.output_tokens || 0
          }
        }
      }
      if (json.type === 'system' && json.subtype === 'turn_duration') totalDurationMs += json.durationMs || 0
    } catch { /* 파싱 실패 건너뜀 */ }
  }

  return {
    toolStatistics: Object.entries(toolCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    totalTokenUsage: { inputTokens: totalInput, outputTokens: totalOutput, cacheCreationInputTokens: totalCacheCreate, cacheReadInputTokens: totalCacheRead },
    modelUsage: Object.entries(modelUsage).map(([model, data]) => ({ model, messageCount: data.count, inputTokens: data.input, outputTokens: data.output })),
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

// ─── OpenCode 세션 로더 ────────────────────────────────────
function loadOpenCodeSessions(openCodeBase: string): SessionData[] {
  if (!fs.existsSync(openCodeBase)) return []

  const sessions: SessionData[] = []
  let dirs: fs.Dirent[]
  try {
    dirs = fs.readdirSync(openCodeBase, { withFileTypes: true }).filter(d => d.isDirectory() && d.name.startsWith('ses_'))
  } catch {
    return []
  }

  for (const dir of dirs) {
    const dirPath = path.join(openCodeBase, dir.name)
    try {
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'))
      let messageCount = 0, firstTimestamp: string | null = null, lastTimestamp: string | null = null

      for (const file of files) {
        try {
          const json = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf-8'))
          if (json.role === 'user' || json.role === 'assistant') messageCount++
          if (json.time?.created) {
            const t = new Date(json.time.created).toISOString()
            if (!firstTimestamp) firstTimestamp = t
            lastTimestamp = t
          }
        } catch { /* 파싱 실패 건너뜀 */ }
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
        projectFolder: dirPath, // 절대경로로 저장 (session:messages 분기 조건)
        fileName: dir.name,
        tags: [],
        customName: null,
      })
    } catch { /* 디렉토리 읽기 실패 건너뜀 */ }
  }

  return sessions.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
}

// ─── 타입 정의 ─────────────────────────────────────────────
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
  role: 'user' | 'assistant'  // I-4: string → union 타입
  content: string
  timestamp: string | null
  modelId: string | null
  agentId: string | null
  isToolUse: boolean
}

interface InsightsData {
  toolStatistics: { name: string; count: number }[]
  totalTokenUsage: { inputTokens: number; outputTokens: number; cacheCreationInputTokens: number; cacheReadInputTokens: number }
  modelUsage: { model: string; messageCount: number; inputTokens: number; outputTokens: number }[]
  totalDurationMs: number
}

// ─── 딥링크 프로토콜 핸들러 (cmdtrace://) ──────────────────
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  // setAsDefaultProtocolClient 사용 금지 — Electron이 URL을 모듈 경로로 해석하는 버그 있음
  // 프로토콜 등록은 scripts/register-protocol.ps1 배치 래퍼로 수동 등록

  app.on('second-instance', (_event, commandLine) => {
    // 앱 실행 중 딥링크 클릭 시: second-instance에서 환경변수 또는 argv로 URL 전달
    const deepLink = commandLine.find(arg => arg.startsWith('cmdtrace://'))
    if (deepLink && mainWindow) {
      mainWindow.webContents.send('deeplink:navigate', deepLink)
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ─── 앱 초기화 ─────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()

  // 시작 시 딥링크 확인 (환경 변수 또는 process.argv에서 URL 읽기)
  const deepLink = process.env.CMDTRACE_DEEPLINK || process.argv.find(arg => arg.startsWith('cmdtrace://'))
  if (deepLink && mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('deeplink:navigate', deepLink)
    })
  }

  // Tray 아이콘 초기화
  try {
    const iconPath = resolveTrayIconPath()
    const icon = iconPath
      ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
      : nativeImage.createEmpty()
    tray = new Tray(icon)
    const contextMenu = Menu.buildFromTemplate([
      { label: 'CmdTrace 열기', click: () => { mainWindow?.show(); mainWindow?.focus() } },
      { type: 'separator' },
      { label: '종료', click: () => { tray?.destroy(); app.quit() } },
    ])
    tray.setToolTip('CmdTrace')
    tray.setContextMenu(contextMenu)
    const restoreWindow = () => {
      if (!mainWindow) return
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
    tray.on('click', restoreWindow)
    tray.on('double-click', restoreWindow)
  } catch (err) {
    console.error('Tray 초기화 실패:', err)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
