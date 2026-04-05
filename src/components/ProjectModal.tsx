import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Project } from '../types'
import { PROJECT_COLORS } from '../types'

interface Props {
  project?: Project | null
  onSave: (data: { name: string; description: string; color: string }) => void
  onClose: () => void
}

export default function ProjectModal({ project, onSave, onClose }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>(PROJECT_COLORS[0])

  useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
      setColor(project.color as string)
    }
  }, [project])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), description: description.trim(), color })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-modal w-[420px] p-6"
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
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">프로젝트 이름</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-[rgba(0,0,0,0.12)] rounded-lg text-sm text-ink-primary focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="예: 쇼핑몰 리뉴얼"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">설명 (선택)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-[rgba(0,0,0,0.12)] rounded-lg text-sm text-ink-primary focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
              placeholder="프로젝트 설명..."
            />
          </div>

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
