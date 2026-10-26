"use client";
import { motion } from "framer-motion";

export interface AgentView { id: string; name: string; emoji: string; role: string; color: string; state: string; current: string; }

const STATE_DOT: Record<string, string> = {
  IDLE: "bg-stone-300", THINKING: "bg-amber-400", PLANNING: "bg-violet-400",
  WORKING: "bg-emerald-400", WAITING_FOR_TOOL: "bg-sky-400", WAITING_FOR_USER: "bg-rose-400",
  REVIEWING: "bg-indigo-400", ERROR: "bg-red-500", COMPLETED: "bg-teal-500",
};
const STATE_LABEL: Record<string, string> = {
  IDLE: "Idle", THINKING: "Thinking", PLANNING: "Planning", WORKING: "Working",
  WAITING_FOR_TOOL: "Using tool", WAITING_FOR_USER: "Needs you", REVIEWING: "Reviewing",
  ERROR: "Stuck", COMPLETED: "Done ✓",
};
const BUSY = new Set(["THINKING", "PLANNING", "WORKING", "WAITING_FOR_TOOL", "REVIEWING"]);

export function Office({ agents, theme }: { agents: AgentView[]; theme: string }) {
  const themes: Record<string, string> = {
    "Cozy Cafe": "from-[#FFF6EC] to-[#FFE9D6]",
    "Night Office": "from-[#2B2A4A] to-[#3B3A63]",
    "Garden Office": "from-[#EDF7EE] to-[#D9F2E6]",
    "Cyber Office": "from-[#EAF2FF] to-[#E8DEF8]",
  };
  const dark = theme === "Night Office";
  const order = ["yuki", "luna", "mochi", "neko", "miso"];
  const sorted = [...agents].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return (
    <div className={`rounded-3xl bg-gradient-to-br ${themes[theme] ?? themes["Cozy Cafe"]} shadow-soft border border-white/60 p-5 relative overflow-hidden`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className={`font-extrabold text-lg ${dark ? "text-white" : ""}`}>🏢 Tiny Office {theme === "Night Office" ? "🌙" : "🌿"}</h2>
          <p className={`text-xs ${dark ? "text-white/60" : "text-latte"}`}>Desks reflect real backend agent state — no fake progress.</p>
        </div>
        <div className={`text-xs px-3 py-1.5 rounded-full ${dark ? "bg-white/10 text-white" : "bg-white/70"}`}>🪴 ☕ 📚 ⭐ cute but readable</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {sorted.map((a) => (
          <motion.div key={a.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-3 border shadow-card ${dark ? "bg-white/10 border-white/10 text-white" : "bg-white/85 border-white"}`}>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl grid place-items-center text-2xl shadow-inner" style={{ background: a.color }}>
                <motion.span animate={BUSY.has(a.state) ? { y: [0, -3, 0] } : {}} transition={{ repeat: Infinity, duration: 1.6 }}>{a.emoji}</motion.span>
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-sm leading-tight truncate">{a.name} <span className={`text-[10px] font-bold ${dark ? "text-white/60" : "text-latte"}`}>{a.role}</span></div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  <span className={`w-2 h-2 rounded-full ${STATE_DOT[a.state] ?? "bg-stone-300"} ${BUSY.has(a.state) ? "dot-pulse" : ""}`} />
                  <span className={dark ? "text-white/80" : "text-cocoa/80"}>{STATE_LABEL[a.state] ?? a.state}</span>
                </div>
              </div>
            </div>
            <div className={`mt-2 text-[11px] rounded-xl px-2 py-1.5 min-h-[34px] ${dark ? "bg-black/20 text-white/80" : "bg-cream text-cocoa/80"}`}>
              {a.id === "yuki" ? "🧠 " : a.id === "luna" ? "💻 " : a.id === "mochi" ? "🎨 " : a.id === "neko" ? "🔎 " : "✍️ "}{a.current}
            </div>
            <div className={`mt-2 rounded-xl px-2 py-2 text-center text-[11px] ${dark ? "bg-black/20" : "bg-gradient-to-b from-[#fff] to-[#FFF3E8] border border-[#F3E4D4]"}`}>
              🖥️ <span className={dark ? "text-white/50" : "text-latte"}>desk · 🪑 · ☕ · 🪴</span>
            </div>
          </motion.div>
        ))}
      </div>
      <div className={`mt-4 rounded-2xl px-3 py-2 text-[11px] flex gap-3 items-center ${dark ? "bg-white/10 text-white/70" : "bg-white/70 text-latte"}`}>
        <span>📋 whiteboard: “Don’t just chat — give work.”</span><span className="ml-auto">✨ ⭐ 🌙</span>
      </div>
    </div>
  );
}
