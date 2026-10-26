import { NextResponse } from "next/server";
import { getStates } from "@/lib/orchestrator";
import { AGENTS } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function GET() {
  const states = getStates();
  return NextResponse.json({ agents: AGENTS.map(a => ({ ...a, ...states[a.id] })) });
}
