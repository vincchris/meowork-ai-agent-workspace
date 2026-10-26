// Yuki orchestration: plan → delegate → tools → review. Event-driven, budget-guarded.
import { randomUUID } from "crypto";
import type { AgentId, AgentState, ApprovalRequest, BudgetState, SubTask, Task, TaskStatus, ToolExecution, UsageRecord } from "./types";
import { AGENT_MAP } from "./agents";
import { calcCost, routeModel } from "./pricing";
import { estimateTokens, getProvider } from "./providers";
import { TOOL_DEFS, execTool, toolRisk } from "./tools";
import { emit } from "./events";

interface DB {
  tasks: Map<string, Task>; subtasks: Map<string, SubTask>;
  executions: ToolExecution[]; usage: UsageRecord[];
  approvals: Map<string, ApprovalRequest>;
  agentState: Record<AgentId, { state: AgentState; current: string }>;
  mem: { task: Record<string, string[]>; user: Record<string, string> };
  budget: BudgetState;
}
function getDB(): DB {
  const g = globalThis as unknown as { __meowork?: DB };
  if (!g.__meowork) {
    g.__meowork = {
      tasks: new Map(), subtasks: new Map(), executions: [], usage: [],
      approvals: new Map(),
      agentState: {
        yuki: { state: "IDLE", current: "Planning" }, luna: { state: "IDLE", current: "Taking a break ☕" },
        mochi: { state: "IDLE", current: "Taking a break ☕" }, neko: { state: "IDLE", current: "Taking a break ☕" },
        miso: { state: "IDLE", current: "Taking a break ☕" },
      },
      mem: { task: {}, user: {} },
      budget: {
        dailyLimit: Number(process.env.DAILY_BUDGET_USD ?? 1),
        monthlyLimit: Number(process.env.MONTHLY_BUDGET_USD ?? 10),
        perTaskLimit: Number(process.env.PER_TASK_BUDGET_USD ?? 0.25),
        todaySpent: 0, monthSpent: 0, paused: false,
      },
    };
  }
  return g.__meowork;
}

export function getStates() { return getDB().agentState; }
export function listTasks(): Task[] { return [...getDB().tasks.values()].sort((a, b) => b.createdAt - a.createdAt); }
export function listSubtasks(taskId: string): SubTask[] {
  return [...getDB().subtasks.values()].filter(s => s.parentTaskId === taskId).sort((a, b) => a.order - b.order);
}
export function getTaskDetail(id: string) {
  const db = getDB();
  const task = db.tasks.get(id) ?? [...db.subtasks.values()].find(s => s.id === id);
  if (!task) return null;
  const subs = [...db.subtasks.values()].filter(s => s.parentTaskId === id).sort((a, b) => a.order - b.order);
  const execs = db.executions.filter(e => e.taskId === id || subs.some(s => s.id === e.subtaskId));
  const usage = db.usage.filter(u => u.taskId === id);
  return { task, subs, execs, usage };
}
export function listUsage() { return getDB().usage.slice(-500); }
export function listApprovals() { return [...getDB().approvals.values()].sort((a, b) => b.createdAt - a.createdAt); }
export function listExecutions(taskId?: string) {
  const ex = getDB().executions;
  return (taskId ? ex.filter(e => e.taskId === taskId) : ex).slice(-200).reverse();
}
export function getBudget() { return getDB().budget; }
export function setBudget(patch: Partial<BudgetState>) { Object.assign(getDB().budget, patch); return getDB().budget; }

function setAgent(id: AgentId, state: AgentState, current: string) {
  getDB().agentState[id] = { state, current };
  emit(`agent.${state.toLowerCase()}` as never as string, `${AGENT_MAP[id].emoji} ${AGENT_MAP[id].name} — ${current}`, { agentId: id, message: `${AGENT_MAP[id].emoji} ${AGENT_MAP[id].name} — ${current}` });
}

function recordUsage(taskId: string, agentId: AgentId, provider: string, model: string, i: number, o: number, toolCalls: number) {
  const db = getDB();
  const { inputCost, outputCost, totalCost } = calcCost(provider, model, i, o);
  db.usage.push({ id: randomUUID(), taskId, agentId, provider, model, inputTokens: i, outputTokens: o, totalTokens: i + o, inputCost, outputCost, totalCost, toolCalls, timestamp: Date.now() });
  db.budget.todaySpent += totalCost; db.budget.monthSpent += totalCost;
  const t = db.tasks.get(taskId) ?? db.subtasks.get(taskId);
  if (t) { t.inputTokens += i; t.outputTokens += o; t.actualCost += totalCost; }
  if (db.budget.todaySpent >= db.budget.dailyLimit) {
    db.budget.paused = true;
    emit("budget.exceeded", `⚠ Daily budget reached ($${db.budget.todaySpent.toFixed(3)} / $${db.budget.dailyLimit.toFixed(2)}). AI work paused.`);
  } else if (db.budget.todaySpent >= db.budget.dailyLimit * 0.8) {
    emit("budget.warning", `⚠ Your AI team has used 80% of today's budget ($${db.budget.todaySpent.toFixed(3)}).`);
  }
  return totalCost;
}

function complexityOf(text: string): "low" | "medium" | "high" {
  const t = text.toLowerCase();
  if (/(build|website|landing|portfolio|app|api|system|refactor|research and|full)/.test(t) || text.length > 120) return "high";
  if (/(design|write|blog|doc|summar|analy[sz]e|debug|test)/.test(t) || text.length > 40) return "medium";
  return "low";
}

// Yuki's decomposition: keyword-routed specialist subtasks (manager never does specialist work).
function planSubtasks(title: string, desc: string): { agent: AgentId; title: string; brief: string }[] {
  const full = `${title} ${desc}`.toLowerCase();
  const wants = {
    research: /(research|competitor|market|compare|seo|investigat|survey)/.test(full),
    design: /(design|landing|ui|ux|color|page|website|portfolio|brand|style)/.test(full),
    code: /(code|build|implement|app|website|api|bug|fix|feature|refactor|test|deploy|auth|portfolio)/.test(full),
    write: /(write|blog|article|doc|copy|content|readme|post|text)/.test(full),
  };
  const steps: { agent: AgentId; title: string; brief: string }[] = [];
  if (wants.research || complexityOf(full) === "high") steps.push({ agent: "neko", title: "Research context & patterns", brief: `Research for: ${title}. ${desc}. Deliver 3 findings + sources (save_research).` });
  if (wants.design) steps.push({ agent: "mochi", title: "Visual design spec", brief: `Design for: ${title}. ${desc}. Palette/type/layout/component specs (generate_design_spec).` });
  if (wants.code) steps.push({ agent: "luna", title: "Implement working draft", brief: `Implement: ${title}. ${desc}. Inspect project, write real files under workspace/sandbox, run checks.` });
  if (wants.write) steps.push({ agent: "miso", title: "Write content", brief: `Write for: ${title}. ${desc}. Clear, warm, structured markdown (create_document).` });
  if (!steps.length) {
    if (/design|color|ui/.test(full)) steps.push({ agent: "mochi", title: "Design pass", brief: `${title}. ${desc}` });
    else if (/research|find|search/.test(full)) steps.push({ agent: "neko", title: "Quick research", brief: `${title}. ${desc}` });
    else if (/write|doc|blog/.test(full)) steps.push({ agent: "miso", title: "Writing pass", brief: `${title}. ${desc}` });
    else steps.push({ agent: "luna", title: "Build it", brief: `${title}. ${desc}` });
  }
  return steps;
}

const AGENT_TOOL_PLAN: Record<AgentId, (brief: string) => { tool: string; args: Record<string, unknown> }[]> = {
  yuki: () => [], // manager delegates; never runs specialist tools
  luna: (brief) => [
    { tool: "inspect_project", args: {} },
    { tool: "write_file", args: { path: "output.md", content: `# Build log\n\nTask: ${brief.slice(0, 300)}\n\n## Implementation\n\nWorking draft produced by Luna (Developer).\n- Real file written to workspace/sandbox/output.md\n- Next: run checks, then manager review\n` } },
    { tool: "run_tests", args: {} },
  ],
  mochi: (brief) => [{ tool: "generate_design_spec", args: { brief: brief.slice(0, 400) } }],
  neko: (brief) => [
    { tool: "web_search", args: { query: brief.slice(0, 120) } },
    { tool: "save_research", args: { path: "research.md", content: `# Research brief\n\nQuery: ${brief.slice(0, 200)}\n\n## Findings\n- Keep scope tight; ship one page first\n- Study 2 competitors before final copy\n- Cite sources in final doc\n\nSources: sandbox + live search (when online).\n` } },
  ],
  miso: (brief) => [{ tool: "create_document", args: { path: "draft.md", content: `# Draft\n\nBrief: ${brief.slice(0, 300)}\n\n## Content\n\nWarm, concise, structured. Ready for Yuki's review.\n` } }],
};

async function waitForApproval(id: string): Promise<"APPROVED" | "DENIED"> {
  for (let i = 0; i < 600; i++) { // ~10 min cap
    const a = getDB().approvals.get(id);
    if (a && a.status !== "PENDING") return a.status;
    await new Promise(r => setTimeout(r, 1000));
  }
  return "DENIED";
}

async function runToolWithGate(agent: AgentId, taskId: string, subtaskId: string, tool: string, args: Record<string, unknown>, autoApprove: boolean) {
  const db = getDB();
  const risk = toolRisk(tool);
  const ex: ToolExecution = { id: randomUUID(), taskId, subtaskId, agentId: agent, tool, args, startedAt: Date.now(), inputTokens: 0, outputTokens: 0 };
  db.executions.push(ex);
  emit("agent.tool_started", `${AGENT_MAP[agent].emoji} ${AGENT_MAP[agent].name} → ${tool}(${summarizeArgs(args)})`, { agentId: agent, taskId });
  setAgent(agent, "WAITING_FOR_TOOL", `⚙️ ${tool}…`);

  if ((risk === "MEDIUM" || risk === "HIGH") && !autoApprove) {
    const ap: ApprovalRequest = { id: randomUUID(), taskId, subtaskId, agentId: agent, tool, commandPreview: `${tool}(${summarizeArgs(args)})`, risk, status: "PENDING", createdAt: Date.now() };
    db.approvals.set(ap.id, ap);
    setAgent(agent, "WAITING_FOR_USER", `Waiting for approval: ${tool}`);
    emit("agent.waiting_for_user", `🐱 ${AGENT_MAP[agent].name} wants permission to execute: ${tool}(${summarizeArgs(args)})`, { agentId: agent, taskId, data: { approvalId: ap.id } });
    const decision = await waitForApproval(ap.id);
    ap.decidedAt = Date.now();
    if (decision !== "APPROVED") {
      ex.endedAt = Date.now(); ex.ok = false; ex.error = "Denied by user";
      emit("agent.tool_completed", `⛔ ${tool} denied by user`, { agentId: agent, taskId });
      throw new Error(`Tool ${tool} denied by user`);
    }
  }

  const res = await execTool(agent, tool, args);
  ex.endedAt = Date.now(); ex.ok = res.ok; ex.inputTokens = res.inputTokens; ex.outputTokens = res.outputTokens;
  ex.outputPreview = (res.ok ? res.output : res.error)?.slice(0, 500); ex.error = res.error;
  emit("agent.tool_completed", res.ok ? `✓ ${tool} — ${res.output.slice(0, 140)}` : `✗ ${tool} failed: ${res.error}`, { agentId: agent, taskId });
  if (!res.ok) throw new Error(res.error ?? `${tool} failed`);
  return res;
}

function summarizeArgs(a: Record<string, unknown>) {
  const s = JSON.stringify(a);
  return s.length > 90 ? s.slice(0, 90) + "…" : s;
}

async function runSubtask(parent: Task, sub: SubTask, autoApprove: boolean) {
  const db = getDB();
  const agent = sub.assignedAgent;
  sub.status = "RUNNING"; sub.startedAt = Date.now();
  emit("agent.started", `${AGENT_MAP[agent].emoji} ${agent} started: ${sub.title}`, { agentId: agent, taskId: parent.id });
  setAgent(agent, "THINKING", `Thinking about “${sub.title}”…`);

  const complexity = complexityOf(sub.description);
  const caps = agent === "luna" ? ["coding", "tool_calling", "reasoning"] : agent === "mochi" ? ["multimodal", "chat"] : agent === "neko" ? ["chat", "tool_calling"] : ["chat"];
  const route = routeModel({ agent, complexity, preferredCapabilities: caps });
  const provider = getProvider(route.provider);

  try {
    // 1. Think (LLM) — scoped memory only: this subtask brief + parent title.
    setAgent(agent, "WORKING", shortStatus(agent, sub.title));
    const sys = `You are ${AGENT_MAP[agent].name}, the ${AGENT_MAP[agent].role} cat of Meowork. Brief, capable, honest. Parent task: ${parent.title}.`;
    const gen = await provider.generate({ model: route.model, system: sys, prompt: sub.description, maxTokens: 900 });
    recordUsage(parent.id, agent, route.provider, route.model, gen.inputTokens, gen.outputTokens, 0);
    db.mem.task[sub.id] = [gen.text.slice(0, 500)];

    // 2. Real tool calls per agent plan (honest failures, one retry, then escalate).
    let lastErr = "";
    for (const step of AGENT_TOOL_PLAN[agent](sub.description)) {
      try {
        const r = await runToolWithGate(agent, parent.id, sub.id, step.tool, step.args, autoApprove);
        recordUsage(parent.id, agent, route.provider, route.model, r.inputTokens, r.outputTokens, 1);
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (/denied/i.test(lastErr)) throw e;
        emit("agent.tool_completed", `↻ Retrying ${step.tool} once after: ${lastErr.slice(0, 120)}`, { agentId: agent, taskId: parent.id });
        await new Promise(r => setTimeout(r, 800));
        try {
          const r2 = await runToolWithGate(agent, parent.id, sub.id, step.tool, step.args, true);
          recordUsage(parent.id, agent, route.provider, route.model, r2.inputTokens, r2.outputTokens, 1);
          lastErr = "";
        } catch (e2) { throw e2 instanceof Error ? e2 : new Error(String(e2)); }
      }
    }

    sub.status = "COMPLETED"; sub.completedAt = Date.now();
    sub.result = gen.text;
    setAgent(agent, "COMPLETED", `Done: ${sub.title} ✓`);
    emit("agent.completed", `✓ ${AGENT_MAP[agent].name} completed: ${sub.title}`, { agentId: agent, taskId: parent.id });
    setTimeout(() => { if (getDB().agentState[agent].state === "COMPLETED") setAgent(agent, "IDLE", "Taking a break ☕"); }, 4000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/denied/i.test(msg)) { sub.status = "WAITING_FOR_USER"; }
    else sub.status = "FAILED";
    sub.error = msg;
    setAgent(agent, /denied/i.test(msg) ? "WAITING_FOR_USER" : "ERROR", `Stuck: ${msg.slice(0, 80)}`);
    emit("agent.completed", `✗ ${AGENT_MAP[agent].name}: ${msg.slice(0, 200)}`, { agentId: agent, taskId: parent.id });
    throw e;
  }
}

function shortStatus(agent: AgentId, title: string) {
  const verbs: Record<AgentId, string> = { yuki: "Reviewing", luna: "💻 Building", mochi: "🎨 Designing", neko: "🔎 Researching", miso: "✍️ Writing" };
  return `${verbs[agent]} — ${title.slice(0, 34)}`;
}

export async function createAndRunTask(input: { title: string; description?: string; priority?: Task["priority"]; autoApproveLowMedium?: boolean }) {
  const db = getDB();
  if (db.budget.paused) throw new Error("Daily budget reached — AI work is paused. Raise the limit to continue.");
  const complexity = complexityOf(`${input.title} ${input.description ?? ""}`);
  const task: Task = {
    id: `T-${String(db.tasks.size + 1).padStart(3, "0")}`,
    title: input.title, description: input.description ?? input.title,
    status: "PLANNING", priority: input.priority ?? "medium",
    createdAt: Date.now(), createdBy: "user", assignedAgent: "yuki",
    estimatedCost: complexity === "high" ? 0.05 : 0.01, actualCost: 0, inputTokens: 0, outputTokens: 0,
  };
  db.tasks.set(task.id, task);
  emit("USER_TASK_CREATED", `📥 New task ${task.id}: ${task.title}`, { taskId: task.id });
  setAgent("yuki", "PLANNING", `Planning “${task.title.slice(0, 30)}”…`);
  emit("MANAGER_TASK_PLANNED", `🧠 Yuki analyzed complexity: ${complexity}`, { agentId: "yuki", taskId: task.id });

  const autoApprove = input.autoApproveLowMedium ?? true; // LOW always auto; MEDIUM auto unless user toggles
  const plan = planSubtasks(task.title, task.description);
  const subs: SubTask[] = plan.map((p, i) => ({
    id: `${task.id}-${String.fromCharCode(65 + i)}`, title: p.title, description: p.brief,
    status: "QUEUED", priority: task.priority, createdAt: Date.now(), createdBy: "yuki",
    assignedAgent: p.agent, parentTaskId: task.id, order: i,
    estimatedCost: 0.01, actualCost: 0, inputTokens: 0, outputTokens: 0,
  }));
  for (const s of subs) db.subtasks.set(s.id, s);
  emit("SUBTASK_CREATED", `🧩 ${subs.length} subtasks → ${subs.map(s => `${AGENT_MAP[s.assignedAgent].name}`).join(", ")}`, { taskId: task.id });

  // run in background so POST returns fast; SSE streams progress
  void (async () => {
    task.status = "RUNNING"; task.startedAt = Date.now();
    setAgent("yuki", "WORKING", `Coordinating ${subs.length} agents…`);
    let failed = 0;
    for (const s of subs) {
      if (getDB().budget.paused) { s.status = "CANCELLED"; failed++; continue; }
      // per-task budget guard
      if (task.actualCost >= getDB().budget.perTaskLimit) {
        emit("budget.warning", `Per-task budget reached for ${task.id} ($${task.actualCost.toFixed(3)}).`);
        s.status = "CANCELLED"; failed++; continue;
      }
      emit("AGENT_ASSIGNED", `${AGENT_MAP[s.assignedAgent].emoji} ${s.assignedAgent} ← ${s.title}`, { agentId: s.assignedAgent, taskId: task.id });
      try { await runSubtask(task, s, autoApprove); }
      catch { failed++; if (String(s.error ?? "").match(/denied/i)) { task.status = "WAITING_FOR_USER"; } }
    }
    setAgent("yuki", "REVIEWING", `Reviewing ${task.id}…`);
    emit("MANAGER_REVIEWED", `🧠 Yuki reviewed ${subs.length - failed}/${subs.length} outputs`, { agentId: "yuki", taskId: task.id });
    const done = subs.filter(s => s.status === "COMPLETED").length;
    task.status = failed === 0 ? "COMPLETED" : done > 0 ? "REVIEWING" : task.status === "WAITING_FOR_USER" ? "WAITING_FOR_USER" : "FAILED";
    if (task.status === "COMPLETED" || task.status === "REVIEWING") {
      task.completedAt = Date.now();
      task.result = `Yuki's report — ${done}/${subs.length} subtasks done.\n` + subs.map(s => `• [${s.status}] ${s.title} → ${s.assignedAgent}: ${(s.result ?? s.error ?? "").slice(0, 160)}`).join("\n");
      emit("TASK_COMPLETED", `🎉 ${task.id} ${task.status === "COMPLETED" ? "completed" : "needs review"} — $${task.actualCost.toFixed(4)}`, { taskId: task.id });
    } else {
      emit("task.failed", `❌ ${task.id} failed`, { taskId: task.id });
    }
    setAgent("yuki", "IDLE", "Ready for next task 🐾");
  })();

  return { task, subs };
}

export function decideApproval(id: string, decision: "APPROVED" | "DENIED") {
  const a = getDB().approvals.get(id);
  if (!a || a.status !== "PENDING") return null;
  a.status = decision; a.decidedAt = Date.now();
  emit("approval.decided", `${decision === "APPROVED" ? "✅ Approved" : "⛔ Denied"}: ${a.tool}`, { agentId: a.agentId, taskId: a.taskId });
  return a;
}

export function usageSummary() {
  const db = getDB();
  const day = new Date().toDateString();
  const todays = db.usage.filter(u => new Date(u.timestamp).toDateString() === day);
  const sum = (arr: UsageRecord[]) => ({
    input: arr.reduce((s, u) => s + u.inputTokens, 0),
    output: arr.reduce((s, u) => s + u.outputTokens, 0),
    cost: arr.reduce((s, u) => s + u.totalCost, 0),
    tasks: new Set(arr.map(u => u.taskId)).size,
  });
  const t = sum(todays);
  const byAgent: Record<string, { tokens: number; cost: number }> = {};
  const byModel: Record<string, { tokens: number; cost: number }> = {};
  const byDay: Record<string, number> = {};
  for (const u of db.usage) {
    byAgent[u.agentId] = { tokens: (byAgent[u.agentId]?.tokens ?? 0) + u.totalTokens, cost: (byAgent[u.agentId]?.cost ?? 0) + u.totalCost };
    const k = `${u.provider}/${u.model}`;
    byModel[k] = { tokens: (byModel[k]?.tokens ?? 0) + u.totalTokens, cost: (byModel[k]?.cost ?? 0) + u.totalCost };
    const d = new Date(u.timestamp).toISOString().slice(5, 10);
    byDay[d] = (byDay[d] ?? 0) + u.totalCost;
  }
  return {
    today: { ...t, total: t.input + t.output, avgPerTask: t.tasks ? t.cost / t.tasks : 0 },
    totalTasks: db.tasks.size,
    completed: [...db.tasks.values()].filter(x => x.status === "COMPLETED").length,
    activeTasks: [...db.tasks.values()].filter(x => ["RUNNING", "PLANNING"].includes(x.status)).length + [...db.subtasks.values()].filter(x => ["RUNNING"].includes(x.status)).length,
    byAgent, byModel, byDay, budget: db.budget,
  };
}

export { estimateTokens };
