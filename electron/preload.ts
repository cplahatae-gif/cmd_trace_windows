import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  loadSessions:   (agentType: string) =>
    ipcRenderer.invoke('sessions:load', agentType),
  loadMessages:   (projectFolder: string, fileName: string) =>
    ipcRenderer.invoke('session:messages', projectFolder, fileName),
  loadInsights:   (projectFolder: string, fileName: string) =>
    ipcRenderer.invoke('session:insights', projectFolder, fileName),
  resumeSession:  (sessionId: string, projectPath: string, terminal: string, bypass: boolean) =>
    ipcRenderer.invoke('session:resume', sessionId, projectPath, terminal, bypass),
  openFolder:     (folderPath: string) =>
    ipcRenderer.invoke('shell:openFolder', folderPath),
  resetPanes:     () =>
    ipcRenderer.invoke('session:resetPanes'),
  saveMetadata:   (data: Record<string, unknown>) =>
    ipcRenderer.invoke('metadata:save', data),
  loadMetadata:   () =>
    ipcRenderer.invoke('metadata:load'),
  // H-1: 설정 영속성
  saveSettings:   (data: Record<string, unknown>) =>
    ipcRenderer.invoke('settings:save', data),
  loadSettings:   () =>
    ipcRenderer.invoke('settings:load'),
  // 프로젝트 관리
  saveProjects:   (data: Record<string, unknown>[]) =>
    ipcRenderer.invoke('projects:save', data),
  loadProjects:   () =>
    ipcRenderer.invoke('projects:load'),
  // 세션 내보내기
  exportSession:  (content: string, format: string, sessionName: string) =>
    ipcRenderer.invoke('session:export', content, format, sessionName),
  // Obsidian 연동
  searchObsidianNote: (projectName: string) =>
    ipcRenderer.invoke('obsidian:searchNote', projectName),
  openObsidianNote:   (filePath: string) =>
    ipcRenderer.invoke('obsidian:openNote', filePath),
  testObsidianConnection: () =>
    ipcRenderer.invoke('obsidian:testConnection'),
  upsertObsidianProjectNote: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('obsidian:upsertProjectNote', payload),
  scanObsidianImportCandidates: () =>
    ipcRenderer.invoke('obsidian:scanImportCandidates'),
  backfillObsidianCmdtraceId: (notePath: string, projectId: string) =>
    ipcRenderer.invoke('obsidian:backfillCmdtraceId', notePath, projectId),
  // 딥링크 수신
  onDeepLink: (callback: (url: string) => void) => {
    ipcRenderer.on('deeplink:navigate', (_event, url: string) => callback(url))
  },
})
