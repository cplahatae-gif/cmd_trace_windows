import type { ProjectStatus } from '../types'

const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  active:    { label: '진행 중', className: 'bg-green-50 text-green-600 border border-green-100' },
  completed: { label: '완료',   className: 'bg-blue-50 text-blue-600 border border-blue-100' },
  archived:  { label: '아카이브', className: 'bg-surface-subtle text-ink-muted border border-border' },
}

export default function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className } = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}>
      {label}
    </span>
  )
}
