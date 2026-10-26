import { NextResponse } from "next/server";
import { listExecutions, usageSummary } from "@/lib/orchestrator";
import { recentEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ...usageSummary(), executions: listExecutions(), events: recentEvents(120).reverse() });
}
