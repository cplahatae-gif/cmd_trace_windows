import { useState } from 'react'
import { Layers, Play, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react'
import type { Workspace, AppSettings } from '../types'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Props {
  workspaces: Workspace[]
  settings: AppSettings
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
}

export default function WorkspacesView({ workspaces, settings, onDelete, onRename }: Props) {
  const [resumingId, setResumingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleRestoreAll = async (ws: Workspace) => {
    if (!window.electronAPI || resumingId) return
    setResumingId(ws.id)
    try {
      await window.electronAPI.resetPanes()
      const sorted = [...ws.entries].sort((a, b) => a.order - b.order)
      for (const entry of sorted) {
        await window.electronAPI.resumeSession(
          entry.sessionId,
          entry.projectPath,
          settings.terminal,
          settings.bypassPermissions
        )
        await new Promise(r => setTimeout(r, 300))
      }
    } finally {
      setResumingId(null)
    }
  }

  const startEdit = (ws: Workspace) => {
    setEditingId(ws.id)
    setEditName(ws.name)
    setDeleteConfirmId(null)
  }

  const commitEdit = (id: string) => {
    if (editName.trim()) onRename(id, editName.trim())
    setEditingId(null)
  }

  const cancelEdit = () => setEditingId(null)

  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-ink-muted gap-4 bg-surface-soft">
        <div className="w-16 h-16 rounded-2xl bg-surface-base border border-border shadow-card flex items-center justify-center">
          <Layers size={28} className="text-ink-faint" />
        </div>
        <p className="text-base font-semibold text-ink-secondary">저장된 워크스페이스가 없습니다</p>
        <p className="text-sm text-ink-muted text-center max-w-xs">
          세션 목록에서 여러 세션을 선택한 뒤<br />
          "워크스페이스로 저장" 버튼을 클릭하세요
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface-soft overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-surface-base shrink-0">
        <h1 className="text-base font-semibold text-ink-primary">워크스페이스</h1>
        <p className="text-xs text-ink-muted mt-0.5">저장된 세션 묶음을 한 번에 재개합니다</p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-3">
        {workspaces.map(ws => (
          <div
            key={ws.id}
            className="bg-surface-base rounded-xl border border-border shadow-card p-4"
          >
            <div className="flex items-start gap-3">
              {/* 아이콘 */}
              <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                <Layers size={16} className="text-brand-600" />
              </div>

              {/* 본문 */}
              <div className="flex-1 min-w-0">
                {/* 이름 */}
                {editingId === ws.id ? (
                  <div className="flex items-center gap-1.5 mb-1">
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit(ws.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="flex-1 px-2 py-1 text-sm border border-brand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-100 text-ink-primary"
                    />
                    <button onClick={() => commitEdit(ws.id)} className="text-brand-500 hover:text-brand-700 p-0.5">
                      <Check size={14} />
                    </button>
                    <button onClick={cancelEdit} className="text-ink-faint hover:text-ink-secondary p-0.5">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-ink-primary truncate">{ws.name}</p>
                )}

                {/* 메타 */}
                <div className="flex items-center gap-2 mt-0.5 mb-2">
                  <span className="text-xs text-ink-muted">
                    세션 {ws.entries.length}개
                  </span>
                  <span className="text-ink-faint text-xs">·</span>
                  <span className="text-xs text-ink-faint">
                    {formatDistanceToNow(new Date(ws.createdAt), { addSuffix: true, locale: ko })}
                  </span>
                </div>

                {/* 세션 타이틀 칩 */}
                <div className="flex flex-wrap gap-1">
                  {[...ws.entries]
                    .sort((a, b) => a.order - b.order)
                    .map(entry => (
                      <span
                        key={entry.sessionRecordId}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-surface-subtle text-ink-secondary rounded-full border border-border"
                      >
                        <span className="text-ink-faint font-mono">{entry.order}.</span>
                        <span className="truncate max-w-[140px]">{entry.title}</span>
                      </span>
                    ))
                  }
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="flex items-center gap-1 shrink-0">
                {deleteConfirmId === ws.id ? (
                  <>
                    <button
                      onClick={() => { onDelete(ws.id); setDeleteConfirmId(null) }}
                      className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg"
                    >
                      삭제
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2.5 py-1 bg-surface-subtle text-ink-secondary text-xs rounded-lg border border-border hover:bg-surface-soft"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleRestoreAll(ws)}
                      disabled={!!resumingId}
                      className="btn-primary disabled:opacity-50"
                    >
                      {resumingId === ws.id
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Play size={11} />
                      }
                      모두 재개
                    </button>
                    <button
                      onClick={() => startEdit(ws)}
                      className="p-1.5 text-ink-faint hover:text-ink-secondary hover:bg-surface-subtle rounded-lg transition-colors"
                      title="이름 변경"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(ws.id)}
                      className="p-1.5 text-ink-faint hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
