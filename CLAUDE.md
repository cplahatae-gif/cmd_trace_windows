# CmdTrace Windows

Windows port of CmdTrace — AI CLI session viewer built with Electron + React + TypeScript.

## Project Overview

CmdTrace Windows reads Claude Code and OpenCode JSONL conversation logs and provides a rich interface for browsing, organizing, and analyzing coding sessions. This is a Windows port of the original macOS SwiftUI app, reimplemented from scratch using Electron.

## Tech Stack

- **Runtime**: Electron 33
- **UI**: React 18 + TypeScript 5
- **Styling**: Tailwind CSS 3 (light theme, Pretendard font)
- **Build**: Vite 5 (renderer) + tsc (Electron main)
- **Charts**: Recharts 2
- **Icons**: Lucide React
- **Date**: date-fns 4 (Korean locale)
- **Packaging**: electron-builder (NSIS installer)

## Project Structure

```
cmdtrace-windows/
├── electron/
│   ├── main.ts        ← IPC handlers, session parsing, security utils, tray
│   └── preload.ts     ← contextBridge API (electronAPI)
├── src/
│   ├── App.tsx        ← Global state, routing, search operators
│   ├── types.ts       ← Shared TypeScript types
│   ├── hooks/
│   │   └── useDarkMode.ts        ← Dark mode toggle + persistence
│   └── components/
│       ├── TitleBar.tsx           ← Frameless window title bar
│       ├── Sidebar.tsx            ← Nav icons + tag filter (w-16)
│       ├── SessionList.tsx        ← Session list + search + date groups (w-80)
│       ├── SessionDetail.tsx      ← Detail header + tabs (대화/인사이트)
│       ├── SessionDiffView.tsx    ← Session diff comparison view
│       ├── DiffPickerModal.tsx    ← Session picker for diff comparison
│       ├── MessageView.tsx        ← Chat bubble + avatar layout
│       ├── InsightsView.tsx       ← Token/tool/model usage stats
│       ├── Dashboard.tsx          ← Stats cards + 30-day chart + project pie
│       ├── SettingsPanel.tsx      ← Settings card layout
│       ├── TrashView.tsx          ← Soft-deleted sessions + restore
│       ├── ProjectsView.tsx       ← Project CRUD + drag-drop session assignment
│       ├── ProjectDetailView.tsx  ← Single project detail view
│       ├── ProjectModal.tsx       ← Create/edit project modal (8-color picker)
│       ├── ProjectStatusBadge.tsx ← Project status indicator badge
│       ├── WorkspacesView.tsx     ← Workspace snapshot list
│       ├── WorkspaceModal.tsx     ← Create/edit workspace modal
│       ├── BulkSummarizeModal.tsx ← Multi-session bulk AI summary modal
│       └── ObsidianImportModal.tsx ← Obsidian project-note import modal
├── dist/              ← Renderer build output
├── dist-electron/     ← Electron main build output
└── package.json
```

## Data Paths (Windows)

Session logs are read from:
- **Claude Code**: `%USERPROFILE%\.claude\projects\*\sessions\*.jsonl`
- **OpenCode**: `%USERPROFILE%\.local\share\opencode\storage\message\*`

App data stored in:
- `%USERPROFILE%\.claude\cmdtrace-meta.json` — session metadata (names, tags, favorites)
- `%USERPROFILE%\.claude\cmdtrace-settings.json` — app settings
- `%USERPROFILE%\.claude\cmdtrace-projects.json` — project definitions

## Build & Run

작업 디렉토리는 `C:\cmdtrace` 하나다. 이 저장소를 Google Drive 동기화 폴더 하위에 두면 Node.js가 reparse point를 `\\?\` UNC 경로로 해석해 rollup 로딩 시 `ERR_INVALID_PACKAGE_CONFIG`가 발생하므로, 로컬 경로 밖으로 옮기지 말 것.

```bash
# Install dependencies
npm install

# Development (hot reload)
npm run electron:dev

# Build renderer + electron
npm run build

# Package to NSIS installer
npm run package
```

## Architecture

### State Management (App.tsx)
Single-file state with React hooks. No external state library.
- `sessions` / `filteredSessions` — raw + filtered session list
- `metadata` — persisted session metadata (name, tags, favorites, pins, projectId, isDeleted)
- `projects` — project definitions
- `settings` — app settings (terminal, theme, agentType)
- `applyMetaUpdate()` — single helper that updates state + IPC-saves metadata atomically

### IPC Pattern (electron/main.ts ↔ preload.ts ↔ App.tsx)
All Electron IPC goes through `window.electronAPI` (contextBridge). Handlers in main.ts, exposed in preload.ts.

Key IPC channels:
- `sessions:load` — parse JSONL files from Claude/OpenCode directories
- `sessions:getActive` — detect actively-running sessions (WMI process scan)
- `sessions:searchContent` — full-text/regex search across session content
- `session:messages` — load full messages for a session
- `session:insights` — compute token/tool/model statistics
- `session:resume` — spawn Windows Terminal (wt) / PowerShell / cmd with `claude -r` / `opencode -r`
- `session:resetPanes` — reset Windows Terminal pane layout before batch restore
- `session:export` — file save dialog + write MD/JSON/HTML
- `session:summarize` — AI summary generation (Anthropic/OpenAI)
- `workspaces:load` / `workspaces:save` — read/write cmdtrace-workspaces.json
- `workspaces:restoreAll` — batch-restore a saved workspace into Windows Terminal panes
- `metadata:load` / `metadata:save` — read/write cmdtrace-meta.json
- `settings:load` / `settings:save` — read/write cmdtrace-settings.json
- `projects:load` / `projects:save` — read/write cmdtrace-projects.json
- `apiKey:save` / `apiKey:hasKey` / `apiKey:delete` — safeStorage-backed API key management
- `usage:load` — ccusage burn-rate usage data
- `obsidian:searchNote` / `obsidian:openNote` / `obsidian:testConnection` — Obsidian vault lookup/connection
- `obsidian:scanImportCandidates` / `obsidian:backfillCmdtraceId` / `obsidian:upsertProjectNote` — Obsidian project-note import/sync
- `shell:openFolder` — open project folder in Explorer

### Security
- `sanitizeSessionId()` — whitelist: `[a-zA-Z0-9_-]` only
- `validatePathInBase()` — prevents path traversal (resolves + prefix-checks)
- `isValidDirectory()` — validates directory existence
- `contextIsolation: true`, `nodeIntegration: false`

### Search Operators
Parsed in `parseSearchQuery()` in App.tsx:
- `tag:backend` — exact tag match
- `project:api` — project name substring
- `is:favorited` / `is:pinned` — boolean filters
- `date:2026-01-15` — exact date match (lastActivity)
- plain text — searches preview + project + customName + tags

### Session Resume (Windows Terminal)
Uses `wt` (Windows Terminal), `powershell`, or `cmd` based on settings.
Spawns in a new tab/pane with `claude -r <sessionId>` (or `opencode -r` for OpenCode sessions) in the project directory.
Supports `--dangerously-skip-permissions` flag via `bypassPermissions` setting.

### Workspace Snapshot
- `WorkspaceEntry` — stores sessionId, projectPath, title, order, agentType
- `Workspace` — named collection of WorkspaceEntry[], persisted to cmdtrace-workspaces.json
- Multi-select via checkboxes in SessionList (hover to reveal)
- Batch restore: `resetPanes()` + sequential `resumeSession()` loop with 300ms delay
- Restores into 2×2 Windows Terminal pane grid (5+ sessions open new tabs)

## Code Conventions

- Props interfaces declared inline above each component
- Helper functions at bottom of file (after `export default`)
- IPC handlers grouped by domain (sessions, metadata, settings, projects, workspaces)
- Security validation always before file I/O
- `applyMetaUpdate()` is the single path for any session metadata change
- Tailwind tokens: `surface.{base/soft/subtle}`, `ink.{primary/secondary/muted/faint}`, `brand.*`

## Design System

Light-only theme based on flex.team visual language:
- **Font**: Pretendard (CDN)
- **Background**: `#ffffff` (base) / `#f5f6f8` (soft) / `#eef0f4` (subtle)
- **Text**: `#1a1d23` (primary) → `#374151` → `#6b7280` → `#9ca3af` (faint)
- **Brand**: `#635bff` (indigo-purple)
- **Borders**: `rgba(0,0,0,0.08)` subtle
- **Shadows**: `shadow-card` (soft elevation), `shadow-panel` (dropdown)
- **Buttons**: `.btn-primary` (brand fill) / `.btn-secondary` (white + border)

## Roadmap

### Completed
| Feature | Status |
|---------|--------|
| Core session viewer (Claude Code + OpenCode) | ✅ |
| Security hardening (path traversal, command injection) | ✅ |
| Error handling, settings persistence, type safety | ✅ |
| Component separation, useMemo optimization | ✅ |
| Soft delete + trash recovery | ✅ |
| Flex-style light theme (Pretendard, brand colors) | ✅ |
| Text size improvements (readability) | ✅ |
| Favorites + pins (isFavorited, isPinned, pin-priority sort) | ✅ |
| Search operators (tag:, project:, is:, date:) | ✅ |
| Keyboard shortcuts (Ctrl+F, Ctrl+R, Escape) | ✅ |
| Session export (MD / JSON / HTML) | ✅ |
| Projects (CRUD, color coding, drag-drop session assignment) | ✅ |
| Dashboard charts (30-day activity, project distribution) | ✅ |
| Workspace Snapshot (multi-select, save/restore session groups) | ✅ |
| Active session detection (green dot, WMI process scan) | ✅ |
| content:/regex: full-text search operators | ✅ |
| File watch auto-refresh (fs.watch + debounce) | ✅ |
| Bulk pin/favorite (multi-select action bar) | ✅ |
| AI Summary (Anthropic/OpenAI, settings panel) | ✅ |
| Session Diff (side-by-side comparison view) | ✅ |
| Markdown rendering (remark-gfm + syntax highlighting) | ✅ |
| Workspace restore timing fix (single wt command) | ✅ |
| Dark mode CSS + 테마 전환 UI | ✅ |
| ccusage Burn Rate (7일 추세 + 30일 예상) | ✅ |
| safeStorage API 키 마이그레이션 (OS 자격증명) | ✅ |
| Bulk AI Summary (다중 세션 일괄 요약 + 영속화) | ✅ |
| Tray icon 에셋 (tray-icon.png 32x32 + icon.ico 멀티사이즈) | ✅ |
| 번들 최적화 (vendor 청크 분리, esbuild minify) | ✅ |

### Pending
| Feature | Priority |
|---------|----------|
| Built-in HTTP server (webapp dashboard) | Low |

## Version

Current: v1.0.0 (Windows port)
