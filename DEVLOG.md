# CmdTrace Windows - 개발 로그

AI 코딩 도구(Claude Code)와 함께 진행한 CmdTrace Windows 포트 + 기능 확장 개발 기록입니다.

> **배경**: CmdTrace는 GPTers 21기 스터디장 구요한님이 만든 macOS 전용 AI CLI 세션 뷰어입니다. Windows 사용자인 제가 직접 다운받아 Electron 기반으로 포팅하고, 이후 기능을 하나씩 확장해 나갔습니다.

---

## 2026-05-03 — 워크스페이스 스냅샷 기능

### 1. PC 끄기 전 세션 묶음을 기억하고 싶다

```
예를 들어 내가 지금 pc를 끄려고 해. 근데 창이 너무 많아서 다음번에 cmdtrace에서 
띄우려면 헷갈릴거 같아. 그러면 cmdtrace에서 이 창을 기억하는 기능을 만드는거지
(예를 들어 내가 버튼을 클릭하면 현재 무슨 창을 띄었었음 / 창별 순서도 기억하고)
그리고 나서 다음번에 cmdtrace를 키면 한꺼번에 쭉 띄어주는거지.
```

**Claude Code 작업:**
- 플래닝: 기존 Projects 도메인과 동일한 아키텍처 패턴 채택
- `src/types.ts` — `WorkspaceEntry`, `Workspace` 인터페이스 추가
- `electron/main.ts` — `workspaces:save` / `workspaces:load` IPC 핸들러 + `WORKSPACES_PATH` 상수
- `electron/preload.ts` — `saveWorkspaces`, `loadWorkspaces` API 노출
- `src/components/WorkspaceModal.tsx` — 이름 입력 모달 (신규)
- `src/components/WorkspacesView.tsx` — 워크스페이스 목록, 복원/삭제/이름변경 (신규)
- `src/components/Sidebar.tsx` — 워크스페이스 nav item (`Layers` 아이콘, 배지)
- `src/components/SessionList.tsx` — 멀티셀렉트 체크박스 + 선택 시 액션바
- `src/App.tsx` — workspaces 상태, CRUD 콜백, 뷰 분기 연결

**핵심 설계 결정:**
- 배치 재개는 새 IPC 없이 React 측에서 `resetPanes()` + `resumeSession()` 루프 (300ms 딜레이)
- 기존 2×2 pane 카운터 재사용 — 4개 이하는 그리드, 5개 이상은 새 탭 자동 처리
- `filteredSessions` 대신 `activeSessions` 사용으로 검색 중 저장 시 누락 버그 수정

### 2. Codex 유니버셜 리뷰 (gstack /codex)

gstack v1.26.0.0으로 업그레이드 후 Codex exec으로 독립 리뷰 실행.

**발견된 이슈 4건 → 전부 수정:**

| 등급 | 이슈 | 수정 |
|------|------|------|
| P1 | `WorkspaceEntry`에 agentType 미저장 → OpenCode 세션 항상 `claude -r` 실행 | agentType 필드 추가, IPC 파라미터 확장 |
| P1 | 비존재 projectPath → 복원 자체 실패 | isValidDirectory 실패 시 `-d` 없이 graceful 재개 |
| P2 | `workspaces.json` 손상 시 크래시 가능 | 로드 시 id/name/entries 필드 검증 |
| P2 | 부분 복원 실패 무시 | resumeSession 반환값 확인 + 에러 배너 표시 |

**총 커밋:** 4개 (feat 1 + fix 3)  
**브랜치:** `feature/workspace-snapshot`

---

## 2026-04-04 (Day 1) — Windows 포트 + 보안 수정

### 1. CmdTrace를 Windows에서 돌리고 싶다

```
macOS 전용인 CmdTrace를 Windows에서도 쓸 수 있게 포팅해줘
```

**Claude Code 작업:**
- SwiftUI 기반 macOS 앱을 Electron 33 + React 18 + TypeScript 5 + Tailwind CSS 3으로 전체 재구현
- `electron/main.ts` — IPC 핸들러, 세션 JSONL 파싱
- `electron/preload.ts` — contextBridge API
- `src/App.tsx` — 메인 상태 관리 + 라우팅
- `src/components/` — TitleBar, Sidebar, SessionList, SessionDetail, MessageView 등 컴포넌트 분리
- `run.bat`, `CmdTrace.vbs` — 더블클릭으로 앱 실행하는 런처 생성
- 커밋: `d73f18e` feat: CmdTrace Windows 포트 초기 구현

### 2. 보안 취약점 수정

**Claude Code 작업:**
- 4건의 보안 취약점 수정 (명령어 인젝션, 경로 순회 방지)
- `sanitizeSessionId()` — 영문숫자·하이픈·언더스코어만 허용하는 화이트리스트 검증
- `validatePathInBase()` — 경로가 베이스 디렉토리 안에 있는지 검증
- 커밋: `3e91006` fix: 보안 취약점 및 버그 수정 (코드리뷰 반영)

---

## 2026-04-05 (Day 2) — 디자인 개편 + 프로젝트 관리 대시보드

### 3. 디자인이 좀 밋밋한데 개선해줘

**Claude Code 작업:**
- Flex 스타일 디자인 시스템 전면 개편 (Pretendard 폰트, subtle 보더, 라이트 레이어)
- 텍스트 크기 전반 확대 (가독성 개선)
- 컴포넌트 분리 + 세션 소프트 삭제(휴지통) 기능 구현
- 커밋: `e293953` design: Flex 스타일 디자인 시스템 전면 개편, `74a804d` refactor: 컴포넌트 분리 + 세션 소프트 삭제

### 4. 프로젝트별로 세션을 구분하고 싶어

```
프로젝트별 세션 활동 내역은 그렇게 중요하지는 않은거 같은데... 내가 원하는건 해당 프로젝트가 뭐하는지 아는게 중요하다고. 해당 프로젝트가 뭔지 요약해서 반영해주는건 불가능해? 그리고 해당 프로젝트가 어떤 단계인지 내가 정할 수 있게 칸반 형태로 만들어주는건?
```

**Claude Code 작업:**
- Projects CRUD + 8색 컬러 코딩 + 드래그&드롭 세션 배정
- 즐겨찾기/핀, 세션 내보내기 (MD/JSON/HTML)
- 검색 연산자 (tag:, project:, is:, date:)
- Dashboard 차트 (30일 활동 바차트, Recharts 프로젝트 분포 파이차트)
- 커밋: `7c57670`, `50c9927`, `6ac6d8a`

### 5. 세션에서 바로 프로젝트 등록하게 해줘

```
여기서 프로젝트로 등록할 수 있게 해주는거야. 프로젝트로 등록하면 여기서 뜨겠지? 그리고 프로젝트 등록하면 알아서 이 프로젝트의 내용들을 채워넣어주는거지.
```

**기획 결정 (AskUserQuestion):**
- Q: "세션을 프로젝트에 등록할 때, 같은 폴더의 다른 세션도 함께 등록하는 방식을 어떻게 하면 좋겠어요?"
  → **선택: "폴더=프로젝트 자동"** — 폴더 경로가 같으면 자동으로 같은 프로젝트로 매칭
- Q: "프로젝트 상세 뷰의 '프로젝트 요약' 섹션을 어떤 형태로 보고 싶어요?"
  → **선택: "키워드 + 타임라인"**

**Claude Code 작업:**
- 프로젝트 탭을 칸반 보드로 개편 (진행 중 / 대기 중 / 아카이브 3열)
- `folderPath` 기반 세션↔프로젝트 런타임 자동 매칭 구현
- ProjectModal 폴더 선택 드롭다운 (세션 폴더 목록 자동 감지)
- ProjectDetailView: 키워드 태그 + 날짜별 타임라인으로 개편
- 세션 상세 뷰에서 "프로젝트 등록" 버튼 추가
- 커밋: `e1ba260`, `75efc12`, `cd481e1`, `9d86c29`

### 6. Vite 빌드 행업 문제 해결

**Claude Code 작업:**
- 한글 경로에서 Rollup 네이티브 워커 스레드가 deadlock 발생
- `vite.config.ts`에 `maxParallelFileOps: 1` 추가 + `--outDir /c/tmp/...`로 우회 빌드
- 커밋: `9acab1e` fix: Windows Rollup 워커 스레드 행업 방지

### 7. Obsidian 볼트 프로젝트 폴더 정리

```
status 상태에 따라 구분하고 싶은데, 진행중(inprogress), 완료(completed), 보관(archived) 이렇게 나누면 되려나? 에이전트 팀을 구축해서 프로젝트 상태 단계를 어떻게 구분하는지 조사를 해주고 결론을 도출해줘.
```

**Claude Code 작업:**
- 4개 에이전트 팀(UX/개발/PM/의사결정) 병렬 리뷰 → 3분류(inProgress/completed/archived) 채택
- Obsidian 볼트 `74. Projects/` 폴더를 3-tier로 재구조화
- 27개 프로젝트 파일을 상태별 폴더로 이동
- `obsidian-project-sync` 스킬 업데이트

---

## 2026-04-06 (Day 3) — Obsidian 연동 설계 + 구현

### 8. CmdTrace와 Obsidian을 연동하고 싶어

```
지금 cmdtrace 대쉬보드하고 옵시디언의 프로젝트 파일하고 같이 연동해서 의미있게 쓰려면 어떻게 체계를 정리해야될까? 뭔가 기능적으로 중복이 되는듯하면서도 아닌거 같은게 애매해서 말이야.
```

```
옵시디언에 다 안붙이고 각각 하는것의 의미가 있어야될거 같아. 예를 들면 옵시디언에는 자세히 프로젝트 정리를 해서 나중 프로젝트 할 때 참고를 한다던가, cmdtrace는 세션을 전반적으로 다 보는 용도라던지
```

**Claude Code 작업:**
- 역할 분리 설계: **CmdTrace = 세션 뷰어** (현재 작업 현황판), **Obsidian = 지식 허브** (회고, 교훈, 재활용)
- 6단계 Obsidian 연동 PRD 작성
- 커밋: `2f24f4c` docs: Obsidian 연동 PRD + 로드맵 업데이트

### 9. Phase 1: 프로젝트 간소화

**Claude Code 작업:**
- CmdTrace 프로젝트 상태를 Obsidian과 통일: `pending` → `completed`
- `goal`, `notes` 필드 제거 (Obsidian에 위임)
- `obsidianNotePath` 필드 추가
- 커밋: `e300519` feat: Phase 1 — 프로젝트 간소화 + 상태 통일

### 10. Phase 2-5: 양방향 연동 구현

**Claude Code 작업:**
- **CmdTrace → Obsidian**: 프로젝트 상세 뷰에 보라색 "Obsidian" 버튼 추가
  - Obsidian REST API로 프로젝트명 검색 → 노트 열기
  - `electron/main.ts`에 `obsidianRequest` 헬퍼 (자체서명 인증서 처리)
- **Obsidian → CmdTrace**: `cmdtrace://project/{id}` 딥링크 프로토콜
  - `app.requestSingleInstanceLock()` + `second-instance` 이벤트
  - `App.tsx`에서 딥링크 URL 파싱 → 프로젝트 자동 선택
- **obsidian-project-sync 스킬**: Lessons Learned 템플릿, CmdTrace 딥링크, --retro 회고 모드 추가
- 커밋: `7e65050` feat: Phase 2-5 — Obsidian 연동 + 딥링크 + Lessons Learned

---

## 2026-04-06~07 (Day 3-4) — 딥링크 디버깅 마라톤

### 11. Obsidian에서 CmdTrace 딥링크가 안 돼

```
옵시디언에서도 세션현황판 클릭하면 에러가 나. 아까 구현한 기능 순서대로 다 테스트를 진행해줘봐
```

```
또 안된다. 이거 근본적인 문제 원인 분석이 필요한거 같아.
```

**문제 1**: Electron의 `setAsDefaultProtocolClient`가 레지스트리를 `electron.exe "%1"` 형태로 등록 → URL(`cmdtrace://project/...`)을 JavaScript 모듈 경로로 해석 → "Cannot find module" 에러

**해결 1**: 배치 래퍼 방식으로 전환
- `scripts/cmdtrace-protocol-handler.bat` — Electron 실행 래퍼
- `scripts/register-protocol.ps1` — Windows 레지스트리에 수동 등록
- 커밋: `a2a8067` fix: cmdtrace:// 딥링크 근본 수정 — 배치 래퍼 방식

**문제 2**: 배치 래퍼에 `ELECTRON_DEV=true` 설정 → dev 서버(localhost:5173) 접속 시도 → 빈 화면

**해결 2**: `ELECTRON_DEV` 제거 → 빌드된 `dist/index.html` 로드

**문제 3**: 한 번은 되는데 껐다 켜면 또 에러 → `setAsDefaultProtocolClient`가 production 모드에서 매번 레지스트리를 덮어씀

**해결 3**: `setAsDefaultProtocolClient` 완전 제거 + URL을 `CMDTRACE_DEEPLINK` 환경변수로 전달 (커맨드라인 인수에서 완전 제거)
- 커밋: `1f90ca1` fix: setAsDefaultProtocolClient 완전 제거 — 딥링크 레지스트리 덮어쓰기 방지

---

## 커밋 히스토리

| 날짜 | 커밋 | 설명 |
|------|------|------|
| 04/04 | `d73f18e` | CmdTrace Windows 포트 초기 구현 |
| 04/04 | `8dd35b4` | bat 파일 인코딩 오류 수정 |
| 04/04 | `3e91006` | 보안 취약점 및 버그 수정 |
| 04/05 | `e293953` | Flex 스타일 디자인 시스템 전면 개편 |
| 04/05 | `c2cce18` | 텍스트 크기 전반 확대 (가독성 개선) |
| 04/05 | `74a804d` | 컴포넌트 분리 + 세션 소프트 삭제 |
| 04/05 | `7c57670` | Projects 관리 + 즐겨찾기/핀 + 내보내기 |
| 04/05 | `50c9927` | Dashboard 차트 구현 (Recharts) |
| 04/05 | `0b91ac6` | CLAUDE.md / README.md 전면 재작성 |
| 04/05 | `6ac6d8a` | 디자인 개편 + Projects/즐겨찾기/Dashboard |
| 04/05 | `e1ba260` | 프로젝트 탭 → 프로젝트 관리 대시보드 |
| 04/05 | `75efc12` | 칸반 보드 + 자동 요약 |
| 04/05 | `cd481e1` | 세션 상세 뷰에서 프로젝트 등록 |
| 04/05 | `9d86c29` | 폴더 기반 자동 프로젝트 연결 |
| 04/05 | `9acab1e` | Rollup 워커 스레드 행업 방지 |
| 04/06 | `2f24f4c` | Obsidian 연동 PRD + 로드맵 업데이트 |
| 04/06 | `e300519` | Phase 1 — 프로젝트 간소화 + 상태 통일 |
| 04/06 | `7e65050` | Phase 2-5 — Obsidian 연동 + 딥링크 |
| 04/06 | `1504fde` | Obsidian 검색 버그 수정 + 딥링크 수정 |
| 04/07 | `a2a8067` | cmdtrace:// 딥링크 근본 수정 — 배치 래퍼 |
| 04/07 | `1f90ca1` | setAsDefaultProtocolClient 완전 제거 |

---

## 기술 스택

- **Frontend**: React 18, TypeScript 5, Tailwind CSS 3, Recharts 2
- **Desktop**: Electron 33, Vite 5
- **Font**: Pretendard (한글 최적화)
- **Build**: Vite + tsc (한글 경로 우회 빌드)
- **연동**: Obsidian Local REST API (자체서명 인증서), `cmdtrace://` 커스텀 프로토콜

---

## 주요 기능

1. **AI CLI 세션 뷰어**
   - Claude Code JSONL 세션 파일 파싱 + 시각화
   - 세션 검색 (tag:, project:, is:, date: 연산자)
   - 세션 소프트 삭제 (휴지통)
   - 세션 내보내기 (Markdown, JSON, HTML)

2. **프로젝트 관리 대시보드**
   - 칸반 보드 (진행 중 / 완료 / 아카이브)
   - 폴더 기반 자동 세션↔프로젝트 매칭
   - 프로젝트별 키워드 태그 + 날짜 타임라인
   - 8색 컬러 코딩 + 즐겨찾기/핀

3. **Dashboard 통계**
   - 30일 세션 활동 바차트
   - 프로젝트 분포 파이차트

4. **Obsidian 양방향 연동**
   - CmdTrace → Obsidian: "Obsidian에서 열기" 버튼 (REST API)
   - Obsidian → CmdTrace: `cmdtrace://project/{id}` 딥링크
   - obsidian-project-sync 스킬: 프로젝트 노트 자동 생성/업데이트

5. **디자인**
   - Flex 스타일 디자인 시스템 (Pretendard, subtle 보더, 라이트 레이어)
   - 가독성 최적화된 텍스트 크기
