import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Project, ProjectStatus } from '../types'
import { PROJECT_COLORS } from '../types'

export interface ProjectFormData {
  name: string
  description: string
  color: string
  status: ProjectStatus
  folderPath: string
}

interface Props {
  project?: Project | null
  folders?: string[]
  onSave: (data: ProjectFormData) => void
  onClose: () => void
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'active',    label: '진행 중' },
  { value: 'completed', label: '완료' },
  { value: 'archived',  label: '아카이브' },
]

export default function ProjectModal({ project, folders, onSave, onClose }: Props) {
  const [name, setName]           = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor]         = useState<string>(PROJECT_COLORS[0])
  const [status, setStatus]       = useState<ProjectStatus>('active')
  const [folderPath, setFolderPath] = useState('')

  useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
      setColor(project.color as string)
      setStatus(project.status || 'active')
      setFolderPath(project.folderPath || '')
    }
  }, [project])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      description: description.trim(),
      color,
      status,
      folderPath: folderPath.trim(),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-base rounded-2xl shadow-modal w-[460px] p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink-primary">
            {project ? '프로젝트 수정' : '새 프로젝트'}
          </h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-secondary p-1 rounded-lg hover:bg-surface-subtle">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">프로젝트 이름</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="예: 쇼핑몰 리뉴얼"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">설명 (선택)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
              placeholder="프로젝트 설명..."
            />
          </div>

          {/* 상태 */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-2">상태</label>
            <div className="flex gap-1.5">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    status === opt.value
                      ? opt.value === 'active'
                        ? 'bg-green-50 text-green-600 border-green-200'
                        : opt.value === 'completed'
                        ? 'bg-blue-50 text-blue-600 border-blue-200'
                        : 'bg-surface-subtle text-ink-secondary border-border'
                      : 'bg-surface-base text-ink-muted border-border hover:bg-surface-soft'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 색상 */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-2">색상</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-brand-400 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* 연결 폴더 */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">연결 폴더 (선택)</label>
            <p className="text-[11px] text-ink-faint mb-1.5">선택한 폴더의 세션이 이 프로젝트에 자동으로 포함됩니다.</p>
            {folders && folders.length > 0 ? (
              <select
                value={folderPath}
                onChange={e => setFolderPath(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-surface-base"
              >
                <option value="">-- 폴더 선택 안 함 --</option>
                {folders.map(f => (
                  <option key={f} value={f}>
                    {f.split(/[\\/]/).pop() || f}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={folderPath}
                onChange={e => setFolderPath(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                placeholder="C:/Users/...폴더 경로..."
              />
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">취소</button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {project ? '저장' : '만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
