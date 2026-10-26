// Event hub for SSE: office UI subscribes to live backend activity.
import type { ActivityEvent } from "./types";

type Listener = (e: ActivityEvent) => void;
const listeners = new Set<Listener>();
const history: ActivityEvent[] = [];
const MAX = 300;

export function emit(type: ActivityEvent["type"], message: string, extra?: Partial<ActivityEvent>) {
  const e: ActivityEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(), type, message, ...extra,
  };
  history.push(e); if (history.length > MAX) history.shift();
  listeners.forEach((l) => { try { l(e); } catch { /* noop */ } });
  return e;
}
export function subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function recentEvents(n = 80) { return history.slice(-n); }
