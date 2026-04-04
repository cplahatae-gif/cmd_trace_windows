export default function TitleBar() {
  return (
    <div className="drag-region h-9 bg-slate-950 border-b border-slate-800 flex items-center px-4 shrink-0">
      <div className="flex items-center gap-2 no-drag">
        <div className="w-3 h-3 rounded-full bg-brand-500 opacity-80" />
        <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase">CmdTrace</span>
      </div>
    </div>
  )
}
