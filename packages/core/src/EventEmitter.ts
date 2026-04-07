export class EventEmitter<TEventMap extends Record<string, unknown[]>> {
  private listeners = new Map<keyof TEventMap, Set<(...args: unknown[]) => void>>()

  on<K extends keyof TEventMap>(event: K, listener: (...args: TEventMap[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener as (...args: unknown[]) => void)
  }

  off<K extends keyof TEventMap>(event: K, listener: (...args: TEventMap[K]) => void): void {
    this.listeners.get(event)?.delete(listener as (...args: unknown[]) => void)
  }

  emit<K extends keyof TEventMap>(event: K, ...args: TEventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(...args)
      } catch (err) {
        console.error(`Error in ${String(event)} listener:`, err)
      }
    })
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }
}
