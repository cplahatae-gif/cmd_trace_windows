# CmdTrace Windows

<!-- PUBLIC-PURPOSE-INTRO:START -->

## 왜 이 프로젝트가 중요한가

명령 실행 기록은 개발자의 기억을 보완하는 가장 정직한 로그입니다. 이 프로젝트는 Windows 환경에서도 작업 흐름을 추적하고 재현할 수 있게 만들어, 문제 해결과 자동화 실험을 더 투명하게 만드는 것을 목표로 합니다.

## 기술적으로 무엇을 보여주는가

Swift 및 데스크톱 구성 요소를 활용해 명령 실행, 상태 기록, 추적 UI를 구성합니다. 핵심 가치는 실행 맥락을 구조화하고, 디버깅과 회고에 필요한 증거를 남기는 것입니다.

## 공개 저장소로서의 의미

작업 기록을 잘 남기는 도구는 개인 생산성뿐 아니라 팀 단위 협업, 보안 감사, 장애 원인 분석의 기반이 됩니다.

<!-- PUBLIC-PURPOSE-INTRO:END -->


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
