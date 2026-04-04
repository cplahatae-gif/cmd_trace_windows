# Code Review Report - CmdTrace-Windows

**Analysis Date**: 2026-04-04
**Analyzer**: bkit-code-analyzer (Opus 4.6)

---

## Summary

| Metric | Value |
|--------|-------|
| Files reviewed | 11 (2 Electron + 8 React/TS + 1 CSS) |
| Total lines | ~950 |
| Issues found | **19** (Critical: 4, Important: 8, Medium: 7) |
| Filtered (low confidence) | 3 |
| **Quality Score** | **52/100** |

**Score breakdown**:
- Code Quality (구조/가독성): 17/25 -- 적절한 파일 크기, 일관된 네이밍, 일부 인라인 컴포넌트
- Security (보안): 6/25 -- 명령어 인젝션, 경로 검증 미비, IPC 입력 미검증
- Performance (성능): 15/20 -- 동기 파일 I/O, useMemo 미사용
- Reliability (안정성): 8/15 -- 에러 핸들링 다수 누락
- Type Safety (타입 안전): 6/15 -- 메인/렌더러 타입 불일치, 미사용 의존성

---

## Critical Issues (즉시 수정 필요)

### C-1. [Critical] (confidence: 95%) `electron/main.ts:82-93` -- 명령어 인젝션 취약점

`session:resume` 핸들러에서 `sessionId`와 `projectPath`를 검증 없이 쉘 명령어에 직접 삽입한다.

```typescript
// 현재 코드
const resumeCmd = bypass
  ? `claude -r ${sessionId} --dangerously-skip-permissions`
  : `claude -r ${sessionId}`
const cdCmd = projectPath ? `cd /d "${projectPath}" && ` : ''
const fullCmd = `${cdCmd}${resumeCmd}`
// ...
spawn('cmd', ['/c', 'start', 'cmd', '/k', fullCmd], { detached: true, shell: true })
```

`sessionId`에 `; rm -rf /` 또는 `& net user hacker /add` 등을 주입하면 임의 명령어가 실행된다. `projectPath`도 `"` 문자로 이스케이프를 깨뜨릴 수 있다. `shell: true`와 문자열 연결 조합은 최고 위험 패턴이다.

**Fix**: sessionId는 UUID 패턴(`/^[a-f0-9-]+$/`)으로 화이트리스트 검증하고, projectPath는 `path.resolve()` 후 허용 디렉토리 프리픽스 확인. cmd default 케이스에서 `shell: true` 제거하고 인자 배열로 전달.

```typescript
const SESSION_ID_REGEX = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
if (!SESSION_ID_REGEX.test(sessionId)) {
  return { success: false, error: 'Invalid session ID' }
}
const resolvedPath = path.resolve(projectPath)
if (!resolvedPath.startsWith(os.homedir())) {
  return { success: false, error: 'Invalid project path' }
}
```

---

### C-2. [Critical] (confidence: 92%) `electron/main.ts:148-150` -- shell:openFolder 경로 검증 없음

```typescript
ipcMain.handle('shell:openFolder', async (_event, folderPath: string) => {
  shell.openPath(folderPath)
})
```

렌더러에서 전달된 임의 경로를 검증 없이 `shell.openPath`에 전달한다. 악의적 렌더러 스크립트(XSS 등)가 시스템 임의 경로를 열 수 있다. `.exe` 파일 경로를 전달하면 실행될 수 있다.

**Fix**: 경로가 실제 디렉토리인지 확인하고, 허용 범위를 `os.homedir()` 하위로 제한.

```typescript
ipcMain.handle('shell:openFolder', async (_event, folderPath: string) => {
  const resolved = path.resolve(folderPath)
  if (!resolved.startsWith(os.homedir())) {
    return { error: 'Access denied' }
  }
  try {
    const stat = fs.statSync(resolved)
    if (!stat.isDirectory()) return { error: 'Not a directory' }
  } catch {
    return { error: 'Path not found' }
  }
  shell.openPath(resolved)
})
```

---

### C-3. [Critical] (confidence: 90%) `electron/main.ts:66-70` -- OpenCode 세션에서 Claude 경로를 하드코딩 사용

```typescript
ipcMain.handle('session:messages', async (_event, projectFolder: string, fileName: string) => {
  const homeDir = os.homedir()
  const claudeBase = path.join(homeDir, '.claude', 'projects')
  const filePath = path.join(claudeBase, projectFolder, fileName)
  return loadClaudeMessages(filePath)
})
```

`session:messages`와 `session:insights` 핸들러는 agentType을 전달받지 않고 항상 `~/.claude/projects/` 경로를 사용한다. OpenCode 세션을 선택해도 Claude 경로에서 메시지를 읽으려 시도하여 빈 결과 또는 잘못된 데이터를 반환한다.

**Fix**: `sessions:load`처럼 agentType 파라미터를 추가하거나, session 데이터에 포함된 실제 파일 경로를 직접 사용.

```typescript
ipcMain.handle('session:messages', async (_event, agentType: string, projectFolder: string, fileName: string) => {
  if (agentType === 'opencode') {
    return loadOpenCodeMessages(projectFolder, fileName)
  }
  const filePath = path.join(os.homedir(), '.claude', 'projects', projectFolder, fileName)
  return loadClaudeMessages(filePath)
})
```

---

### C-4. [Critical] (confidence: 88%) `electron/main.ts:66-78` -- 경로 순회(Path Traversal) 취약점

`session:messages`와 `session:insights` 핸들러에서 `projectFolder`와 `fileName` 파라미터를 검증하지 않는다. `../../etc/passwd` 같은 값으로 `~/.claude/projects/` 바깥의 파일을 읽을 수 있다.

```typescript
const filePath = path.join(claudeBase, projectFolder, fileName)
return loadClaudeMessages(filePath)  // 임의 파일 읽기 가능
```

**Fix**: `path.resolve()` 후 결과가 `claudeBase` 프리픽스 내에 있는지 확인.

```typescript
const filePath = path.resolve(claudeBase, projectFolder, fileName)
if (!filePath.startsWith(claudeBase)) {
  return []  // 경로 순회 차단
}
```

---

## Important Issues (수정 권장)

### I-1. [Important] (confidence: 92%) `src/App.tsx:29-49` -- loadSessions에 catch 블록 없음

```typescript
const loadSessions = useCallback(async () => {
  // ...
  try {
    const raw = await window.electronAPI.loadSessions(settings.agentType)
    // ...
  } finally {
    setIsLoading(false)
  }
}, [settings.agentType])
```

IPC 호출 실패 시 에러가 무시되고 사용자에게 빈 화면만 표시된다. `loadMetadata()` 실패도 전체 세션 로딩을 중단시킨다.

**Fix**: catch 블록을 추가하여 에러 상태를 관리하고 사용자에게 표시.

```typescript
} catch (err) {
  console.error('세션 로드 실패:', err)
  setError('세션을 불러오는 데 실패했습니다. 새로고침을 시도해주세요.')
} finally {
```

---

### I-2. [Important] (confidence: 90%) `src/components/SessionDetail.tsx:33-41` -- loadMessages/loadInsights 에러 미처리

```typescript
const loadMessages = async () => {
  // ...
  try {
    const msgs = await window.electronAPI.loadMessages(...)
    setMessages(msgs)
  } finally {
    setIsLoadingMessages(false)
  }
}
```

loadMessages와 loadInsights 모두 catch 블록이 없다. IPC 에러 시 로딩 스피너가 사라지고 빈 화면이 표시되며 사용자는 어떤 문제인지 알 수 없다.

**Fix**: 에러 상태(`loadError`) 추가하고 UI에 에러 메시지 표시.

---

### I-3. [Important] (confidence: 88%) `electron/main.ts:263-266` -- loadClaudeMessages에서 대형 파일 동기 읽기

```typescript
function loadClaudeMessages(filePath: string): MessageData[] {
  if (!fs.existsSync(filePath)) return []
  const content = fs.readFileSync(filePath, 'utf-8')  // 블로킹!
```

`loadClaudeMessages`, `loadSessionInsights`, `loadClaudeSessions`, `loadOpenCodeSessions` 모두 동기 파일 I/O(`readFileSync`)를 사용한다. JSONL 파일이 수십 MB가 될 수 있는 상황에서, IPC 핸들러가 `async`로 선언되었음에도 내부는 동기 처리이므로 메인 프로세스가 블로킹된다.

**Fix**: `fs.promises.readFile`로 전환하여 비동기 처리.

```typescript
async function loadClaudeMessages(filePath: string): Promise<MessageData[]> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    // ...
  } catch {
    return []
  }
}
```

---

### I-4. [Important] (confidence: 87%) `src/types.ts:19` vs `electron/main.ts:452` -- MessageData.role 타입 불일치

렌더러 측 `Message` 인터페이스:
```typescript
role: 'user' | 'assistant'  // union literal 타입
```

메인 프로세스 `MessageData` 인터페이스:
```typescript
role: string  // 느슨한 string 타입
```

타입이 달라서 컴파일러가 잘못된 role 값을 잡아내지 못한다. 또한 두 프로세스에서 별도 타입 정의를 유지하므로 동기화가 깨지기 쉽다.

**Fix**: `shared/types.ts`를 생성하여 양쪽에서 공유하거나, 최소한 main.ts의 `role`을 `'user' | 'assistant'`로 좁힘.

---

### I-5. [Important] (confidence: 85%) `electron/main.ts:130,135` -- spawn 에러 미처리

```typescript
spawn('wt', wtArgs, { detached: true, shell: false })
// ...
spawn('cmd', ['/c', 'start', 'cmd', '/k', fullCmd], { detached: true, shell: true })
```

`spawn` 호출 후 에러 이벤트를 처리하지 않는다. Windows Terminal이 설치되지 않은 경우, `wt` 실행이 실패하면 unhandled error로 앱이 크래시할 수 있다.

**Fix**: spawn 반환값에 `error` 이벤트 핸들러 추가.

```typescript
const proc = spawn('wt', wtArgs, { detached: true, shell: false })
proc.on('error', (err) => {
  console.error('터미널 실행 실패:', err.message)
})
proc.unref()
```

---

### I-6. [Important] (confidence: 85%) `src/components/SessionDetail.tsx:26-31` -- useEffect 의존성 배열에 loadMessages 누락

```typescript
useEffect(() => {
  setMessages([])
  setInsights(null)
  setActiveTab('messages')
  loadMessages()
}, [session.id])  // loadMessages가 의존성에 없음
```

React strict 모드에서 경고가 발생하며, `loadMessages`가 리렌더링으로 변경되면 최신 함수가 호출되지 않을 수 있다. 현재 `loadMessages`는 `useCallback`으로 감싸져 있지 않아 매 렌더마다 새로 생성된다.

**Fix**: `loadMessages`를 `useCallback`으로 감싸거나, useEffect 내에서 인라인으로 정의.

---

### I-7. [Important] (confidence: 83%) `src/components/Sidebar.tsx:15-22` -- 미사용 props (settings, onSettingsChange)

```typescript
export default function Sidebar({
  activeView, onViewChange, allTags, selectedTag, onTagSelect, sessionCount,
}: Props) {  // settings와 onSettingsChange를 구조 분해에서 제외하지만 Props에는 있음
```

Props 인터페이스에 `settings`와 `onSettingsChange`가 정의되어 있고 `App.tsx`에서 전달하지만, 실제로 사용하지 않는다. 불필요한 리렌더링을 유발한다 (settings 변경 시).

**Fix**: Props에서 `settings`와 `onSettingsChange`를 제거하고, `App.tsx`에서도 전달하지 않음.

---

### I-8. [Important] (confidence: 82%) `src/App.tsx:96` + `src/components/SessionList.tsx:136` -- groupByDate, allTags에 useMemo 없음

```typescript
// App.tsx:96
const allTags = Array.from(new Set(sessions.flatMap(s => s.tags))).sort()

// SessionList.tsx:26
const grouped = groupByDate(sessions)
```

두 값 모두 매 렌더마다 재계산된다. 세션 수가 많아지면(수백 개) 불필요한 연산이 반복된다.

**Fix**: `useMemo`로 감싸기.

```typescript
const allTags = useMemo(
  () => Array.from(new Set(sessions.flatMap(s => s.tags))).sort(),
  [sessions]
)
```

---

## Medium Issues (참고)

### M-1. (confidence: 80%) `src/App.tsx:152-291` -- Dashboard, SettingsPanel이 App.tsx에 인라인 정의

App.tsx가 292줄이며, `EmptyState`, `Dashboard`, `SettingsPanel` 3개 컴포넌트가 인라인으로 정의되어 있다. 컴포넌트 분리 기준(단일 책임)에 부합하지 않는다.

**Fix**: 각각 `components/Dashboard.tsx`, `components/SettingsPanel.tsx`로 분리.

---

### M-2. (confidence: 80%) `electron/main.ts:154` + `electron/main.ts:160` -- metaPath 상수 중복 정의

```typescript
// line 154
const metaPath = path.join(os.homedir(), '.claude', 'cmdtrace-meta.json')
// line 160
const metaPath = path.join(os.homedir(), '.claude', 'cmdtrace-meta.json')
```

동일 경로를 두 핸들러에서 각각 생성한다.

**Fix**: 파일 상단에 상수로 추출.

```typescript
const META_PATH = path.join(os.homedir(), '.claude', 'cmdtrace-meta.json')
```

---

### M-3. (confidence: 80%) `package.json` -- cross-env, wait-on이 devDependencies에 있지만 cross-env 실제 누락 확인 필요

`electron:dev` 스크립트가 `cross-env`를 사용하지만, devDependencies에 `cross-env`가 명시되어 있지 않다. `concurrently`와 `wait-on`은 있다. 새 환경에서 `npm install` 후 `npm run electron:dev`가 실패할 수 있다.

**Fix**: `npm install --save-dev cross-env` 실행.

---

### M-4. (confidence: 80%) `package.json:23` -- react-router-dom 미사용 의존성

`react-router-dom`이 dependencies에 포함되어 있지만, 프로젝트 전체에서 import 하는 코드가 없다. 상태 기반 라우팅(`activeView`)을 사용 중이다.

**Fix**: `npm uninstall react-router-dom` 또는 향후 라우팅 전환 시 활용.

---

### M-5. (confidence: 80%) `electron/main.ts:403` -- OpenCode 파일 파싱에 try 블록 내 readFileSync

```typescript
for (const file of files) {
  const json = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf-8'))
```

개별 파일 파싱 실패가 전체 세션 디렉토리를 건너뛰게 한다. 외부 try-catch가 있지만, 정상 파일까지 모두 무시된다.

**Fix**: 개별 파일별로 try-catch 적용.

---

### M-6. (confidence: 80%) `electron/main.ts:437-470` -- 타입 정의가 main.ts 파일 하단에 인라인

`SessionData`, `MessageData`, `InsightsData` 인터페이스가 483줄짜리 main.ts 파일 하단에 정의되어 있다. 렌더러 측 `types.ts`와 별도로 관리되어 불일치 위험이 높다.

**Fix**: `shared/types.ts` 또는 `electron/types.ts`로 분리하고 양측에서 공유.

---

### M-7. (confidence: 80%) `src/components/MessageView.tsx:27` -- key로 배열 인덱스 사용

```typescript
{messages.map((msg, idx) => (
  <MessageBubble key={idx} message={msg} />
))}
```

메시지가 추가/삭제될 때 React 재조정 성능이 저하된다. 현재는 읽기 전용이라 기능 문제는 없지만, 메시지에 고유 ID가 없다면 `${msg.timestamp}-${idx}` 등의 복합키 사용이 바람직하다.

**Fix**: 안정적인 고유키 생성.

```typescript
<MessageBubble key={`${msg.timestamp || ''}-${idx}`} message={msg} />
```

---

## Architecture Assessment

### 긍정적 측면
- **contextIsolation + preload 패턴**: Electron 보안 모범 사례를 준수 (`nodeIntegration: false`, `contextIsolation: true`)
- **컴포넌트 분리**: 주요 UI가 합리적으로 분리됨 (Sidebar, SessionList, SessionDetail, MessageView, InsightsView)
- **타입스크립트 사용**: strict 모드 활성화
- **JSONL 파서**: 라인별 try-catch로 부분 파싱 실패에 강건

### 개선 필요 사항
- **IPC 입력 검증 레이어 부재**: 모든 IPC 핸들러가 입력을 신뢰함 -- 검증 미들웨어 패턴 필요
- **공유 타입 없음**: main/renderer 간 타입이 독립적으로 정의됨
- **에러 전파 전략 부재**: catch 블록 없이 finally만 사용하는 패턴이 반복됨
- **상태 관리**: 단순 useState로 충분한 규모이나, metadata 동기화 로직이 App.tsx에 과도하게 집중

---

## Recommendations (수정 우선순위)

| 우선순위 | 이슈 | 예상 작업량 | 영향도 |
|---------|------|-----------|-------|
| **1** | C-1: 명령어 인젝션 수정 | 30분 | 보안 취약점 제거 |
| **2** | C-4: 경로 순회 수정 | 20분 | 보안 취약점 제거 |
| **3** | C-2: openFolder 경로 검증 | 15분 | 보안 취약점 제거 |
| **4** | C-3: OpenCode 메시지 경로 버그 | 30분 | 기능 버그 수정 |
| **5** | I-1 + I-2: 에러 핸들링 추가 | 30분 | UX 안정성 향상 |
| **6** | I-5: spawn 에러 핸들링 | 10분 | 크래시 방지 |
| **7** | I-3: 비동기 파일 I/O 전환 | 45분 | 메인 프로세스 응답성 |
| **8** | I-4 + M-6: 공유 타입 시스템 | 30분 | 유지보수성 향상 |
| **9** | I-6 + I-8: React 최적화 | 20분 | 성능/경고 제거 |
| **10** | M-1~M-5: 코드 구조 정리 | 40분 | 코드 품질 |

---

## IPC 입력 검증 유틸리티 제안

모든 IPC 핸들러에 적용할 수 있는 검증 유틸리티를 파일 상단에 추가하면 C-1 ~ C-4를 체계적으로 해결할 수 있다.

```typescript
// electron/validation.ts
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

const UUID_REGEX = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9._-]+$/

export function validateSessionId(id: string): boolean {
  return UUID_REGEX.test(id)
}

export function validatePathSegment(segment: string): boolean {
  return SAFE_PATH_SEGMENT.test(segment) && !segment.includes('..')
}

export function resolveSafePath(base: string, ...segments: string[]): string | null {
  const resolved = path.resolve(base, ...segments)
  if (!resolved.startsWith(path.resolve(base))) return null
  return resolved
}

export function validateDirectory(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory()
  } catch {
    return false
  }
}
```

---

## Deployment Decision

**BLOCKED** -- Critical 이슈 4건이 모두 보안 관련이며, 특히 C-1(명령어 인젝션)과 C-4(경로 순회)는 즉시 수정이 필요하다. 보안 이슈 수정 전까지 배포를 보류해야 한다.
