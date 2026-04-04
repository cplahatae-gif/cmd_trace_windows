export default function TitleBar() {
  return (
    <div className="drag-region h-9 bg-white border-b border-[rgba(0,0,0,0.08)] flex items-center px-4 shrink-0">
      <div className="flex items-center gap-2 no-drag">
        <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
        <span className="text-[11px] font-semibold text-ink-secondary tracking-widest uppercase">CmdTrace</span>
      </div>
    </div>
  )
}
