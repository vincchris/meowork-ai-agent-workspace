// Meowork core types — mirrors Prisma entities (see prisma/schema.prisma)
export type AgentId = "luna" | "mochi" | "neko" | "miso" | "yuki";
export type AgentState =
  | "IDLE" | "THINKING" | "PLANNING" | "WORKING"
  | "WAITING_FOR_TOOL" | "WAITING_FOR_USER" | "REVIEWING" | "ERROR" | "COMPLETED";
export type TaskStatus =
  | "QUEUED" | "PLANNING" | "RUNNING" | "WAITING_FOR_USER" | "REVIEWING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type MemoryScope = "SHORT_TERM" | "TASK_MEMORY" | "PROJECT_MEMORY" | "USER_PREFERENCE";

export interface AgentDef {
  id: AgentId; name: string; emoji: string; role: string;
  description: string; tools: string[]; color: string; desk: number;
}

export interface Task {
  id: string; title: string; description: string;
  status: TaskStatus; priority: "low" | "medium" | "high";
  createdAt: number; startedAt?: number; completedAt?: number;
  createdBy: string; assignedAgent: AgentId;
  parentTaskId?: string; estimatedCost: number; actualCost: number;
  inputTokens: number; outputTokens: number;
  result?: string; error?: string;
}

export interface SubTask extends Task { parentTaskId: string; order: number }

export interface ToolDef {
  name: string; description: string; risk: RiskLevel;
  agentAllow: AgentId[]; needsApproval: boolean;
}

export interface ToolExecution {
  id: string; taskId: string; subtaskId?: string; agentId: AgentId;
  tool: string; args: Record<string, unknown>;
  startedAt: number; endedAt?: number; ok?: boolean;
  outputPreview?: string; error?: string; inputTokens: number; outputTokens: number;
}

export interface UsageRecord {
  id: string; taskId: string; agentId: AgentId;
  provider: string; model: string;
  inputTokens: number; outputTokens: number; totalTokens: number;
  inputCost: number; outputCost: number; totalCost: number;
  toolCalls: number; timestamp: number;
}

export interface ApprovalRequest {
  id: string; taskId: string; subtaskId?: string; agentId: AgentId;
  tool: string; commandPreview: string; risk: RiskLevel;
  status: "PENDING" | "APPROVED" | "DENIED"; createdAt: number; decidedAt?: number;
}

export interface ActivityEvent {
  id: string; ts: number; type: string;
  agentId?: AgentId; taskId?: string; message: string; data?: unknown;
}

export interface BudgetState {
  dailyLimit: number; monthlyLimit: number; perTaskLimit: number;
  todaySpent: number; monthSpent: number; paused: boolean;
}
