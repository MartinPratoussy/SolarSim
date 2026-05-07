type EventMap = {
  'edu:collision': { survivor: unknown };
  'edu:ejected': { body: unknown };
  'edu:blackhole': Record<string, never>;
  'edu:tidalforce': Record<string, never>;
  'select:body': { body: unknown };
  'select:none': Record<string, never>;
};

type Handler<K extends keyof EventMap> = (data: EventMap[K]) => void;

class TypedEventBus {
  private listeners: { [K in keyof EventMap]?: Handler<K>[] } = {};

  on<K extends keyof EventMap>(event: K, handler: Handler<K>) {
    if (!this.listeners[event]) this.listeners[event] = [];
    (this.listeners[event] as Handler<K>[]).push(handler);
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<K>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.listeners[event] = (this.listeners[event] as any)?.filter((h: Handler<K>) => h !== handler);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]) {
    (this.listeners[event] as Handler<K>[])?.forEach(h => h(data));
  }
}

export const EventBus = new TypedEventBus();
