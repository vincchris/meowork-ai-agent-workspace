"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Office } from "@/components/Office";
import { TaskCreator, ApprovalBanner, ApprovalItem } from "@/components/TaskCreator";
import { TaskBoard, TaskResult, TaskView } from "@/components/Tasks";
import { ActivityLog, UsagePanel, UsageShape, Ev } from "@/components/Panels";

const Office3D = dynamic(() => import("@/components/Office3D").then(m => m.Office3D), {
  ssr: false,
  loading: () => <div className="rounded-3xl bg-white/70 border border-white p-10 text-center text-sm font-bold text-latte">🐾 Membangun kantor 3D…</div>,
});

export default function Home() {
  const [agents, setAgents] = useState([]);
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [usage, setUsage] = useState<UsageShape | null>(null);
  const [showUsage, setShowUsage] = useState(false);
  const [selected, setSelected] = useState<TaskView | null>(null);
  const [autoApprove, setAutoApprove] = useState(true);
  const [theme, setTheme] = useState("Cozy Cafe");
  const [view, setView] = useState<"3d" | "2d">("3d");
  const [budget, setBudget] = useState<{ todaySpent: number; dailyLimit: number } | null>(null);

  const refresh = useCallback(async () => {
    const [a, t, u, ap] = await Promise.all([
      fetch("/api/agents").then(r => r.json()).catch(() => ({ agents: [] })),
      fetch("/api/tasks").then(r => r.json()).catch(() => ({ tasks: [] })),
      fetch("/api/usage").then(r => r.json()).catch(() => null),
      fetch("/api/approvals").then(r => r.json()).catch(() => ({ approvals: [] })),
    ]);
    setAgents(a.agents ?? []); setTasks(t.tasks ?? []);
    if (u) { setUsage(u); setBudget({ todaySpent: u.budget?.todaySpent ?? 0, dailyLimit: u.budget?.dailyLimit ?? 1 }); setEvents(u.events ?? []); }
    setApprovals(ap.approvals ?? []);
    if (selected) { const hit = (t.tasks ?? []).find((x: TaskView) => x.id === selected.id); if (hit && hit.status !== selected.status) setSelected(hit); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
    const es = new EventSource("/api/events");
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data);
        if (!e.id || !e.message) return;
        setEvents(prev => [e, ...prev].slice(0, 200));
        if (/agent\.|TASK_|SUBTASK_|AGENT_|budget\.|approval\./.test(e.type)) {
          // light refresh, debounced by nature of event cadence
          refresh();
        }
      } catch { /* ping */ }
    };
    const iv = setInterval(refresh, 4000);
    return () => { es.close(); clearInterval(iv); };
  }, [refresh]);

  const totalTokens = tasks.reduce((s, t) => s + t.inputTokens + t.outputTokens, 0);
  const activeAgents = (agents as { state: string }[]).filter(a => !["IDLE", "COMPLETED"].includes(a.state)).length;
  const activeTasks = tasks.filter(t => ["RUNNING", "PLANNING"].includes(t.status)).length;
  const completed = tasks.filter(t => t.status === "COMPLETED").length;
  const today = (usage?.today.total ?? totalTokens);

  return (
    <div className="max-w-7xl mx-auto px-4 pb-16">
      {/* TOP HUD */}
      <header className="sticky top-0 z-40 -mx-4 px-4 py-3 bg-cream/85 backdrop-blur border-b border-[#F0E2D3]">
        <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-cocoa text-white grid place-items-center text-xl shadow-card">🐱</div>
            <div><div className="font-extrabold leading-none">Meowork</div><div className="text-[10px] text-latte font-bold">tiny AI company 🐾</div></div>
          </div>
          <div className="flex gap-2 ml-auto flex-wrap text-xs font-extrabold">
            <span className="bg-white rounded-full px-3 py-1.5 shadow-card">🐱 {agents.length} Agents · <span className="text-emerald-600">{activeAgents} active</span></span>
            <span className="bg-white rounded-full px-3 py-1.5 shadow-card">📋 {activeTasks} Active · ✅ {completed} done</span>
            <span className="bg-white rounded-full px-3 py-1.5 shadow-card">🪙 {(today / 1000).toFixed(1)}K Tokens</span>
            <button onClick={() => setShowUsage(true)} title="Open usage dashboard"
              className="bg-cocoa text-white rounded-full px-3 py-1.5 shadow-card hover:bg-black">💰 ${(budget?.todaySpent ?? 0).toFixed(3)} Today ↗</button>
          </div>
        </div>
      </header>

      <p className="text-center text-xs text-latte font-bold mt-4 mb-3">“Don’t just chat with AI. Give your AI team work to do.”</p>

      <ApprovalBanner approvals={approvals} refresh={refresh} />
      <div className="mt-2"><TaskCreator onCreated={refresh} autoApprove={autoApprove} setAutoApprove={setAutoApprove} /></div>

      <div className="grid lg:grid-cols-5 gap-4 mt-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex bg-white rounded-full p-1 shadow-card text-xs font-extrabold">
              <button onClick={() => setView("3d")} className={`rounded-full px-4 py-1.5 transition ${view === "3d" ? "bg-cocoa text-white" : "text-latte"}`}>✨ 3D Office</button>
              <button onClick={() => setView("2d")} className={`rounded-full px-4 py-1.5 transition ${view === "2d" ? "bg-cocoa text-white" : "text-latte"}`}>🗂️ 2D Desks</button>
            </div>
            {view === "3d" && <span className="text-[11px] font-bold text-latte">kucingnya hidup — kerja, ngopi, tidur 😴</span>}
          </div>
          {view === "3d" ? <Office3D agents={agents} theme={theme} /> : <Office agents={agents} theme={theme} />}
          <div className="rounded-3xl bg-white/70 border border-white p-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-latte">🎨 Office theme:</span>
            {["Cozy Cafe", "Night Office", "Garden Office", "Cyber Office"].map(t => (
              <button key={t} onClick={() => setTheme(t)} className={`text-xs font-extrabold rounded-full px-3 py-1.5 ${theme === t ? "bg-cocoa text-white" : "bg-white shadow-card"}`}>{t}</button>
            ))}
            <span className="ml-auto text-[11px] text-latte font-bold">Qwen-powered · mock fallback offline · pricing centralized in lib/pricing.ts</span>
          </div>
          <TaskBoard tasks={tasks} selected={selected} setSelected={setSelected} />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-3xl bg-white/85 border border-white shadow-card p-4">
            <h3 className="font-extrabold text-sm">🏆 Team today</h3>
            <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs font-extrabold">
              <div className="bg-cream rounded-2xl p-2.5">✅<br />{completed} done</div>
              <div className="bg-cream rounded-2xl p-2.5">⚡<br />{activeTasks} running</div>
              <div className="bg-cream rounded-2xl p-2.5">⭐<br />Lv.{1 + Math.floor(completed / 5)} team</div>
            </div>
            <p className="text-[11px] text-latte font-bold mt-2">Gamification visualizes work only — no dark patterns. Level up by shipping real tasks.</p>
          </div>
          <ActivityLog events={events} />
          <div className="rounded-3xl bg-white/70 border border-white p-4 text-[11px] font-bold text-latte">
            🔒 Safety: LOW tools auto-run · MEDIUM/HIGH need approval · sandboxed to <code>workspace/sandbox</code> · allowlisted commands · daily ${budget?.dailyLimit?.toFixed(2) ?? "1.00"} cap pauses work at 100%, warns at 80%.
          </div>
        </div>
      </div>

      {selected && (selected.status === "COMPLETED" || selected.status === "REVIEWING") && (
        <TaskResult task={selected} onClose={() => setSelected(null)} />
      )}
      {showUsage && <UsagePanel usage={usage} onClose={() => setShowUsage(false)} />}
    </div>
  );
}
