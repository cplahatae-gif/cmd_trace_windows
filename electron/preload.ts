import { contextBridge, ipcRenderer } from 'electron'

// 렌더러 프로세스에 안전하게 노출할 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 세션 목록 로드
  loadSessions: (agentType: string) =>
    ipcRenderer.invoke('sessions:load', agentType),

  // 세션 메시지 로드
  loadMessages: (projectFolder: string, fileName: string) =>
    ipcRenderer.invoke('session:messages', projectFolder, fileName),

  // 세션 인사이트 로드
  loadInsights: (projectFolder: string, fileName: string) =>
    ipcRenderer.invoke('session:insights', projectFolder, fileName),

  // 터미널에서 세션 재개
  resumeSession: (sessionId: string, projectPath: string, terminal: string, bypass: boolean) =>
    ipcRenderer.invoke('session:resume', sessionId, projectPath, terminal, bypass),

  // 파일 탐색기에서 폴더 열기
  openFolder: (folderPath: string) =>
    ipcRenderer.invoke('shell:openFolder', folderPath),

  // 패널 카운터 리셋 (새 4-pane 레이아웃 시작)
  resetPanes: () =>
    ipcRenderer.invoke('session:resetPanes'),

  // 메타데이터(커스텀 이름, 태그) 저장/불러오기
  saveMetadata: (data: Record<string, unknown>) =>
    ipcRenderer.invoke('metadata:save', data),
  loadMetadata: () =>
    ipcRenderer.invoke('metadata:load'),
})
