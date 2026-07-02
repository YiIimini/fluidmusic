// ============================================================
// FluidMusic — EventBus: pub/sub event system
// ============================================================

type EventHandler = (...args: any[]) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  once(event: string, handler: EventHandler): void {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      handler(...args);
    };
    this.on(event, wrapper);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, data?: any): void {
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (e) {
        console.error('[EventBus]', event, e);
      }
    });
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
