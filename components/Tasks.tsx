"use client";
export interface TaskView {
  id: string; title: string; status: string; assignedAgent: string;
  actualCost: number; inputTokens: number; outputTokens: number;
  result?: string; subtasks?: { id: string; title: string; status: string; assignedAgent: string; result?: string; error?: string }[];
  createdAt: number; completedAt?: number;
}
const STATUS_STYLE: Record<string, string> = {
  QUEUED: "bg-stone-100 text-stone-500", PLANNING: "bg-violet-100 text-violet-600",
  RUNNING: "bg-sky-100 text-sky-700", WAITING_FOR_USER: "bg-amber-100 text-amber-700",
  REVIEWING: "bg-indigo-100 text-indigo-700", COMPLETED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-600", CANCELLED: "bg-stone-200 text-stone-500",
};

export function TaskBoard({ tasks, selected, setSelected }: { tasks: TaskView[]; selected: TaskView | null; setSelected: (t: TaskView | null) => void }) {
  if (!tasks.length) return (
    <div className="rounded-3xl bg-white/70 border border-white p-6 text-center text-sm text-latte">
      🐾 No work yet — assign your first task above and watch the office come alive.
    </div>
  );
  return (
    <div className="space-y-2">
      {tasks.map(t => {
        const done = (t.subtasks ?? []).filter(s => s.status === "COMPLETED").length;
        const total = (t.subtasks ?? []).length;
        return (
          <button key={t.id} onClick={() => setSelected(t)}
            className={`w-full text-left rounded-2xl p-3 border transition ${selected?.id === t.id ? "bg-white border-peach shadow-pop" : "bg-white/80 border-white hover:shadow-card"}`}>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm flex-1 truncate">{t.status === "COMPLETED" ? "✓ " : ""}{t.title}</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? "bg-stone-100"}`}>{t.status}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-cream overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-salmon to-amber-300 transition-all" style={{ width: `${total ? Math.round((done / total) * 100) : t.status === "COMPLETED" ? 100 : 8}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-latte font-bold">{t.id} · {done}/{total} subtasks · {(t.inputTokens + t.outputTokens).toLocaleString()} tok · ${t.actualCost.toFixed(4)}</div>
            {!!total && (
              <div className="mt-1.5 space-y-1">
                {(t.subtasks ?? []).map(s => (
                  <div key={s.id} className="text-[11px] flex items-center gap-1.5 bg-cream/70 rounded-lg px-2 py-1">
                    <span>{s.status === "COMPLETED" ? "✓" : s.status === "RUNNING" ? "⏳" : s.status === "FAILED" ? "✗" : "·"}</span>
                    <span className="font-bold truncate flex-1">{s.id} {s.title}</span>
                    <span className="text-latte">→ {s.assignedAgent}</span>
                  </div>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TaskResult({ task, onClose }: { task: TaskView; onClose: () => void }) {
  const secs = task.completedAt ? Math.max(1, Math.round((task.completedAt - task.createdAt) / 1000)) : null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-cocoa/30 p-4" onClick={onClose}>
      <div className="rounded-3xl bg-white shadow-pop max-w-md w-full p-6 text-center" onClick={e => e.stopPropagation()}>
        <div className="text-3xl">🎉</div>
        <div className="font-extrabold text-lg mt-1">{task.status === "COMPLETED" ? "Task Completed" : `Status: ${task.status}`}</div>
        <div className="font-bold text-cocoa/80 mt-1">{task.title}</div>
        <div className="grid grid-cols-3 gap-2 mt-4 text-xs font-bold">
          <div className="bg-cream rounded-2xl p-2">⏱️<br />{secs !== null ? `${Math.floor(secs / 60)}m ${secs % 60}s` : "running…"}</div>
          <div className="bg-cream rounded-2xl p-2">🪙<br />{(task.inputTokens + task.outputTokens).toLocaleString()} tok</div>
          <div className="bg-cream rounded-2xl p-2">💰<br />${task.actualCost.toFixed(4)}</div>
        </div>
        {task.result && <pre className="mt-3 text-left text-[11px] bg-cream rounded-2xl p-3 max-h-48 overflow-auto whitespace-pre-wrap scroll-thin">{task.result.slice(0, 2000)}</pre>}
        <div className="mt-4 flex gap-2 justify-center">
          <button onClick={onClose} className="rounded-2xl bg-cocoa text-white text-sm font-extrabold px-5 py-2.5">Close</button>
        </div>
      </div>
    </div>
  );
}
