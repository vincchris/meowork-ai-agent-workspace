"use client";
import { useState } from "react";

export function TaskCreator({ onCreated, autoApprove, setAutoApprove }: { onCreated: () => void; autoApprove: boolean; setAutoApprove: (v: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(example?: string) {
    const t = (example ?? title).trim();
    if (!t || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: t, description: t, autoApproveLowMedium: autoApprove }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      setTitle(""); onCreated();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const examples = ["Create a landing page for my AI startup", "Research portfolio design patterns", "Write a blog post about remote work"];
  return (
    <div className="rounded-3xl bg-white/85 border border-white shadow-card p-4">
      <h3 className="font-extrabold">✨ Give your team work</h3>
      <p className="text-xs text-latte mb-2">Yuki breaks it down, specialists do real tool work.</p>
      <div className="flex gap-2">
        <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder="e.g. Build a portfolio website…" className="flex-1 rounded-2xl border border-[#F0E2D3] bg-cream px-3 py-2.5 text-sm outline-none focus:ring-2 ring-peach" />
        <button onClick={() => submit()} disabled={busy || !title.trim()}
          className="rounded-2xl bg-cocoa text-white text-sm font-extrabold px-4 py-2.5 disabled:opacity-40 hover:bg-black transition">{busy ? "Assigning…" : "Assign 🐾"}</button>
      </div>
      {err && <div className="mt-2 text-xs font-bold text-red-500 bg-red-50 rounded-xl px-3 py-2">⚠ {err}</div>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {examples.map(x => <button key={x} onClick={() => submit(x)} className="text-[11px] font-bold bg-blush/60 hover:bg-blush rounded-full px-2.5 py-1 transition">“{x.slice(0, 32)}…”</button>)}
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs font-bold text-cocoa/80 cursor-pointer">
        <input type="checkbox" checked={autoApprove} onChange={e => setAutoApprove(e.target.checked)} className="accent-[#FF8A7A] w-4 h-4" />
        Auto-approve medium-risk file writes <span className="text-latte font-semibold">(uncheck = approve each write)</span>
      </label>
    </div>
  );
}

export function ApprovalBanner({ approvals, refresh }: { approvals: ApprovalItem[]; refresh: () => void }) {
  const pending = approvals.filter(a => a.status === "PENDING");
  if (!pending.length) return null;
  async function decide(id: string, decision: string) {
    await fetch("/api/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
    refresh();
  }
  return (
    <div className="space-y-2">
      {pending.map(a => (
        <div key={a.id} className="rounded-2xl bg-white border-2 border-amber-200 shadow-pop p-3 flex items-center gap-3">
          <div className="text-2xl">🐱</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold">Luna wants permission <span className="text-[10px] bg-amber-100 rounded-full px-2 py-0.5 ml-1">{a.risk} RISK</span></div>
            <code className="text-xs bg-cream rounded-lg px-2 py-1 block truncate mt-1">{a.tool}({a.commandPreview})</code>
          </div>
          <button onClick={() => decide(a.id, "APPROVED")} className="rounded-xl bg-emerald-500 text-white text-xs font-extrabold px-3 py-2">Allow once</button>
          <button onClick={() => decide(a.id, "DENIED")} className="rounded-xl bg-stone-200 text-xs font-extrabold px-3 py-2">Deny</button>
        </div>
      ))}
    </div>
  );
}
export interface ApprovalItem { id: string; tool: string; commandPreview: string; risk: string; status: string; agentId: string }
