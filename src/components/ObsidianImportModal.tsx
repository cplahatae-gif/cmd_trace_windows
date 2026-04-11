import { useState, useEffect, useMemo } from 'react'
import { X, Download, AlertCircle, CheckCircle2, FileText } from 'lucide-react'
import type { ObsidianImportCandidate, Project, PROJECT_COLORS } from '../types'

interface Props {
  existingProjects: Project[]
  onImport: (picks: { candidate: ObsidianImportCandidate; name: string; color: string }[]) => Promise<void>
  onClose: () => void
}

const COLORS: readonly string[] = [
  '#635bff', '#22c55e', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
] as typeof PROJECT_COLORS

const STATUS_LABEL: Record<'active' | 'completed' | 'archived', string> = {
  active: '진행 중',
  completed: '완료',
  archived: '아카이브',
}

export default function ObsidianImportModal({ existingProjects, onImport, onClose }: Props) {
  const [candidates, setCandidates] = useState<ObsidianImportCandidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [showLinked, setShowLinked] = useState(false)

  const existingNames = useMemo(
    () => new Set(existingProjects.map(p => p.name.toLowerCase().trim())),
    [existingProjects]
  )

  useEffect(() => {
    let cancelled = false
    const scan = async () => {
      if (!window.electronAPI?.scanObsidianImportCandidates) {
        setError('Electron API 사용 불가')
        setLoading(false)
        return
      }
      try {
        const res = await window.electronAPI.scanObsidianImportCandidates()
        if (cancelled) return
        if (res.ok && res.candidates) {
          setCandidates(res.candidates)
        } else {
          setError(res.error || '스캔 실패')
        }
      } catch (err) {
        if (!cancelled) setError(String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    scan()
    return () => { cancelled = true }
  }, [])

  const toggleOne = (path: string) => {
    const next = new Set(selected)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setSelected(next)
  }

  const visibleCandidates = useMemo(() => {
    return candidates.filter(c => showLinked || !c.hasCmdtraceId)
  }, [candidates, showLinked])

  const importableCount = visibleCandidates.filter(c => !c.hasCmdtraceId && selected.has(c.path)).length

  const toggleAll = () => {
    const importable = visibleCandidates.filter(c => !c.hasCmdtraceId && !existingNames.has(c.name.toLowerCase().trim()))
    if (importable.every(c => selected.has(c.path))) {
      const next = new Set(selected)
      for (const c of importable) next.delete(c.path)
      setSelected(next)
    } else {
      const next = new Set(selected)
      for (const c of importable) next.add(c.path)
      setSelected(next)
    }
  }

  const handleImport = async () => {
    const picks = candidates
      .filter(c => selected.has(c.path) && !c.hasCmdtraceId)
      .map((c, i) => ({
        candidate: c,
        name: c.name,
        color: COLORS[i % COLORS.length],
      }))
    if (picks.length === 0) return
    setImporting(true)
    try {
      await onImport(picks)
      onClose()
    } catch (err) {
      setError(`임포트 실패: ${String(err)}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] bg-surface-base rounded-2xl shadow-panel border border-border flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-ink-primary">Obsidian에서 프로젝트 가져오기</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              <code className="text-[10px]">70. Outputs/74. Projects/</code> 폴더의 노트를 스캔합니다
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-ink-muted hover:text-ink-primary hover:bg-surface-soft rounded-lg">
            <X size={16} />
          </button>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading && (
            <div className="flex items-center justify-center py-12 text-ink-muted text-sm">
              스캔 중…
            </div>
          )}

          {error && !loading && (
            <div className="m-5 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">오류</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && candidates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-ink-muted">
              <FileText size={32} className="mb-2 text-ink-faint" />
              <p className="text-sm">볼트에 프로젝트 노트가 없습니다</p>
            </div>
          )}

          {!loading && !error && candidates.length > 0 && (
            <div className="p-4 space-y-1.5">
              {/* 필터 */}
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-xs text-ink-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLinked}
                    onChange={e => setShowLinked(e.target.checked)}
                    className="accent-brand-500"
                  />
                  이미 연결된 노트도 표시
                </label>
                <button
                  onClick={toggleAll}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  전체 선택/해제
                </button>
              </div>

              {visibleCandidates.map(c => {
                const nameCollision = existingNames.has(c.name.toLowerCase().trim())
                const disabled = c.hasCmdtraceId || nameCollision
                const isSelected = selected.has(c.path)
                return (
                  <label
                    key={c.path}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                      disabled
                        ? 'border-border bg-surface-soft/50 cursor-not-allowed'
                        : isSelected
                          ? 'border-brand-400 bg-brand-50/50 cursor-pointer'
                          : 'border-border hover:border-brand-200 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => toggleOne(c.path)}
                      className="accent-brand-500 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-ink-primary truncate">{c.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 bg-surface-subtle text-ink-muted rounded-full">
                          {STATUS_LABEL[c.status]}
                        </span>
                        {c.hasCmdtraceId && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                            <CheckCircle2 size={10} />
                            이미 연결됨
                          </span>
                        )}
                        {!c.hasCmdtraceId && nameCollision && (
                          <span className="text-[10px] text-amber-600 font-medium">
                            CmdTrace에 같은 이름의 프로젝트 있음
                          </span>
                        )}
                      </div>
                      {c.description && (
                        <p className="text-xs text-ink-muted mt-1 line-clamp-2">{c.description}</p>
                      )}
                      <p className="text-[10px] text-ink-faint mt-1 truncate font-mono">{c.path}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
          <p className="text-xs text-ink-muted">
            {importableCount > 0 ? `${importableCount}개 선택됨` : '가져올 노트를 선택하세요'}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary">
              취소
            </button>
            <button
              onClick={handleImport}
              disabled={importableCount === 0 || importing}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              {importing ? '가져오는 중…' : `${importableCount}개 가져오기`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
