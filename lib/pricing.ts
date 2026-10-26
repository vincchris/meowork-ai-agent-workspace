// Centralized model pricing — UI must NEVER hardcode prices. Import from here.
export interface ModelPricing {
  provider: string; model: string;
  inputPricePerMillion: number; outputPricePerMillion: number;
  cacheInputPricePerMillion?: number;
  capabilities: string[]; effectiveFrom: string; effectiveUntil?: string;
}

// Prices are configurable placeholders (USD per 1M tokens). Update without touching logic.
export const MODEL_CATALOG: ModelPricing[] = [
  { provider: "qwen", model: "qwen-flash", inputPricePerMillion: 0.10, outputPricePerMillion: 0.30, capabilities: ["chat", "tool_calling", "fast"], effectiveFrom: "2026-01-01" },
  { provider: "qwen", model: "qwen-plus", inputPricePerMillion: 0.40, outputPricePerMillion: 1.20, capabilities: ["chat", "tool_calling", "reasoning", "coding"], effectiveFrom: "2026-01-01" },
  { provider: "qwen", model: "qwen-max", inputPricePerMillion: 1.20, outputPricePerMillion: 3.60, capabilities: ["chat", "tool_calling", "reasoning", "coding", "strong"], effectiveFrom: "2026-01-01" },
  { provider: "qwen", model: "qwen-vl-plus", inputPricePerMillion: 0.80, outputPricePerMillion: 2.40, capabilities: ["chat", "multimodal", "vision"], effectiveFrom: "2026-01-01" },
  { provider: "deepseek", model: "deepseek-chat", inputPricePerMillion: 0.27, outputPricePerMillion: 1.10, capabilities: ["chat", "tool_calling", "coding", "reasoning"], effectiveFrom: "2026-01-01" },
  { provider: "kimi", model: "moonshot-v1-8k", inputPricePerMillion: 0.50, outputPricePerMillion: 1.50, capabilities: ["chat", "long_context"], effectiveFrom: "2026-01-01" },
  { provider: "glm", model: "glm-4-flash", inputPricePerMillion: 0.10, outputPricePerMillion: 0.10, capabilities: ["chat", "fast", "tool_calling"], effectiveFrom: "2026-01-01" },
  { provider: "local", model: "ollama-llama3.1-8b", inputPricePerMillion: 0, outputPricePerMillion: 0, capabilities: ["chat", "private", "offline"], effectiveFrom: "2026-01-01" },
  { provider: "mock", model: "mock-planner-v1", inputPricePerMillion: 0.05, outputPricePerMillion: 0.10, capabilities: ["chat", "tool_calling", "offline"], effectiveFrom: "2026-01-01" },
];

export function getPricing(provider: string, model: string): ModelPricing {
  const hit = MODEL_CATALOG.find(m => m.provider === provider && m.model === model);
  if (hit) return hit;
  // fallback: cheapest mock pricing so cost tracking never crashes
  return { provider, model, inputPricePerMillion: 0.20, outputPricePerMillion: 0.60, capabilities: ["chat"], effectiveFrom: "2026-01-01" };
}

export function calcCost(provider: string, model: string, inputTokens: number, outputTokens: number) {
  const p = getPricing(provider, model);
  const inputCost = (inputTokens / 1_000_000) * p.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * p.outputPricePerMillion;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}

// --- Model router: configurable, capability-based ---
export interface RouteRequest { agent: string; complexity: "low" | "medium" | "high"; preferredCapabilities: string[]; }
export function routeModel(req: RouteRequest): { provider: string; model: string } {
  const { agent, complexity, preferredCapabilities } = req;
  const needs = new Set(preferredCapabilities);
  const score = (m: ModelPricing) => {
    let s = 0;
    for (const c of Array.from(needs)) if (m.capabilities.includes(c)) s += 10;
    if (complexity === "low" && m.capabilities.includes("fast")) s += 5;
    if (complexity === "high" && m.capabilities.includes("strong")) s += 5;
    if (agent === "developer" && m.capabilities.includes("coding")) s += 4;
    if (agent === "researcher" && m.capabilities.includes("tool_calling")) s += 2;
    if (agent === "designer" && m.capabilities.includes("multimodal")) s += 4;
    if (agent === "manager" && m.capabilities.includes("reasoning")) s += 4;
    s -= (m.inputPricePerMillion + m.outputPricePerMillion) / 10; // prefer cheaper on ties
    return s;
  };
  // Prefer real Qwen models when a key is configured; otherwise mock.
  const hasQwen = !!process.env.QWEN_API_KEY;
  const pool = MODEL_CATALOG.filter(m => hasQwen ? m.provider === "qwen" : true);
  const best = [...pool].sort((a, b) => score(b) - score(a))[0] ?? MODEL_CATALOG[0];
  return { provider: best.provider, model: best.model };
}
