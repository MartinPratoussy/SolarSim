export type EventMap = {
  'scale:complete': { scale: number };
  'scale:change': { scale: number };
  'scale:ready': { scale: number };   // goal met — waiting for user to continue
  'toast': { title: string; body: string };
  'edu:update': { title: string; body: string; hint?: string };
  'edu:event': { text: string };
  'progress': { value: number };
};

type EventKey = keyof EventMap;
type Listener<K extends EventKey> = (payload: EventMap[K]) => void;

class TypedEventBus {
  private listeners = new Map<EventKey, Set<Listener<EventKey>>>();

  on<K extends EventKey>(event: K, listener: Listener<K>): () => void {
    const bucket = this.listeners.get(event) ?? new Set<Listener<EventKey>>();
    bucket.add(listener as Listener<EventKey>);
    this.listeners.set(event, bucket);
    return () => this.off(event, listener);
  }

  off<K extends EventKey>(event: K, listener: Listener<K>): void {
    const bucket = this.listeners.get(event);
    bucket?.delete(listener as Listener<EventKey>);
    if (bucket && bucket.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<K extends EventKey>(event: K, payload: EventMap[K]): void {
    const bucket = this.listeners.get(event);
    if (!bucket) {
      return;
    }
    for (const listener of bucket) {
      (listener as Listener<K>)(payload);
    }
  }
}

export const EventBus = new TypedEventBus();
