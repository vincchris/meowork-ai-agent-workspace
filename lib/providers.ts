// Provider abstraction: AIProvider { generate, stream, toolCall, getUsage, getCost }
import { calcCost } from "./pricing";

export interface GenerateInput {
  model: string; system?: string; prompt: string;
  tools?: { name: string; description: string; parameters?: unknown }[];
  maxTokens?: number;
}
export interface GenerateOutput { text: string; inputTokens: number; outputTokens: number; toolCalls?: { name: string; args: Record<string, unknown> }[]; }

export interface AIProvider {
  id: string;
  generate(input: GenerateInput): Promise<GenerateOutput>;
  getCost(model: string, inputTokens: number, outputTokens: number): number;
}

export function estimateTokens(text: string): number {
  return Math.max(8, Math.ceil(text.length / 4));
}

// Deterministic offline provider — real execution path (no fake progress),
// produces role-aware outputs so the office works with zero API keys.
export class MockProvider implements AIProvider {
  id = "mock";
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const sys = (input.system ?? "").toLowerCase();
    const p = input.prompt;
    await new Promise(r => setTimeout(r, 350 + Math.random() * 500));
    let text = "";
    if (sys.includes("manager") || sys.includes("yuki")) {
      text = `PLAN for: "${p.slice(0, 160)}"\n- Step 1: research context\n- Step 2: design / structure\n- Step 3: implement draft\n- Step 4: write content\n- Step 5: review & finalize`;
    } else if (sys.includes("developer") || sys.includes("luna")) {
      text = `Implemented draft for: "${p.slice(0, 140)}"\n\nFiles touched: workspace/sandbox/output.md\nChecks: syntax OK, 2 tests passed (mock suite).\nNext: needs manager review.`;
    } else if (sys.includes("designer") || sys.includes("mochi")) {
      text = `Design spec — palette: cream #FFF9F2, blush #FFE9E3, cocoa #4A3F35; radius 16-24px; type Nunito.\nSections: hero, features, social proof, CTA, footer. Component specs included.`;
    } else if (sys.includes("research")) {
      text = `Research brief: 3 key findings + 2 competitor notes + sources.\nFinding: keep scope tight, ship one page first. (offline brief — connect QWEN_API_KEY for live web.)`;
    } else {
      text = `Draft for: "${p.slice(0, 160)}"\n\n# Draft\n\nContent written in a warm, concise tone. Ready for review.`;
    }
    const inputTokens = estimateTokens((input.system ?? "") + p);
    const outputTokens = estimateTokens(text);
    return { text, inputTokens, outputTokens };
  }
  getCost(model: string, i: number, o: number) { return calcCost("mock", model, i, o).totalCost; }
}

// Qwen via OpenAI-compatible Chat Completions + function calling.
export class QwenProvider implements AIProvider {
  id = "qwen";
  private base = process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  private key = process.env.QWEN_API_KEY || "";
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    if (!this.key) return new MockProvider().generate(input);
    const body: Record<string, unknown> = {
      model: input.model,
      messages: [
        ...(input.system ? [{ role: "system", content: input.system }] : []),
        { role: "user", content: input.prompt },
      ],
      max_tokens: input.maxTokens ?? 1200,
      temperature: 0.6,
    };
    if (input.tools?.length) {
      body.tools = input.tools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters ?? { type: "object", properties: {} } } }));
      body.tool_choice = "auto";
    }
    const res = await fetch(`${this.base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      // graceful fallback: mock output + surfaced error note
      const m = await new MockProvider().generate(input);
      return { ...m, text: `(Qwen ${res.status} — offline fallback)\n\n${m.text}\n\n[provider error: ${err.slice(0, 200)}]` };
    }
    const json = await res.json() as { choices?: { message?: { content?: string; tool_calls?: { function: { name: string; arguments: string } }[] } }[]; usage?: { prompt_tokens: number; completion_tokens: number } };
    const msg = json.choices?.[0]?.message;
    const text = msg?.content ?? "(empty response)";
    const toolCalls = (msg?.tool_calls ?? []).map(tc => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { args = {}; }
      return { name: tc.function.name, args };
    });
    const inputTokens = json.usage?.prompt_tokens ?? estimateTokens(input.prompt);
    const outputTokens = json.usage?.completion_tokens ?? estimateTokens(text);
    return { text, inputTokens, outputTokens, toolCalls };
  }
  getCost(model: string, i: number, o: number) { return calcCost("qwen", model, i, o).totalCost; }
}

export function getProvider(id: string): AIProvider {
  if (id === "qwen") return new QwenProvider();
  return new MockProvider();
}
