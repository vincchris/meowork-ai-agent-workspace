import { NextRequest, NextResponse } from "next/server";
import { getBudget, setBudget } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json({ budget: getBudget() }); }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const b = setBudget({
    ...(body.dailyLimit !== undefined ? { dailyLimit: Number(body.dailyLimit) } : {}),
    ...(body.monthlyLimit !== undefined ? { monthlyLimit: Number(body.monthlyLimit) } : {}),
    ...(body.perTaskLimit !== undefined ? { perTaskLimit: Number(body.perTaskLimit) } : {}),
    ...(body.paused !== undefined ? { paused: Boolean(body.paused) } : {}),
    ...(body.resetSpend ? { todaySpent: 0, monthSpent: 0, paused: false } : {}),
  });
  return NextResponse.json({ budget: b });
}
