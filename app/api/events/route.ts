import { recentEvents, subscribe } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(`: connected\n\n`));
      for (const e of recentEvents(30)) controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      const off = subscribe((e) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch { /* closed */ }
      });
      const keep = setInterval(() => { try { controller.enqueue(enc.encode(`: ping\n\n`)); } catch { clearInterval(keep); } }, 20000);
      // cleanup handled on cancel below
      (controller as unknown as { _off?: () => void })._off = () => { clearInterval(keep); off(); };
    },
    cancel(reason) { void reason; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
