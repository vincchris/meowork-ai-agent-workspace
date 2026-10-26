"use client";
import { useState } from "react";

export interface Ev { id: string; ts: number; type: string; agentId?: string; message: string }
const EMOJI: Record<string, string> = { luna: "🐱", mochi: "🎨", neko: "🔎", miso: "✍️", yuki: "🧠" };

export function ActivityLog({ events }: { events: Ev[] }) {
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState("");
  const list = events.filter(e => !filter || (e.agentId === filter)).slice(0, 120);
  return (
    <div className="rounded-3xl bg-[#2E2A26] text-[#F5EDE4] shadow-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-extrabold">
        <span>🧾 Execution log</span>
        <span className="text-[10px] bg-white/10 rounded-full px-2 py-0.5">{events.length}</span>
        <span className="ml-auto text-xs opacity-60">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <div className="flex gap-1.5 mb-2">
            {["", "luna", "mochi", "neko", "miso", "yuki"].map(a => (
              <button key={a} onClick={() => setFilter(a)} className={`text-[10px] font-extrabold rounded-full px-2 py-1 ${filter === a ? "bg-salmon text-white" : "bg-white/10"}`}>{a || "all"}</button>
            ))}
          </div>
          <div className="h-64 overflow-auto scroll-thin space-y-1 font-mono text-[11px]">
            {list.map(e => (
              <div key={e.id} className="flex gap-2 px-2 py-1 rounded-lg hover:bg-white/5">
                <span className="opacity-50 shrink-0">{new Date(e.ts).toLocaleTimeString()}</span>
                <span className="shrink-0">{e.agentId ? EMOJI[e.agentId] ?? "🐾" : "📡"}</span>
                <span className="break-words">{e.message.slice(0, 220)}</span>
              </div>
            ))}
            {!list.length && <div className="opacity-50 p-3">Waiting for activity… assign a task 🐾</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function UsagePanel({ usage, onClose }: { usage: UsageShape | null; onClose: () => void }) {
  if (!usage) return null;
  const t = usage.today;
  const bar = (v: number, max: number) => `${Math.min(100, Math.round((v / Math.max(max, 1)) * 100))}%`;
  const maxAgent = Math.max(1, ...Object.values(usage.byAgent).map((a: { tokens: number }) => a.tokens));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-cocoa/30 p-4" onClick={onClose}>
      <div className="rounded-3xl bg-white shadow-pop max-w-lg w-full p-6 max-h-[85vh] overflow-auto scroll-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2"><h3 className="font-extrabold text-lg">💰 Token dashboard</h3><button onClick={onClose} className="ml-auto text-xs font-bold bg-stone-100 rounded-full px-3 py-1.5">close</button></div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-center">
          <Stat label="Input" value={t.input.toLocaleString()} /><Stat label="Output" value={t.output.toLocaleString()} />
          <Stat label="Total today" value={t.total.toLocaleString()} hot /><Stat label="Est. cost" value={`$${t.cost.toFixed(4)}`} hot />
          <Stat label="Tasks" value={String(t.tasks)} /><Stat label="Avg / task" value={`$${t.avgPerTask.toFixed(4)}`} />
        </div>
        <h4 className="text-xs font-extrabold mt-4 mb-1 text-latte">BY AGENT</h4>
        {Object.entries(usage.byAgent).map(([k, v]: [string, { tokens: number; cost: number }]) => (
          <div key={k} className="text-xs font-bold mb-1.5"><div className="flex justify-between"><span>🐱 {k}</span><span>{v.tokens.toLocaleString()} · ${v.cost.toFixed(4)}</span></div>
            <div className="h-1.5 bg-cream rounded-full mt-0.5"><div className="h-full bg-matcha rounded-full" style={{ width: bar(v.tokens, maxAgent) }} /></div></div>
        ))}
        <h4 className="text-xs font-extrabold mt-3 mb-1 text-latte">BY MODEL</h4>
        {Object.entries(usage.byModel).map(([k, v]: [string, { tokens: number; cost: number }]) => (
          <div key={k} className="text-xs font-mono flex justify-between bg-cream rounded-lg px-2 py-1 mb-1"><span>{k}</span><span>${v.cost.toFixed(4)}</span></div>
        ))}
        <div className="mt-3 text-[11px] bg-butter/60 rounded-2xl p-3 font-bold">Budget: ${usage.budget.todaySpent.toFixed(4)} / ${usage.budget.dailyLimit.toFixed(2)} today · paused: {String(usage.budget.paused)}</div>
      </div>
    </div>
  );
}
function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return <div className={`rounded-2xl p-3 ${hot ? "bg-cocoa text-white" : "bg-cream"}`}><div className="text-[10px] font-extrabold opacity-60">{label}</div><div className="font-extrabold">{value}</div></div>;
}
export interface UsageShape { today: { input: number; output: number; total: number; cost: number; tasks: number; avgPerTask: number }; byAgent: Record<string, { tokens: number; cost: number }>; byModel: Record<string, { tokens: number; cost: number }>; budget: { todaySpent: number; dailyLimit: number; paused: boolean } }
