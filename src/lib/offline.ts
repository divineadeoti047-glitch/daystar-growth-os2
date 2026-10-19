import { z } from 'zod'
import {
  initialWorkspace,
  preserveHistory,
  putOccurrence,
  scheduled,
  taskSchema,
  workspaceSchema,
} from './model'
import type { Occurrence, Task, Workspace } from './model'

const databaseName = 'daystar-private-offline'
const databaseVersion = 1
const snapshotsStore = 'snapshots'
const changesStore = 'changes'
const metadataStore = 'metadata'

const operationBase = {
  id: z.string().min(1).max(100),
  scope: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
}
const occurrenceSchema = z.object({
  id: z.string().min(1).max(120),
  taskId: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  snapshot: taskSchema,
  status: z.enum(['open', 'completed', 'skipped']),
  entries: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        value: z.number().finite().positive().max(1000000),
        at: z.string().datetime(),
      }),
    )
    .max(1000),
})

const offlineOperationSchema = z.discriminatedUnion('kind', [
  z.object({
    ...operationBase,
    kind: z.literal('task-save'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    task: taskSchema,
    baseTask: taskSchema.nullable(),
  }),
  z.object({
    ...operationBase,
    kind: z.literal('occurrence-status'),
    occurrenceId: z.string().min(1).max(120),
    baseOccurrence: occurrenceSchema,
    baseStatus: z.enum(['open', 'completed', 'skipped']),
    status: z.enum(['open', 'completed', 'skipped']),
  }),
  z.object({
    ...operationBase,
    kind: z.literal('progress-entry'),
    occurrenceId: z.string().min(1).max(120),
    baseOccurrence: occurrenceSchema,
    entry: z.object({
      id: z.string().min(1).max(100),
      value: z.number().finite().positive().max(1000000),
      at: z.string().datetime(),
    }),
  }),
  z.object({
    ...operationBase,
    kind: z.literal('progress-remove'),
    occurrenceId: z.string().min(1).max(120),
    baseOccurrence: occurrenceSchema,
    entryId: z.string().min(1).max(100),
  }),
])

export type OfflineOperation = z.infer<typeof offlineOperationSchema>

export type OfflineSnapshot = {
  scope: string
  mode: 'account' | 'device'
  revision: number
  workspace: Workspace
  savedAt: string
}

export type OfflineConflict = {
  operationId: string
  kind: OfflineOperation['kind']
  summary: string
  currentTask?: Task | null
  currentStatus?: Occurrence['status']
}

export type OfflineApplyResult = {
  workspace: Workspace
  appliedIds: string[]
  conflicts: OfflineConflict[]
  writeRequired: boolean
}

type SnapshotRecord = OfflineSnapshot
type MetadataRecord = { key: string; value: string }

let databasePromise: Promise<IDBDatabase> | undefined

function openDatabase() {
  if (typeof indexedDB === 'undefined')
    return Promise.reject(new Error('This browser does not support offline storage.'))
  if (databasePromise) return databasePromise

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(snapshotsStore))
        database.createObjectStore(snapshotsStore, { keyPath: 'scope' })
      if (!database.objectStoreNames.contains(changesStore)) {
        const changes = database.createObjectStore(changesStore, {
          keyPath: 'id',
        })
        changes.createIndex('scope', 'scope', { unique: false })
      }
      if (!database.objectStoreNames.contains(metadataStore))
        database.createObjectStore(metadataStore, { keyPath: 'key' })
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => {
      databasePromise = undefined
      reject(request.error ?? new Error('Could not open offline storage.'))
    }
    request.onblocked = () => {
      databasePromise = undefined
      reject(new Error('Offline storage is open in another tab. Close that tab and retry.'))
    }
  })

  return databasePromise
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Offline storage failed.'))
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Offline storage was interrupted.'))
  })
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Offline storage could not be read.'))
  })
}

export function taskOnlyWorkspace(workspace: Workspace): Workspace {
  return workspaceSchema.parse({
    ...initialWorkspace(),
    tasks: workspace.tasks,
    occurrences: workspace.occurrences,
    areas: workspace.areas,
    preferences: workspace.preferences,
  })
}

export async function accountScope(userId: string) {
  const bytes = new TextEncoder().encode(`user:${userId}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function saveOfflineSnapshot(snapshot: OfflineSnapshot) {
  const database = await openDatabase()
  const transaction = database.transaction(
    [snapshotsStore, metadataStore],
    'readwrite',
  )
  const done = transactionDone(transaction)
  transaction.objectStore(snapshotsStore).put({
    ...snapshot,
    workspace: taskOnlyWorkspace(snapshot.workspace),
  } satisfies SnapshotRecord)
  if (snapshot.mode === 'device')
    transaction.objectStore(metadataStore).put({
      key: 'deviceScope',
      value: snapshot.scope,
    } satisfies MetadataRecord)
  try {
    await done
  } finally {
    database.close()
    databasePromise = undefined
  }
}

export async function readOfflineSnapshot(scope: string) {
  const database = await openDatabase()
  const transaction = database.transaction(snapshotsStore, 'readonly')
  const done = transactionDone(transaction)
  try {
    const row = await requestValue<SnapshotRecord | undefined>(
      transaction.objectStore(snapshotsStore).get(scope),
    )
    await done
    if (!row || row.scope !== scope) return null
    return {
      ...row,
      workspace: workspaceSchema.parse(row.workspace),
    } satisfies OfflineSnapshot
  } finally {
    database.close()
    databasePromise = undefined
  }
}

export async function readDeviceScope() {
  const database = await openDatabase()
  const transaction = database.transaction(metadataStore, 'readonly')
  const done = transactionDone(transaction)
  try {
    const row = await requestValue<MetadataRecord | undefined>(
      transaction.objectStore(metadataStore).get('deviceScope'),
    )
    await done
    return row?.value
  } finally {
    database.close()
    databasePromise = undefined
  }
}

export async function queueOfflineOperation(
  snapshot: OfflineSnapshot,
  operation: OfflineOperation,
) {
  const validated = offlineOperationSchema.parse(operation)
  if (validated.scope !== snapshot.scope)
    throw new Error('The offline change belongs to a different workspace.')
  const database = await openDatabase()
  const transaction = database.transaction(
    [snapshotsStore, changesStore, metadataStore],
    'readwrite',
  )
  const done = transactionDone(transaction)
  transaction.objectStore(snapshotsStore).put({
    ...snapshot,
    workspace: taskOnlyWorkspace(snapshot.workspace),
  } satisfies SnapshotRecord)
  transaction.objectStore(changesStore).put(validated)
  if (snapshot.mode === 'device')
    transaction.objectStore(metadataStore).put({
      key: 'deviceScope',
      value: snapshot.scope,
    } satisfies MetadataRecord)
  try {
    await done
  } finally {
    database.close()
    databasePromise = undefined
  }
}

export async function listOfflineOperations(scope: string) {
  const database = await openDatabase()
  const transaction = database.transaction(changesStore, 'readonly')
  const done = transactionDone(transaction)
  try {
    const records = await requestValue<unknown[]>(
      transaction.objectStore(changesStore).index('scope').getAll(scope),
    )
    await done
    return records
      .map((record) => offlineOperationSchema.parse(record))
      .filter((operation) => operation.scope === scope)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } finally {
    database.close()
    databasePromise = undefined
  }
}

export async function removeOfflineOperations(
  scope: string,
  ids: string[],
) {
  if (!ids.length) return
  const database = await openDatabase()
  const transaction = database.transaction(changesStore, 'readwrite')
  const done = transactionDone(transaction)
  const store = transaction.objectStore(changesStore)
  for (const id of ids) {
    const request = store.get(id)
    request.onsuccess = () => {
      const current = request.result as OfflineOperation | undefined
      if (current?.scope === scope) store.delete(id)
    }
  }
  try {
    await done
  } finally {
    database.close()
    databasePromise = undefined
  }
}

export async function rebaseOfflineOperation(
  scope: string,
  conflict: OfflineConflict,
) {
  const database = await openDatabase()
  const transaction = database.transaction(changesStore, 'readwrite')
  const done = transactionDone(transaction)
  const store = transaction.objectStore(changesStore)
  const request = store.get(conflict.operationId)
  request.onsuccess = () => {
    const parsed = offlineOperationSchema.safeParse(request.result)
    if (!parsed.success || parsed.data.scope !== scope) return
    const operation = parsed.data
    if (operation.kind === 'task-save' && conflict.kind === 'task-save')
      store.put({ ...operation, baseTask: conflict.currentTask ?? null })
    else if (
      operation.kind === 'occurrence-status' &&
      conflict.kind === 'occurrence-status' &&
      conflict.currentStatus
    )
      store.put({ ...operation, baseStatus: conflict.currentStatus })
  }
  try {
    await done
  } finally {
    database.close()
    databasePromise = undefined
  }
}

export async function clearOfflineData(scope: string) {
  const database = await openDatabase()
  const transaction = database.transaction(
    [snapshotsStore, changesStore, metadataStore],
    'readwrite',
  )
  const done = transactionDone(transaction)
  transaction.objectStore(snapshotsStore).delete(scope)
  const changes = transaction.objectStore(changesStore)
  const cursorRequest = changes.index('scope').openCursor(scope)
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result
    if (!cursor) return
    cursor.delete()
    cursor.continue()
  }
  const metadata = transaction.objectStore(metadataStore)
  const deviceRequest = metadata.get('deviceScope')
  deviceRequest.onsuccess = () => {
    if ((deviceRequest.result as MetadataRecord | undefined)?.value === scope)
      metadata.delete('deviceScope')
  }
  try {
    await done
  } finally {
    database.close()
    databasePromise = undefined
  }
}

function equalTask(left: Task, right: Task) {
  return JSON.stringify(taskSchema.parse(left)) === JSON.stringify(taskSchema.parse(right))
}

export function applyOfflineOperations(
  initial: Workspace,
  operations: OfflineOperation[],
): OfflineApplyResult {
  let workspace = workspaceSchema.parse(initial)
  const appliedIds: string[] = []
  const conflicts: OfflineConflict[] = []
  let writeRequired = false

  for (const operation of operations) {
    const parsed = offlineOperationSchema.parse(operation)
    if (parsed.kind === 'task-save') {
      const current = workspace.tasks.find((task) => task.id === parsed.task.id)
      if (current && equalTask(current, parsed.task)) {
        appliedIds.push(parsed.id)
        continue
      }
      const unchanged =
        parsed.baseTask === null
          ? !current
          : !!current && equalTask(current, parsed.baseTask)
      if (!unchanged) {
        conflicts.push({
          operationId: parsed.id,
          kind: parsed.kind,
          summary: `“${parsed.task.title}” changed on the server while this device was offline.`,
          currentTask: current ?? null,
        })
        continue
      }
      const withHistory = parsed.baseTask
        ? preserveHistory(workspace, parsed.date)
        : workspace
      workspace = workspaceSchema.parse({
        ...withHistory,
        tasks: [
          ...withHistory.tasks.filter((task) => task.id !== parsed.task.id),
          parsed.task,
        ],
      })
      writeRequired = true
      appliedIds.push(parsed.id)
      continue
    }

    const saved = workspace.occurrences.find(
      (occurrence) => occurrence.id === parsed.occurrenceId,
    )
    const current =
      saved ??
      (() => {
        const task = workspace.tasks.find(
          (record) => record.id === parsed.baseOccurrence.taskId,
        )
        if (
          task &&
          equalTask(task, parsed.baseOccurrence.snapshot) &&
          scheduled(task, parsed.baseOccurrence.date)
        )
          return parsed.baseOccurrence
        return undefined
      })()
    if (!current) {
      conflicts.push({
        operationId: parsed.id,
        kind: parsed.kind,
        summary: 'This scheduled commitment no longer exists on the server. Your offline change is still stored on this device.',
      })
      continue
    }

    if (parsed.kind === 'progress-entry') {
      if (current.entries.some((entry) => entry.id === parsed.entry.id)) {
        appliedIds.push(parsed.id)
        continue
      }
      workspace = putOccurrence(workspace, {
        ...current,
        status: 'open',
        entries: [...current.entries, parsed.entry],
      })
      writeRequired = true
      appliedIds.push(parsed.id)
      continue
    }

    if (parsed.kind === 'progress-remove') {
      if (!current.entries.some((entry) => entry.id === parsed.entryId)) {
        appliedIds.push(parsed.id)
        continue
      }
      workspace = putOccurrence(workspace, {
        ...current,
        entries: current.entries.filter((entry) => entry.id !== parsed.entryId),
      })
      writeRequired = true
      appliedIds.push(parsed.id)
      continue
    }

    if (current.status === parsed.status) {
      appliedIds.push(parsed.id)
      continue
    }
    if (current.status !== parsed.baseStatus) {
      conflicts.push({
        operationId: parsed.id,
        kind: parsed.kind,
        summary: 'Another device changed this commitment’s status while this device was offline.',
        currentStatus: current.status,
      })
      continue
    }
    workspace = putOccurrence(workspace, {
      ...current,
      status: parsed.status,
    })
    writeRequired = true
    appliedIds.push(parsed.id)
  }

  return { workspace, appliedIds, conflicts, writeRequired }
}
