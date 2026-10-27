import type { Workspace } from './model'

const DATABASE = 'daystar-offline-workspace'
const VERSION = 1
const STORE = 'snapshots'
const LAST_SCOPE = 'last-active-scope'

export type OfflineSnapshot = {
  scope: string
  revision: number
  data: Workspace
  savedAt: string
  pending: boolean
}

export function syncDecision(
  snapshot: OfflineSnapshot | null,
  scope: string,
  revision: number,
): 'none' | 'sync' | 'conflict' | 'different-workspace' {
  if (!snapshot?.pending) return 'none'
  if (snapshot.scope !== scope) return 'different-workspace'
  return snapshot.revision === revision ? 'sync' : 'conflict'
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined')
    return Promise.reject(new Error('Offline storage is not available here.'))
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE))
        database.createObjectStore(STORE, { keyPath: 'scope' })
      if (!database.objectStoreNames.contains('settings'))
        database.createObjectStore('settings')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Storage failed.'))
    request.onblocked = () =>
      reject(new Error('Close another DAYSTAR tab to update offline storage.'))
  })
}

export async function readSnapshot(
  scope?: string,
): Promise<OfflineSnapshot | null> {
  const db = await openDatabase()
  try {
    const key = scope ?? (await readLastScope(db))
    if (!key) return null
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE, 'readonly')
        .objectStore(STORE)
        .get(key)
      request.onsuccess = () =>
        resolve((request.result as OfflineSnapshot | undefined) ?? null)
      request.onerror = () =>
        reject(request.error ?? new Error('Could not read offline workspace.'))
    })
  } finally {
    db.close()
  }
}

export async function writeSnapshot(snapshot: OfflineSnapshot): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, 'settings'], 'readwrite')
      tx.objectStore(STORE).put(snapshot)
      tx.objectStore('settings').put(snapshot.scope, LAST_SCOPE)
      tx.oncomplete = () => resolve()
      tx.onerror = () =>
        reject(tx.error ?? new Error('Could not save offline workspace.'))
      tx.onabort = () =>
        reject(tx.error ?? new Error('Offline save was interrupted.'))
    })
  } finally {
    db.close()
  }
}

export async function removePendingSnapshot(scope: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, 'settings'], 'readwrite')
      const store = tx.objectStore(STORE)
      const settings = tx.objectStore('settings')
      store.delete(scope)
      const last = settings.get(LAST_SCOPE)
      last.onsuccess = () => {
        if (last.result === scope) settings.delete(LAST_SCOPE)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () =>
        reject(tx.error ?? new Error('Could not clear the offline copy.'))
    })
  } finally {
    db.close()
  }
}

function readLastScope(db: IDBDatabase): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction('settings', 'readonly')
      .objectStore('settings')
      .get(LAST_SCOPE)
    request.onsuccess = () =>
      resolve((request.result as string | undefined) ?? null)
    request.onerror = () =>
      reject(
        request.error ??
          new Error('Could not read offline workspace settings.'),
      )
  })
}
