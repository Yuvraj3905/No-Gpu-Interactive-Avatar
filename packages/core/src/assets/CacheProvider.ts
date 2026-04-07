const DB_NAME = 'low-cost-avatar-cache'
const DB_VERSION = 1
const STORE_NAME = 'assets'

export class CacheProvider {
  private db: IDBDatabase | null = null
  private memoryFallback = new Map<string, ArrayBuffer>()
  private useMemory = false
  private initPromise: Promise<void> | null = null

  constructor() {
    this.initPromise = this.init()
  }

  private async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.useMemory = true
      return
    }
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } catch {
      this.useMemory = true
    }
  }

  async get(key: string): Promise<ArrayBuffer | undefined> {
    await this.initPromise
    if (this.useMemory) {
      return this.memoryFallback.get(key)
    }
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result ?? undefined)
      request.onerror = () => resolve(undefined)
    })
  }

  async set(key: string, data: ArrayBuffer): Promise<void> {
    await this.initPromise
    if (this.useMemory) {
      this.memoryFallback.set(key, data)
      return
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(data, key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async delete(key: string): Promise<void> {
    await this.initPromise
    if (this.useMemory) {
      this.memoryFallback.delete(key)
      return
    }
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    })
  }

  async has(key: string): Promise<boolean> {
    const result = await this.get(key)
    return result !== undefined
  }
}
