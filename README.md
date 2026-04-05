# CmdTrace Windows

<p align="center">
  <strong>Stop losing your AI conversations. Start finding them.</strong>
</p>

<p align="center">
  Windows session viewer for AI CLI coding assistants (Claude Code, OpenCode)
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#search">Search</a> •
  <a href="#keyboard-shortcuts">Shortcuts</a> •
  <a href="#data-paths">Data Paths</a>
</p>

---

## The Problem

*"I know Claude solved this before..."*

You've had 47 sessions this week. The solution is buried somewhere in conversation #23. Session IDs like `01JHHK9X2MPQR5...` tell you nothing.

```
%USERPROFILE%\.claude\projects\*\sessions\*.jsonl
127 files, 2.3GB of conversations
```

CmdTrace brings order to chaos — a Windows desktop app that understands how you work with AI coding assistants.

---

## Features

### Find Anything, Instantly

Search with operators to find exactly what you need:

```
tag:backend              # Filter by tag
project:api              # Filter by project name
is:favorited             # Show only favorited sessions
date:2026-01-15          # Sessions from specific date
```

### Organize Your Sessions

- **Custom Names** — give sessions meaningful titles
- **Tags** — organize with tags, filter from sidebar
- **Favorites & Pins** — star important sessions, pin them to the top
- **Projects** — group sessions into projects with color coding

### Session Details

- **Conversation View** — full message history with user/assistant bubbles
- **Insights Tab** — token usage, tool statistics, model breakdown
- **Export** — save as Markdown, JSON, or HTML

### Resume Instantly

One click to jump back into any session. Supports Windows Terminal (`wt`), PowerShell, and Command Prompt.

### Dashboard

- 4 summary stats (sessions, messages, projects, today's activity)
- 30-day activity bar chart
- Project distribution pie chart
- Recent activity list

---

## Installation

### Download

Download the latest installer from the [Releases](https://github.com/cplahatae-gif/cmd_trace_windows/releases) page.

Run the `.exe` installer and launch CmdTrace from the Start Menu.

### Build from Source

```bash
# Clone
git clone https://github.com/cplahatae-gif/cmd_trace_windows.git
cd cmd_trace_windows

# Install dependencies
npm install

# Development mode (hot reload)
npm run electron:dev

# Build + package installer
npm run build
npm run package
```

---

## Search

### Basic Search

Type anything to search session titles, previews, and tags.

### Search Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `tag:` | `tag:backend` | Exact tag match |
| `project:` | `project:api` | Project name (substring) |
| `is:` | `is:favorited` / `is:pinned` | Boolean filters |
| `date:` | `date:2026-01-15` | Exact date (YYYY-MM-DD) |

Combine operators: `tag:backend is:favorited`

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Focus search |
| `Ctrl+R` | Resume session in terminal |
| `Escape` | Deselect session |

---

## Data Paths

### Session Logs (Read-only)

| CLI Tool | Path |
|----------|------|
| Claude Code | `%USERPROFILE%\.claude\projects\*\sessions\*.jsonl` |
| OpenCode | `%USERPROFILE%\.local\share\opencode\storage\message\*` |

### App Data

| File | Description |
|------|-------------|
| `%USERPROFILE%\.claude\cmdtrace-meta.json` | Session names, tags, favorites |
| `%USERPROFILE%\.claude\cmdtrace-settings.json` | App settings |
| `%USERPROFILE%\.claude\cmdtrace-projects.json` | Project definitions |

---

## Settings

| Setting | Options | Default |
|---------|---------|---------|
| **CLI Tool** | Claude Code, OpenCode | Claude Code |
| **Terminal** | Windows Terminal (`wt`), PowerShell, CMD | `wt` |
| **Skip Permissions** | `--dangerously-skip-permissions` flag | Off |

---

## Tech Stack

- **Electron 33** + **React 18** + **TypeScript 5**
- **Tailwind CSS 3** — Flex-inspired light theme, Pretendard font
- **Vite 5** — fast dev/build
- **Recharts 2** — dashboard charts
- **electron-builder** — NSIS Windows installer

---

## Requirements

- **Windows 10/11** (64-bit)
- **Claude Code** or **OpenCode** installed and used at least once

---

## License

Copyright (c) 2025 CMDSPACE. All Rights Reserved.

See [LICENSE](LICENSE) for details.
