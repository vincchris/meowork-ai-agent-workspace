import { NextRequest, NextResponse } from "next/server";
import { createAndRunTask, listSubtasks, listTasks } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function GET() {
  const tasks = listTasks().map(t => ({ ...t, subtasks: listSubtasks(t.id) }));
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
    const { task, subs } = await createAndRunTask({
      title, description: String(body.description ?? title),
      priority: body.priority ?? "medium",
      autoApproveLowMedium: body.autoApproveLowMedium ?? true,
    });
    return NextResponse.json({ task, subs }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 429 });
  }
}
