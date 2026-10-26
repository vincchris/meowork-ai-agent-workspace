import { NextRequest, NextResponse } from "next/server";
import { decideApproval, listApprovals } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json({ approvals: listApprovals() }); }

export async function POST(req: NextRequest) {
  const { id, decision } = await req.json();
  const a = decideApproval(String(id), decision === "DENIED" ? "DENIED" : "APPROVED");
  if (!a) return NextResponse.json({ error: "approval not found or already decided" }, { status: 404 });
  return NextResponse.json({ approval: a });
}
