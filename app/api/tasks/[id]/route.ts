import { NextResponse } from "next/server";
import { getTaskDetail } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const d = getTaskDetail(decodeURIComponent(params.id));
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(d);
}
