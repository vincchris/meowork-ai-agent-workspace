import type { AgentDef } from "./types";

export const AGENTS: AgentDef[] = [
  { id: "yuki", name: "Yuki", emoji: "🧠", role: "Manager", description: "Plans, delegates, reviews. Doesn't do specialist work itself.", tools: ["plan_task", "review_output"], color: "#E8DEF8", desk: 0 },
  { id: "luna", name: "Luna", emoji: "🐱", role: "Developer", description: "Coding, debugging, APIs, tests, files.", tools: ["read_file", "write_file", "edit_file", "search_code", "run_command", "run_tests", "inspect_project"], color: "#DDEBFF", desk: 1 },
  { id: "mochi", name: "Mochi", emoji: "🎨", role: "Designer", description: "UI/UX, design systems, landing pages.", tools: ["analyze_screenshot", "generate_design_spec", "generate_component_spec"], color: "#FFE9E3", desk: 2 },
  { id: "neko", name: "Neko", emoji: "🔎", role: "Researcher", description: "Web research, competitors, summaries.", tools: ["web_search", "open_url", "extract_content", "summarize", "save_research"], color: "#D9F2E6", desk: 3 },
  { id: "miso", name: "Miso", emoji: "✍️", role: "Writer", description: "Docs, blogs, copy, SEO.", tools: ["create_document", "edit_document", "format_document", "export_markdown"], color: "#FFF3C4", desk: 4 },
];

export const AGENT_MAP: Record<string, AgentDef> = Object.fromEntries(AGENTS.map(a => [a.id, a]));
