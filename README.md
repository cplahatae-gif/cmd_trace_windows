# CmdTrace Windows

<!-- PROJECT-INTRO:START -->

## 프로젝트가 중요한 이유

AI 코딩 도구는 빠르게 답을 만들지만, 시간이 지나면 어떤 명령을 실행했고 어떤 대화가 중요한 전환점이었는지 잊기 쉽습니다. CmdTrace Windows는 AI 개발 세션을 흩어진 로그가 아니라 다시 검색하고 검토할 수 있는 작업 기록으로 바꾸는 프로젝트입니다. 개발자의 기억에 의존하던 문제 해결 과정을 데이터화해, 실수는 줄이고 재현성은 높이는 것이 목적입니다.

## 기술적으로 보여주는 것

Electron, React, TypeScript 기반의 Windows 데스크톱 앱으로 Claude Code와 OpenCode 세션을 읽고, 대화·프로젝트·태그·즐겨찾기·내보내기 흐름을 제공합니다. 원본 로그는 훼손하지 않고 별도 메타데이터로 정리하며, Obsidian 연동과 Markdown/JSON/HTML export를 통해 기록을 장기 지식 자산으로 전환합니다.

## 공개 프로젝트로서의 의미

공개 저장소로서 이 프로젝트는 AI 시대의 개발 생산성이 단순한 속도가 아니라 추적 가능성, 회고 가능성, 책임 있는 기록 문화 위에서 커져야 한다는 메시지를 담고 있습니다.

<!-- PROJECT-INTRO:END -->


Windows desktop app for finding, organizing, reviewing, and resuming AI coding
assistant sessions.

CmdTrace reads local Claude Code and OpenCode session logs, turns them into a
searchable workspace, and lets you jump back into useful conversations from a
desktop UI.

## What It Does

- Loads Claude Code sessions from `%USERPROFILE%\.claude\projects`
- Loads OpenCode sessions from the local OpenCode message store
- Shows session lists, full conversation history, and usage insights
- Supports search, tags, favorites, pins, deleted-session view, and project grouping
- Resumes selected sessions in Windows Terminal, PowerShell, or Command Prompt
- Exports sessions as Markdown, JSON, or HTML
- Maintains app metadata separately from the original assistant logs
- Integrates with Obsidian notes through managed `cmdtrace_*` frontmatter and
  a marked session section

## Current Status

| Item | Status |
| --- | --- |
| Platform | Windows desktop |
| App type | Electron + React |
| Main branch | `main` |
| Version | `1.0.0` |
| Primary users | Developers using CLI-based AI coding assistants |

## Tech Stack

- Electron 33
- React 18
- TypeScript 5
- Vite 5
- Tailwind CSS 3
- Recharts
- electron-builder

## Requirements

- Windows 10 or Windows 11
- Node.js 20 or newer for development
- Claude Code or OpenCode used at least once so local session logs exist

## Run Locally

```bash
npm install
npm run electron:dev
```

## Build

```bash
npm run build
npm run package
```

The packaged Windows installer is written under `release/`.

## Search Operators

| Operator | Example | Description |
| --- | --- | --- |
| `tag:` | `tag:backend` | Filter by tag |
| `project:` | `project:api` | Filter by project name |
| `is:` | `is:favorited` | Show favorited or pinned sessions |
| `date:` | `date:2026-01-15` | Filter by exact date |

Operators can be combined, for example `tag:backend is:favorited`.

## Local Data

CmdTrace treats original assistant logs as read-only. Its own metadata is stored
under the user profile:

| File | Purpose |
| --- | --- |
| `%USERPROFILE%\.claude\cmdtrace-meta.json` | Session names, tags, favorites, pins |
| `%USERPROFILE%\.claude\cmdtrace-settings.json` | App settings |
| `%USERPROFILE%\.claude\cmdtrace-projects.json` | Project definitions |

## Notes

- This app is intended for local developer productivity.
- It may display sensitive content already present in local AI assistant logs.
- Review exports before sharing them outside your machine.

## License

Copyright (c) 2025 CMDSPACE. All Rights Reserved.

See [LICENSE](LICENSE) for details.
