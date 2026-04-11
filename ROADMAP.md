# CmdTrace Development Roadmap

## Current Version: v2.4.1

---

## Version History

### v2.4.1 (2026-02-01)
- **Architecture Refactor**: DetailView.swift (3700+ lines) → 모듈별 파일로 분리
  - `SessionHeaderView`, `InspectorPanelView`, `MessageBubbleView`, `HelperViews`, `SessionListViews`, `TagBrowserView`
- **AppState Refactor**: AppState.swift → 매니저 클래스로 분리
  - `PersistenceManager`, `ProjectManager`, `SessionFilter`, `TagManager`
- **Service Layer**: 서비스 로직 분리
  - `SummaryService`, `TerminalService`, `Utilities/`
- **Tag System Enhancement**:
  - 태그 이름 변경 + 모든 세션에 일괄 업데이트
  - 태그 시트에서 실시간 필터링
  - Tags 뷰 전용 검색바
- **UI Polish**:
  - CLI 셀렉터 Segmented 버튼 UI 개선
  - 태그 팝오버 외부 클릭 시 닫기
  - CLI 토글 순서 고정
- **Website Overhaul**: 랜딩 페이지 전면 리디자인

### v2.4.0 (2026-01-21)
- **Session Archive**: Archive/unarchive sessions, bulk archive, auto-archive old sessions
- **Bulk Operations**: Multi-select, bulk tag/archive/favorite, select all
- **Search Highlighting**: AttributedString-based highlighting in conversation
- **Cloud Sync UI**: Settings UI for iCloud sync (backend pending)
- **Projects Tab**: Project metadata management with full-width dashboard layout
- **Configuration Enhancement**: Copy, export, auto-refresh 기능 추가

### v2.3.0 (2026-01-18)
- **Search Enhancement**: `date:`, `regex:`, `messages:` operators
- **Export Sessions**: Markdown, JSON, Plain Text, HTML
- **Session Diff**: Side-by-side comparison
- **Statistics Dashboard**: 30-day activity, project/tag distribution
- **Keyboard Navigation**: ↑↓ in session list
- **Markdown Tables**: Improved rendering with auto-width
- **Inspector Reorganization**: Session Info → Summary → Actions → Details

### v2.2.0 (2026-01-16)
- **Configuration Tab**: Commands, Skills, Hooks, Agents, Plugins 뷰어
- **Session Insights**: 토큰 사용량, 예상 비용, 도구 통계
- **Used in Session**: 세션별 Commands/Skills/Hooks 사용 내역
- Global/Project 스코프 필터
- 카테고리별 도구 그룹핑 및 프로그레스 바

### v2.1.0 (2026-01-15)
- AI Summary 다중 환경 호환성 개선
- Resume 함수 통합 리팩토링
- 모든 AI Provider (Anthropic, OpenAI, Gemini, Grok) API 호환성 수정
- JSON 파싱 안정화
- 2026 추천 모델 목록 업데이트
- Tag/QuickActions/Obsidian Export 기능 개선
- 웹사이트 Gatekeeper/권한 안내 추가

### v2.0.0 (2026-01-XX)
- Native Monitoring View (ccusage 연동)
- Burn Rate Chart (Swift Charts)
- Color Customization
- DMG 빌드 스크립트
- 종합 README 및 스크린샷

### v1.0.0 (Initial Release)
- 세션 뷰어 (Claude Code, OpenCode, Antigravity)
- 검색 (content:, title:, tag:, project:, date:)
- 태그, 즐겨찾기, 핀
- Resume 기능 (Terminal, iTerm2, Warp)
- AI 요약 생성 (Anthropic, OpenAI, Gemini, Grok)
- Obsidian 내보내기
- Deep Links (cmdtrace://session/{id})

---

## Implemented Features

### Core Features
| Feature | Status | Version |
|---------|--------|---------|
| Session Viewer | ✅ Done | v1.0.0 |
| Multi-CLI Support (Claude, OpenCode, Antigravity) | ✅ Done | v1.0.0 |
| Search with Operators | ✅ Done | v1.0.0 |
| Tags & Organization | ✅ Done | v1.0.0 |
| Favorites & Pins | ✅ Done | v1.0.0 |
| Resume Session | ✅ Done | v1.0.0 |
| Deep Links | ✅ Done | v1.0.0 |
| Tag Rename with Bulk Update | ✅ Done | v2.4.1 |
| Tag Real-time Filtering | ✅ Done | v2.4.1 |

### AI Features
| Feature | Status | Version |
|---------|--------|---------|
| AI Summary Generation | ✅ Done | v1.0.0 |
| Auto Title Generation | ✅ Done | v1.0.0 |
| Multi-Provider Support | ✅ Done | v1.0.0 |
| Tag Suggestions | ✅ Done | v1.0.0 |

### Monitoring
| Feature | Status | Version |
|---------|--------|---------|
| ccusage Integration | ✅ Done | v2.0.0 |
| Native Monitoring View | ✅ Done | v2.0.0 |
| Burn Rate Chart | ✅ Done | v2.0.0 |
| Plan Limits (Pro, Max5, Max20) | ✅ Done | v2.0.0 |

### Session Analysis
| Feature | Status | Version |
|---------|--------|---------|
| Configuration Tab | ✅ Done | v2.2.0 |
| Session Insights (Token/Cost) | ✅ Done | v2.2.0 |
| Tool Usage Statistics | ✅ Done | v2.2.0 |
| Search Enhancement (date/regex/messages) | ✅ Done | v2.3.0 |
| Export (Markdown/JSON/Text/HTML) | ✅ Done | v2.3.0 |
| Session Diff | ✅ Done | v2.3.0 |
| Statistics Dashboard | ✅ Done | v2.3.0 |

### Organization
| Feature | Status | Version |
|---------|--------|---------|
| Session Archive & Bulk Ops | ✅ Done | v2.4.0 |
| Search Highlighting | ✅ Done | v2.4.0 |
| Projects Tab | ✅ Done | v2.4.0 |
| Cloud Sync UI | ⚠️ UI Only | v2.4.0 |

### Architecture
| Feature | Status | Version |
|---------|--------|---------|
| DetailView Modular Split | ✅ Done | v2.4.1 |
| AppState Manager Extraction | ✅ Done | v2.4.1 |
| Service Layer Separation | ✅ Done | v2.4.1 |

### Export
| Feature | Status | Version |
|---------|--------|---------|
| Obsidian Export | ✅ Done | v1.0.0 |
| Hookmark Integration | ✅ Done | v1.0.0 |
| Summary Download | ✅ Done | v1.0.0 |

---

## Development Roadmap

### Phase 1: Foundation (v1.0.0 ~ v2.1.0) ✅ Completed

세션 뷰어 기본 기능, AI 요약, 모니터링, 멀티 CLI 지원.

| Milestone | Description | Status |
|-----------|-------------|--------|
| v1.0.0 | Session viewer, search, tags, resume, AI summary, deep links | ✅ |
| v2.0.0 | Native monitoring, burn rate chart, ccusage integration | ✅ |
| v2.1.0 | API 호환성 수정, AI provider 안정화, resume 리팩토링 | ✅ |

### Phase 2: Session Insights (v2.2.0 ~ v2.3.0) ✅ Completed

세션 분석, 설정 뷰어, 검색 고도화, 내보내기.

| Milestone | Description | Status |
|-----------|-------------|--------|
| v2.2.0 | Configuration tab, session insights (token/cost/tools) | ✅ |
| v2.3.0 | Advanced search, export, session diff, statistics dashboard | ✅ |

### Phase 3: Organization & Architecture (v2.4.0 ~ v2.4.1) ✅ Completed

세션 정리 기능 강화, 코드 아키텍처 개선.

| Milestone | Description | Status |
|-----------|-------------|--------|
| v2.4.0 | Archive, bulk ops, search highlighting, projects tab | ✅ |
| v2.4.1 | Codebase modular refactor, tag system enhancement, website overhaul | ✅ |

### Phase 4: Obsidian Integration (v2.5.0) 🔄 In Progress

CmdTrace와 Obsidian의 역할 분리 및 양방향 연동.
- **CmdTrace** = 세션 뷰어 + 세션 그룹핑 (현재 작업 현황판)
- **Obsidian** = 프로젝트 지식 자산 (회고, 교훈, 재활용 가능한 기록)

#### Step 1: 프로젝트 간소화 + 상태 통일

| Feature | Description | Priority |
|---------|-------------|----------|
| Status Unification | `대기 중(pending)` → `완료(completed)`, Obsidian과 일치 | High |
| Remove goal/notes | CmdTrace에서 제거, Obsidian에 위임 | High |
| Add obsidianNotePath | 프로젝트에 Obsidian 노트 경로 캐시 필드 추가 | High |

#### Step 2: CmdTrace → Obsidian 링크

| Feature | Description | Priority |
|---------|-------------|----------|
| "Obsidian에서 열기" 버튼 | ProjectDetailView 헤더에 추가, `obsidian://open` 호출 | High |
| Obsidian REST API IPC | main.ts에 노트 검색/열기 IPC 핸들러 | High |

#### Step 3: Obsidian → CmdTrace 딥링크

| Feature | Description | Priority |
|---------|-------------|----------|
| Protocol Handler | `cmdtrace://project/{id}` 프로토콜 등록 | Medium |
| Deep Link Routing | App.tsx에서 딥링크 파싱 → 프로젝트 자동 선택 | Medium |
| obsidian-project-sync | 노트 생성 시 CmdTrace 딥링크 자동 삽입 | Medium |

#### Step 4: Lessons Learned 자동 기록

| Feature | Description | Priority |
|---------|-------------|----------|
| Lesson Learn 섹션 | obsidian-project-sync에 기술적 교훈 + 설계 결정 테이블 추가 | High |
| 자동 수집 | 대화 컨텍스트에서 "에러→해결" 패턴 감지, git fix: 커밋 파싱 | Medium |

#### Step 5: 프로젝트 완료 시 자동 회고

| Feature | Description | Priority |
|---------|-------------|----------|
| Retrospective Mode | `/obsidian-project-sync --retro` — 프로젝트 전체 회고 생성 | High |
| 회고 섹션 | 요약, 잘한 것, 개선할 것, 재활용 패턴, 기술 스택 평가 | High |

#### Step 6: 크로스 프로젝트 지식 검색 (장기)

| Feature | Description | Priority |
|---------|-------------|----------|
| Knowledge Search | Obsidian Dataview로 Lessons Learned 크로스 검색 | Low |

### Phase 5: Windows UX Enhancement (v2.6.0)

| Feature | Description | Priority |
|---------|-------------|----------|
| Dark Mode | ThemeType 정의됨, Tailwind CSS 구현 | Medium |
| System Tray | 트레이 아이콘 에셋 + 최소화 동작 | Medium |
| Global Hotkey | 시스템 전역 단축키로 CmdTrace 열기 | Low |
| Auto-Tagging | AI 기반 자동 태그 추천 | Low |

### Phase 6: Advanced Analytics (v3.0.0)

| Feature | Description | Priority |
|---------|-------------|----------|
| Weekly/Monthly Reports | 기간별 사용량 리포트 | Medium |
| Git Integration | 세션-커밋 연결 | Medium |
| Full-text Index | SQLite FTS 기반 빠른 콘텐츠 검색 | Medium |

---

## Backlog

| Feature | Description | Priority |
|---------|-------------|----------|
| Session Merge | Combine multiple sessions | Medium |
| VS Code Extension | Sidebar session browsing | Low |
| Notion Export | Export to Notion database | Low |

---

## Known Issues

| Issue | Description | Workaround |
|-------|-------------|------------|
| Vite Build Hang | Rollup 네이티브 바이너리가 한글 경로에서 행업 | `--outDir /c/tmp/...`로 우회 빌드 후 복사 |
| Large Sessions | Slow loading for 1000+ message sessions | Pagination planned |

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ Done | Implemented and released |
| 🔄 In Progress | Currently being developed |
| ⏳ Planned | Scheduled for development |
| ⚠️ Partial | Partially implemented |
| 💡 Idea | Under consideration |
| ❌ Cancelled | Not pursuing |

---

## Contributing

Feature requests and feedback welcome via [GitHub Issues](https://github.com/johnfkoo951/CmdTrace/issues).
