import { useState } from 'react'
import { X, Layers } from 'lucide-react'

interface Props {
  sessionCount: number
  onSave: (name: string) => void
  onClose: () => void
}

export default function WorkspaceModal({ sessionCount, onSave, onClose }: Props) {
  const defaultName = `워크스페이스 ${new Date().toLocaleDateString('ko-KR')}`
  const [name, setName] = useState(defaultName)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave(name.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-base rounded-2xl shadow-modal w-[420px] p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
              <Layers size={14} className="text-brand-600" />
            </div>
            <h2 className="text-base font-semibold text-ink-primary">워크스페이스 저장</h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink-secondary p-1 rounded-lg hover:bg-surface-subtle"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">워크스페이스 이름</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && onClose()}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink-primary focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              placeholder="워크스페이스 이름을 입력하세요"
            />
            <p className="text-[11px] text-ink-faint mt-1.5">
              {sessionCount}개 세션이 포함됩니다
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">취소</button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
