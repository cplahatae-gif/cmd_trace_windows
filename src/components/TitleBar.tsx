export default function TitleBar() {
  return (
    <div className="drag-region h-10 bg-surface-base border-b border-border flex items-center px-4 shrink-0">
      <div className="flex items-center gap-2 no-drag">
        <div className="w-3 h-3 rounded-full bg-brand-500" />
        <span className="text-sm font-semibold text-ink-secondary tracking-widest uppercase">CmdTrace</span>
      </div>
    </div>
  )
}
