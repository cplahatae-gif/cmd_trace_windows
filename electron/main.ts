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
const CLAUDE_BASE       = path.join(os.homedir(), '.claude', 'projects')
const META_PATH         = path.join(os.homedir(), '.claude', 'cmdtrace-meta.json')
const SETTINGS_PATH     = path.join(os.homedir(), '.claude', 'cmdtrace-settings.json')
const PROJECTS_PATH     = path.join(os.homedir(), '.claude', 'cmdtrace-projects.json')
const WORKSPACES_PATH   = path.join(os.homedir(), '.claude', 'cmdtrace-workspaces.json')

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

// ─── 공통 헬퍼: 프로세스 실행 + 에러 로깅 ─────────────────
function spawnAndWatch(cmd: string, args: string[], opts: object): void {
  const proc: ChildProcess = spawn(cmd, args, opts)
  proc.on('error', (err) => console.error(`[spawn] ${cmd} 오류:`, err))
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
ipcMain.handle('session:resume', async (_event, sessionId: string, projectPath: string, terminal: string, bypass: boolean, agentType?: string) => {
  // sessionId 검증 (C-1: 명령어 인젝션 방지)
  const safeId = sanitizeSessionId(sessionId)
  if (!safeId) {
    console.error('[보안] 유효하지 않은 sessionId:', sessionId)
    return { success: false, error: 'Invalid session ID' }
  }

  // projectPath 검증 (빈 문자열은 허용, 있으면 실제 디렉토리여야 함)
  // 디렉토리가 없으면 경고만 하고 -d 없이 계속 (저장된 경로가 이동/삭제된 경우 대응)
  const validProjectPath = (projectPath && isValidDirectory(projectPath)) ? projectPath : ''
  if (projectPath && !validProjectPath) {
    console.warn('[경고] projectPath 디렉토리 없음, -d 없이 재개:', projectPath)
  }

  // agentType에 따라 CLI 선택 (기본값: claude)
  const cli = agentType === 'opencode' ? 'opencode' : 'claude'
  // 안전한 명령어 인수 배열 (문자열 연결 금지)
  const cliArgs = (cli === 'claude' && bypass)
    ? [cli, '-r', safeId, '--dangerously-skip-permissions']
    : [cli, '-r', safeId]
  const resumeCmd = cliArgs.join(' ') // safeId는 알파뉴메릭만 허용되므로 안전

  const dirArgs = validProjectPath ? ['-d', validProjectPath] : []

  const shellArgs = terminal === 'powershell'
    ? ['powershell', '-NoExit', '-Command', resumeCmd]
    : ['cmd', '/k', resumeCmd]

  const pane = sessionPaneCount
  sessionPaneCount = (sessionPaneCount + 1) % 4

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
      // P3-2 수정: validProjectPath 사용 (검증된 경로만 -d 인수로 전달)
      const startArgs = validProjectPath
        ? ['/c', 'start', '/d', validProjectPath, 'cmd', '/k', resumeCmd]
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

// ─── IPC: 워크스페이스 일괄 복원 (단일 wt 호출) ─────────────
// 순차 300ms 딜레이 대신 하나의 wt 명령에 모든 pane을 체이닝.
// WT가 내부적으로 순서대로 처리하므로 타이밍 경쟁 없음.
interface WsEntry {
  sessionId: string
  projectPath: string
  agentType: string
  title: string
}

ipcMain.handle('workspaces:restoreAll', async (
  _event,
  entries: WsEntry[],
  terminal: string,
  bypass: boolean
) => {
  if (!Array.isArray(entries) || entries.length === 0) return { success: true }

  // 유효한 세션만 필터링
  const valid = entries.filter(e => typeof e.sessionId === 'string' && sanitizeSessionId(e.sessionId))
  if (valid.length === 0) return { success: false, error: '유효한 세션이 없습니다.' }

  sessionPaneCount = 0

  const wtArgs: string[] = ['-w', WT_WINDOW]

  for (let i = 0; i < valid.length; i++) {
    const entry = valid[i]
    const safeId = sanitizeSessionId(entry.sessionId)!
    const cli = entry.agentType === 'opencode' ? 'opencode' : 'claude'
    const cliArgs = (cli === 'claude' && bypass)
      ? [cli, '-r', safeId, '--dangerously-skip-permissions']
      : [cli, '-r', safeId]
    const resumeCmd = cliArgs.join(' ')
    const validPath = (entry.projectPath && isValidDirectory(entry.projectPath)) ? entry.projectPath : ''
    const dirArgs = validPath ? ['-d', validPath] : []
    const shellArgs = terminal === 'powershell'
      ? ['powershell', '-NoExit', '-Command', resumeCmd]
      : ['cmd', '/k', resumeCmd]
    const title = entry.title?.slice(0, 30) || `Session ${i + 1}`
    const pane = i % 4

    if (i === 0) {
      wtArgs.push('nt', '--title', title, ...dirArgs, ...shellArgs)
    } else if (pane === 0) {
      // 5번째, 9번째... — 새 탭으로 열기
      wtArgs.push(';', 'nt', '--title', title, ...dirArgs, ...shellArgs)
    } else if (pane === 1) {
      wtArgs.push(';', 'sp', '-V', '--title', title, ...dirArgs, ...shellArgs)
    } else if (pane === 2) {
      wtArgs.push(';', 'mf', 'left', ';', 'sp', '-H', '--title', title, ...dirArgs, ...shellArgs)
    } else {
      wtArgs.push(';', 'mf', 'right', ';', 'sp', '-H', '--title', title, ...dirArgs, ...shellArgs)
    }
  }

  if (terminal === 'wt' || terminal === 'powershell') {
    spawnAndWatch('wt', wtArgs, { detached: true, shell: false })
  } else {
    // cmd 터미널: 각 세션을 별도 창으로 순차 실행 (wt 체이닝 불가)
    for (const entry of valid) {
      const safeId = sanitizeSessionId(entry.sessionId)!
      const cli = entry.agentType === 'opencode' ? 'opencode' : 'claude'
      const cliArgs = (cli === 'claude' && bypass) ? [cli, '-r', safeId, '--dangerously-skip-permissions'] : [cli, '-r', safeId]
      const resumeCmd = cliArgs.join(' ')
      const validPath = (entry.projectPath && isValidDirectory(entry.projectPath)) ? entry.projectPath : ''
      const startArgs = validPath
        ? ['/c', 'start', '/d', validPath, 'cmd', '/k', resumeCmd]
        : ['/c', 'start', 'cmd', '/k', resumeCmd]
      spawnAndWatch('cmd', startArgs, { detached: true, shell: false })
    }
  }
  sessionPaneCount = valid.length % 4

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

// ─── IPC: 실행 중인 세션 감지 ──────────────────────────────
ipcMain.handle('sessions:getActive', () => {
  return new Promise<string[]>((resolve) => {
    // WMI로 claude/opencode -r <sessionId> 프로세스 스캔
    const proc = spawn('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      'Get-WmiObject Win32_Process | Where-Object {$_.CommandLine -ne $null -and ($_.CommandLine -like "*claude*-r*" -or $_.CommandLine -like "*opencode*-r*")} | Select-Object -ExpandProperty CommandLine',
    ], { timeout: 8000 })

    let output = ''
    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.on('close', () => {
      const sessionIds: string[] = []
      for (const line of output.split('\n')) {
        const match = line.match(/-r\s+([a-zA-Z0-9_-]{8,40})/)
        if (match) {
          const safeId = sanitizeSessionId(match[1])
          if (safeId) sessionIds.push(safeId)
        }
      }
      resolve(sessionIds)
    })
    proc.on('error', () => resolve([]))
  })
})

// ─── IPC: 워크스페이스 저장/불러오기 ──────────────────────
ipcMain.handle('workspaces:save', async (_event, data: unknown[]) => {
  try {
    fs.writeFileSync(WORKSPACES_PATH, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true }
  } catch (err) {
    console.error('워크스페이스 저장 실패:', err)
    return { success: false }
  }
})

ipcMain.handle('workspaces:load', async () => {
  if (!fs.existsSync(WORKSPACES_PATH)) return []
  try {
    const parsed = JSON.parse(fs.readFileSync(WORKSPACES_PATH, 'utf-8'))
    if (!Array.isArray(parsed)) return []
    // 기본 스키마 검증: id/name/entries가 있는 항목만 통과
    return parsed.filter((w: unknown) =>
      w !== null &&
      typeof w === 'object' &&
      typeof (w as Record<string, unknown>).id === 'string' &&
      typeof (w as Record<string, unknown>).name === 'string' &&
      Array.isArray((w as Record<string, unknown>).entries)
    )
  } catch {
    return []
  }
})

// ─── IPC: 컨텐츠 검색 (content:/regex: 연산자) ────────────
const ALLOWED_AGENT_TYPES = new Set(['claude', 'opencode'])

ipcMain.handle('sessions:searchContent', async (_event, query: string, isRegex: boolean, agentType: string) => {
  if (!query || typeof query !== 'string') return []
  if (typeof agentType !== 'string' || !ALLOWED_AGENT_TYPES.has(agentType)) return []

  let pattern: RegExp
  try {
    pattern = isRegex
      ? new RegExp(query, 'i')
      : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  } catch {
    return [] // 잘못된 정규식이면 빈 결과
  }

  const matchingIds: string[] = []

  if (agentType === 'claude') {
    if (!fs.existsSync(CLAUDE_BASE)) return []
    let projectDirs: fs.Dirent[]
    try {
      projectDirs = fs.readdirSync(CLAUDE_BASE, { withFileTypes: true }).filter(d => d.isDirectory())
    } catch { return [] }

    let fileCount = 0
    for (const dir of projectDirs) {
      const dirPath = path.join(CLAUDE_BASE, dir.name)
      try {
        const files = fs.readdirSync(dirPath).filter((f: string) => f.endsWith('.jsonl') && !f.startsWith('agent-'))
        for (const file of files) {
          const filePath = path.join(dirPath, file)
          // P1-2: 경로 순회 방지 — 기존 핸들러와 동일한 보안 패턴 적용
          if (!validatePathInBase(filePath, CLAUDE_BASE)) continue
          // P1-4: 이벤트 루프 블로킹 방지 — 10파일마다 양보
          fileCount++
          if (fileCount % 10 === 0) await new Promise<void>(resolve => setImmediate(resolve))

          const sessionId = searchJSONLContent(filePath, pattern)
          if (sessionId) matchingIds.push(`${dir.name}/${sessionId}`)
        }
      } catch { /* skip */ }
    }
  }
  // OpenCode는 JSON 파일 구조가 달라 별도 처리 (현재 미지원)

  return matchingIds
})

// P2-2 수정: boolean 대신 실제 sessionId 반환 (parseClaudeSession과 동일 로직으로 ID 일치 보장)
function searchJSONLContent(filePath: string, pattern: RegExp): string | null {
  const fileName = path.basename(filePath, '.jsonl')
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    let actualSessionId: string | null = null
    let matched = false

    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const json = JSON.parse(line)
        // sessionId 캡처 — parseClaudeSession과 동일하게 덮어쓰기 방식
        if (json.sessionId) actualSessionId = json.sessionId
        if (!matched && (json.type === 'user' || json.type === 'assistant')) {
          const msgObj = json.message
          if (msgObj) {
            let text = ''
            if (typeof msgObj.content === 'string') {
              text = msgObj.content
            } else if (Array.isArray(msgObj.content)) {
              for (const item of msgObj.content) {
                if (item.type === 'text') text += item.text || ''
              }
            }
            if (text && pattern.test(text)) matched = true
          }
        }
      } catch { /* skip */ }
    }

    if (matched) return actualSessionId || fileName
  } catch { /* skip */ }
  return null
}

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
    // /vault/{path} PUT은 마크다운 본문, 나머지(/search 등)는 JSON
    const isVaultWrite = method === 'PUT' && url.pathname.startsWith('/vault/')
    const bodyBuf = body ? Buffer.from(body, 'utf-8') : undefined
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      rejectUnauthorized: false,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        ...(bodyBuf ? {
          'Content-Type': isVaultWrite ? 'text/markdown; charset=utf-8' : 'application/json',
          'Content-Length': bodyBuf.length,
        } : {}),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => {
        const status = res.statusCode || 0
        resolve({ ok: status >= 200 && status < 300, status, data })
      })
    })
    req.on('error', () => resolve({ ok: false, status: 0, data: '' }))
    if (bodyBuf) req.write(bodyBuf)
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

// ─── IPC: 프로젝트 노트 Upsert (Step 1) ───────────────────
// 정책: CmdTrace → Obsidian 단방향 write. frontmatter의 cmdtrace_* 필드와
// 마커 섹션(<!-- cmdtrace:sessions:start ... end -->)만 관리.
// 사용자가 쓴 본문·프론트매터의 다른 필드는 절대 건드리지 않음.

const OBSIDIAN_BASE_DIR = '70. Outputs/74. Projects'
// 실제 볼트 폴더 구조: inProgress/ · completed/ · archived/
const STATUS_FOLDER: Record<string, string> = {
  active:    'inProgress',
  completed: 'completed',
  archived:  'archived',
}
// Project Notes 뷰가 필터링에 쓰는 status 값 (폴더명과 동일)
const STATUS_VAULT_LABEL: Record<string, string> = {
  active:    'inProgress',
  completed: 'completed',
  archived:  'archived',
}
const SESSION_MARK_START = '<!-- cmdtrace:sessions:start -->'
const SESSION_MARK_END   = '<!-- cmdtrace:sessions:end -->'

interface UpsertPayload {
  id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  sessionCount: number
  recentSessions: { id: string; title: string; lastActivity: string }[]
  previousNotePath?: string  // 이전에 저장된 노트 경로 (이동 감지용)
}

function obsidianNotePath(projectName: string, status: UpsertPayload['status']): string {
  const folder = STATUS_FOLDER[status] || 'inProgress'
  const safeName = projectName.replace(/[\\/:*?"<>|]/g, '_')
  return `${OBSIDIAN_BASE_DIR}/${folder}/🔖 ${safeName}.md`
}

function buildFrontmatter(existing: string | null, payload: UpsertPayload): string {
  // 볼트의 Project Notes 뷰 호환 frontmatter 생성/업데이트.
  // - 신규: type/CMDS/index/tags 등 볼트 필수 필드를 모두 넣음
  // - 기존: 사용자 편집 필드는 보존, 동기화 관리 필드만 덮어쓰기 (+ 누락된 필수 필드 append)
  const now = new Date().toISOString()
  const today = now.slice(0, 10) // YYYY-MM-DD
  const vaultStatus = STATUS_VAULT_LABEL[payload.status] || 'inProgress'

  // 매 sync마다 덮어쓰는 관리 필드 (스칼라만)
  const managed: Record<string, string> = {
    'cmdtrace_id':     payload.id,
    'cmdtrace_url':    `cmdtrace://project/${payload.id}`,
    'cmdtrace_status': payload.status,
    'session_count':   String(payload.sessionCount),
    'last_synced':     now,
    'status':          vaultStatus,
    'date modified':   today,
  }

  if (!existing) {
    // 신규 노트: Project Notes 뷰가 요구하는 필드를 모두 포함
    const lines = ['---']
    lines.push('type: project')
    lines.push(`cmdtrace_id: ${managed.cmdtrace_id}`)
    lines.push(`cmdtrace_url: ${managed.cmdtrace_url}`)
    lines.push(`cmdtrace_status: ${managed.cmdtrace_status}`)
    lines.push('CMDS: "[[📚 830 Projects]]"')
    lines.push('index: "[[🏷 Project Notes]]"')
    if (payload.description) {
      lines.push(`description: ${JSON.stringify(payload.description)}`)
    }
    lines.push(`status: ${managed.status}`)
    lines.push(`session_count: ${managed.session_count}`)
    lines.push(`date created: ${today}`)
    lines.push(`date modified: ${managed['date modified']}`)
    lines.push(`last_synced: ${managed.last_synced}`)
    lines.push('tags:')
    lines.push('  - project')
    lines.push('---')
    return lines.join('\n')
  }

  // 기존 노트: 관리 필드만 업데이트, 나머지는 그대로 유지
  const body = existing.replace(/^---\n|\n---$/g, '')
  const lines = body.split('\n')
  const out: string[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    // 들여쓴 라인(리스트 항목 등)은 그대로 유지
    if (/^\s/.test(line)) {
      out.push(line)
      continue
    }
    // 키 추출 — 키에 공백 허용 ("date modified")
    const m = line.match(/^([\w][\w -]*?):\s*(.*)$/)
    if (!m) {
      out.push(line)
      continue
    }
    const key = m[1]
    if (managed[key] !== undefined) {
      out.push(`${key}: ${managed[key]}`)
      seen.add(key)
    } else {
      out.push(line)
    }
  }

  // 누락된 관리 필드 추가 (기존 노트에 cmdtrace_* 가 아직 없는 경우 최초 동기화)
  for (const [k, v] of Object.entries(managed)) {
    if (!seen.has(k)) out.push(`${k}: ${v}`)
  }
  // Project Notes 뷰 필수 필드가 누락돼 있으면 추가
  if (!/^type:/m.test(out.join('\n'))) out.push('type: project')
  if (!/^CMDS:/m.test(out.join('\n'))) out.push('CMDS: "[[📚 830 Projects]]"')
  if (!/^index:/m.test(out.join('\n'))) out.push('index: "[[🏷 Project Notes]]"')

  return `---\n${out.join('\n')}\n---`
}

function buildSessionSection(payload: UpsertPayload, vaultName: string): string {
  const lines: string[] = []
  lines.push(SESSION_MARK_START)
  lines.push('## CmdTrace 세션')
  lines.push('')
  lines.push(`> 전체 ${payload.sessionCount}개 · [CmdTrace에서 열기](cmdtrace://project/${payload.id})`)
  lines.push('')
  if (payload.recentSessions.length === 0) {
    lines.push('_아직 연결된 세션이 없습니다._')
  } else {
    lines.push('**최근 세션**')
    for (const s of payload.recentSessions.slice(0, 5)) {
      const when = s.lastActivity ? s.lastActivity.slice(0, 10) : ''
      const title = s.title.replace(/\n/g, ' ').slice(0, 80)
      lines.push(`- [${title}](cmdtrace://session/${encodeURIComponent(s.id)}) · ${when}`)
    }
  }
  lines.push('')
  lines.push(`<sub>이 섹션은 CmdTrace가 자동 관리합니다. 편집 시 다음 동기화 때 덮어써집니다. Vault: ${vaultName || '-'}</sub>`)
  lines.push(SESSION_MARK_END)
  return lines.join('\n')
}

function splitFrontmatter(content: string): { frontmatter: string | null; body: string } {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { frontmatter: null, body: content }
  return { frontmatter: `---\n${m[1]}\n---`, body: m[2] }
}

function upsertMarkerSection(body: string, section: string): string {
  const startIdx = body.indexOf(SESSION_MARK_START)
  const endIdx   = body.indexOf(SESSION_MARK_END)
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = body.slice(0, startIdx)
    const after  = body.slice(endIdx + SESSION_MARK_END.length)
    return `${before}${section}${after}`
  }
  // 마커 없음 → 본문 끝에 추가 (사용자 본문은 보존)
  const sep = body.trim() ? '\n\n' : ''
  return `${body.trimEnd()}${sep}\n\n${section}\n`
}

// ─── IPC: 프로젝트 노트 Import 후보 스캔 (Step 2) ─────────
// 74. Projects/{inProgress|done|archive}/ 아래 .md 파일을 나열하고
// frontmatter에 cmdtrace_id 가 없는 것을 후보로 반환.

interface ImportCandidate {
  path: string
  name: string
  status: 'active' | 'completed' | 'archived'
  description?: string
  hasCmdtraceId: boolean
}

function parseFrontmatterFields(content: string): Record<string, string> {
  const m = content.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/)
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

function folderToStatus(folder: string): 'active' | 'completed' | 'archived' {
  if (folder === 'done') return 'completed'
  if (folder === 'archive') return 'archived'
  return 'active'
}

function extractNameFromFile(filename: string): string {
  return filename
    .replace(/\.md$/i, '')
    .replace(/^🔖\s*/, '')
    .trim()
}

ipcMain.handle('obsidian:scanImportCandidates', async () => {
  const config = loadObsidianConfig()
  if (!config) return { ok: false, error: 'Obsidian 연동이 설정되지 않았습니다.' }

  const folders = ['inProgress', 'done', 'archive']
  const candidates: ImportCandidate[] = []

  try {
    for (const folder of folders) {
      const listPath = `/vault/${encodeURI(OBSIDIAN_BASE_DIR + '/' + folder)}/`
      const listRes = await obsidianRequest(config, 'GET', listPath)
      if (!listRes.ok) continue
      let parsed: { files?: string[] }
      try { parsed = JSON.parse(listRes.data) } catch { continue }
      const files = Array.isArray(parsed.files) ? parsed.files : []

      for (const file of files) {
        if (!file.endsWith('.md')) continue
        const fullPath = `${OBSIDIAN_BASE_DIR}/${folder}/${file}`
        const readRes = await obsidianRequest(config, 'GET', `/vault/${encodeURI(fullPath)}`)
        if (!readRes.ok) continue

        const fm = parseFrontmatterFields(readRes.data)
        const hasId = !!fm.cmdtrace_id
        candidates.push({
          path: fullPath,
          name: extractNameFromFile(file),
          status: folderToStatus(folder),
          description: fm.description || undefined,
          hasCmdtraceId: hasId,
        })
      }
    }
    return { ok: true, candidates }
  } catch (err) {
    console.error('[obsidian:scanImportCandidates] 실패:', err)
    return { ok: false, error: '볼트 스캔 실패' }
  }
})

// 임포트 후 노트의 frontmatter에 cmdtrace_id/url 을 백필 (역방향 링크)
ipcMain.handle('obsidian:backfillCmdtraceId', async (_event, notePath: string, projectId: string) => {
  const config = loadObsidianConfig()
  if (!config) return { ok: false, error: 'not configured' }
  if (!notePath || !projectId) return { ok: false, error: 'invalid args' }
  try {
    const readRes = await obsidianRequest(config, 'GET', `/vault/${encodeURI(notePath)}`)
    if (!readRes.ok) return { ok: false, error: 'read failed' }

    const { frontmatter, body } = splitFrontmatter(readRes.data)
    const managed = {
      cmdtrace_id:  projectId,
      cmdtrace_url: `cmdtrace://project/${projectId}`,
    }

    let newFm: string
    if (!frontmatter) {
      newFm = `---\ncmdtrace_id: ${managed.cmdtrace_id}\ncmdtrace_url: ${managed.cmdtrace_url}\n---`
    } else {
      const inner = frontmatter.replace(/^---\n|\n---$/g, '')
      const lines = inner.split('\n')
      const seen = new Set<string>()
      const out: string[] = []
      for (const line of lines) {
        const m = line.match(/^([\w-]+):/)
        if (m && (managed as Record<string, string>)[m[1]] !== undefined) {
          out.push(`${m[1]}: ${(managed as Record<string, string>)[m[1]]}`)
          seen.add(m[1])
        } else {
          out.push(line)
        }
      }
      for (const [k, v] of Object.entries(managed)) {
        if (!seen.has(k)) out.push(`${k}: ${v}`)
      }
      newFm = `---\n${out.join('\n')}\n---`
    }

    const final = `${newFm}\n${body.startsWith('\n') ? body.slice(1) : body}`
    const putRes = await obsidianRequest(config, 'PUT', `/vault/${encodeURI(notePath)}`, final)
    if (!putRes.ok && putRes.status !== 204) return { ok: false, error: `write failed ${putRes.status}` }
    return { ok: true }
  } catch (err) {
    console.error('[obsidian:backfillCmdtraceId] 실패:', err)
    return { ok: false, error: 'backfill failed' }
  }
})

ipcMain.handle('obsidian:upsertProjectNote', async (_event, payload: UpsertPayload) => {
  const config = loadObsidianConfig()
  if (!config) {
    return { ok: false, error: 'Obsidian 연동이 설정되지 않았습니다.' }
  }
  if (!payload?.id || !payload?.name) {
    return { ok: false, error: 'invalid payload' }
  }

  const targetPath = obsidianNotePath(payload.name, payload.status)

  try {
    // 1. 기존 노트 읽기 (없으면 신규 생성)
    const readRes = await obsidianRequest(config, 'GET', `/vault/${encodeURI(targetPath)}`)
    const existing = readRes.ok ? readRes.data : null

    // 2. frontmatter + body 분리
    const { frontmatter, body } = existing
      ? splitFrontmatter(existing)
      : { frontmatter: null, body: `# 🔖 ${payload.name}\n\n${payload.description || ''}\n` }

    // 3. frontmatter 업데이트 + 마커 섹션 upsert
    const newFrontmatter = buildFrontmatter(frontmatter, payload)
    const section = buildSessionSection(payload, config.vaultName)
    const newBody = upsertMarkerSection(body, section)
    const final = `${newFrontmatter}\n${newBody.startsWith('\n') ? newBody.slice(1) : newBody}`

    // 4. 쓰기 (REST API는 PUT으로 upsert, 성공 시 204 No Content)
    const putRes = await obsidianRequest(config, 'PUT', `/vault/${encodeURI(targetPath)}`, final)
    if (!putRes.ok) {
      return { ok: false, error: `쓰기 실패 (status ${putRes.status})` }
    }

    // 5. 상태 변경으로 폴더가 바뀌었으면 이전 노트 삭제 (선택, previousNotePath 있을 때만)
    if (payload.previousNotePath && payload.previousNotePath !== targetPath) {
      await obsidianRequest(config, 'DELETE', `/vault/${encodeURI(payload.previousNotePath)}`)
    }

    return { ok: true, path: targetPath }
  } catch (err) {
    console.error('[obsidian:upsertProjectNote] 실패:', err)
    return { ok: false, error: '노트 upsert 실패' }
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

// ─── IPC: AI 요약 ──────────────────────────────────────────
const ALLOWED_PROVIDERS = new Set(['anthropic', 'openai'])

ipcMain.handle('session:summarize', async (
  _event,
  messages: { role: string; content: string }[],
  provider: string,
  apiKey: string
) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: '요약할 메시지가 없습니다.' }
  }
  // P1-2: 배열 크기 상한 — 대형 IPC 페이로드 방지
  if (messages.length > 500) {
    return { ok: false, error: '메시지 수가 너무 많습니다 (최대 500개).' }
  }
  if (typeof provider !== 'string' || !ALLOWED_PROVIDERS.has(provider)) {
    return { ok: false, error: '지원하지 않는 AI 제공자입니다.' }
  }
  if (typeof apiKey !== 'string' || apiKey.trim().length < 20) {
    return { ok: false, error: 'API 키가 너무 짧습니다.' }
  }
  // P2-1: API 키 prefix 검증
  const trimmedKey = apiKey.trim()
  if (provider === 'anthropic' && !trimmedKey.startsWith('sk-ant-')) {
    return { ok: false, error: 'Anthropic API 키 형식이 잘못되었습니다 (sk-ant- 로 시작해야 합니다).' }
  }
  if (provider === 'openai' && !trimmedKey.startsWith('sk-')) {
    return { ok: false, error: 'OpenAI API 키 형식이 잘못되었습니다 (sk- 로 시작해야 합니다).' }
  }

  // 메시지를 텍스트로 변환 (과도한 컨텍스트 방지 — 최대 6000자)
  let transcript = ''
  for (const msg of messages) {
    if (typeof msg.role !== 'string' || typeof msg.content !== 'string') continue
    const role = msg.role === 'user' ? '[사용자]' : '[AI]'
    const snippet = msg.content.replace(/\n+/g, ' ').slice(0, 500)
    transcript += `${role}: ${snippet}\n`
    if (transcript.length > 6000) { transcript += '...'; break }
  }

  const systemPrompt = 'You are a concise technical summarizer. Summarize the AI coding session in Korean. Provide 3-5 bullet points covering: what was accomplished, key technical decisions, and any open issues. Be direct and specific.'
  const userPrompt = `다음 AI 코딩 세션을 한국어로 3~5개 불릿 포인트로 요약해주세요:\n\n${transcript}`

  if (provider === 'anthropic') return callAnthropicAPI(apiKey.trim(), systemPrompt, userPrompt)
  return callOpenAIAPI(apiKey.trim(), systemPrompt, userPrompt)
})

function callAnthropicAPI(apiKey: string, system: string, user: string): Promise<{ ok: boolean; summary?: string; error?: string }> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: user }],
    })
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => {
        // P2-2: HTTP 상태코드 먼저 확인
        if (res.statusCode && res.statusCode >= 400) {
          try {
            const json = JSON.parse(data)
            return resolve({ ok: false, error: json.error?.message || `HTTP ${res.statusCode}` })
          } catch { return resolve({ ok: false, error: `HTTP ${res.statusCode}` }) }
        }
        try {
          const json = JSON.parse(data)
          if (json.content?.[0]?.text) return resolve({ ok: true, summary: json.content[0].text })
          if (json.error) return resolve({ ok: false, error: json.error.message || 'Anthropic API 오류' })
          resolve({ ok: false, error: '예상치 못한 응답 형식' })
        } catch { resolve({ ok: false, error: '응답 파싱 실패' }) }
      })
    })
    req.on('error', (err: Error) => resolve({ ok: false, error: err.message }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '요청 시간 초과 (30s)' }) })
    req.write(body)
    req.end()
  })
}

function callOpenAIAPI(apiKey: string, system: string, user: string): Promise<{ ok: boolean; summary?: string; error?: string }> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => {
        // P2-2: HTTP 상태코드 먼저 확인
        if (res.statusCode && res.statusCode >= 400) {
          try {
            const json = JSON.parse(data)
            return resolve({ ok: false, error: json.error?.message || `HTTP ${res.statusCode}` })
          } catch { return resolve({ ok: false, error: `HTTP ${res.statusCode}` }) }
        }
        try {
          const json = JSON.parse(data)
          if (json.choices?.[0]?.message?.content) return resolve({ ok: true, summary: json.choices[0].message.content })
          if (json.error) return resolve({ ok: false, error: json.error.message || 'OpenAI API 오류' })
          resolve({ ok: false, error: '예상치 못한 응답 형식' })
        } catch { resolve({ ok: false, error: '응답 파싱 실패' }) }
      })
    })
    req.on('error', (err: Error) => resolve({ ok: false, error: err.message }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '요청 시간 초과 (30s)' }) })
    req.write(body)
    req.end()
  })
}

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

// ─── 파일 감시 (새 세션 자동 감지) ───────────────────────
// Windows 전용 — recursive 옵션은 macOS/Windows만 지원 (Linux 미지원)
let fileWatcher: fs.FSWatcher | null = null

function setupFileWatcher(win: BrowserWindow) {
  if (!fs.existsSync(CLAUDE_BASE)) return

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  try {
    fileWatcher = fs.watch(CLAUDE_BASE, { recursive: true }, (_eventType: string, filename: string | null) => {
      if (!filename || !filename.endsWith('.jsonl')) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (!win.isDestroyed()) win.webContents.send('sessions:changed')
      }, 1500) // 1.5s 디바운스 — 여러 파일 동시 변경 시 한 번만 알림
    })
  } catch (err) {
    console.error('[filewatch] 감시 설정 실패:', err)
  }
}

// P1-1: 앱 종료 시 watcher 정리 (파일 디스크립터 누수 방지)
app.on('before-quit', () => {
  if (fileWatcher) {
    try { fileWatcher.close() } catch { /* ignore */ }
    fileWatcher = null
  }
})

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

  // 파일 감시 시작 — 새 세션 생성 시 renderer에 sessions:changed 전송
  if (mainWindow) setupFileWatcher(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
