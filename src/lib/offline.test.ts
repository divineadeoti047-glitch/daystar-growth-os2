import { describe, expect, it } from 'vitest'
import { initialWorkspace, workspaceSchema } from './model'
import type { Task } from './model'
import {
  applyOfflineOperations,
  taskOnlyWorkspace,
} from './offline'
import type { OfflineOperation } from './offline'

const scope = 'a'.repeat(64)
const now = '2026-10-18T12:00:00.000Z'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Read a chapter',
    description: '',
    area: 'spiritual',
    unit: 'chapters',
    target: 1,
    date: '2026-10-18',
    recurrence: 'once',
    weekdays: [],
    priority: 'Medium',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function workspace(taskRecord = task(), status: 'open' | 'completed' | 'skipped' = 'open') {
  return workspaceSchema.parse({
    ...initialWorkspace(),
    tasks: [taskRecord],
    occurrences: [
      {
        id: `${taskRecord.id}:2026-10-18`,
        taskId: taskRecord.id,
        date: '2026-10-18',
        snapshot: taskRecord,
        status,
        entries: [],
      },
    ],
  })
}

function occurrence() {
  return {
    id: 'task-1:2026-10-18',
    taskId: 'task-1',
    date: '2026-10-18',
    snapshot: task(),
    status: 'open' as const,
    entries: [],
  }
}

function taskSaveOperation(
  overrides: Partial<Extract<OfflineOperation, { kind: 'task-save' }>> = {},
) {
  return {
    id: overrides.id ?? 'change-1',
    scope: overrides.scope ?? scope,
    createdAt: overrides.createdAt ?? now,
    kind: 'task-save',
    date: overrides.date ?? '2026-10-18',
    task:
      overrides.task ?? task({ id: 'new-task', title: 'Write a reflection' }),
    baseTask: overrides.baseTask ?? null,
  } satisfies Extract<OfflineOperation, { kind: 'task-save' }>
}

function progressEntryOperation(
  overrides: Partial<Extract<OfflineOperation, { kind: 'progress-entry' }>> = {},
) {
  return {
    id: overrides.id ?? 'change-1',
    scope: overrides.scope ?? scope,
    createdAt: overrides.createdAt ?? now,
    kind: 'progress-entry',
    occurrenceId: 'task-1:2026-10-18',
    baseOccurrence: overrides.baseOccurrence ?? occurrence(),
    entry: overrides.entry ?? { id: 'entry-1', value: 2, at: now },
  } satisfies Extract<OfflineOperation, { kind: 'progress-entry' }>
}

function occurrenceStatusOperation(
  overrides: Partial<
    Extract<OfflineOperation, { kind: 'occurrence-status' }>
  > = {},
) {
  return {
    id: overrides.id ?? 'change-1',
    scope: overrides.scope ?? scope,
    createdAt: overrides.createdAt ?? now,
    kind: 'occurrence-status',
    occurrenceId: 'task-1:2026-10-18',
    baseOccurrence: overrides.baseOccurrence ?? occurrence(),
    baseStatus: overrides.baseStatus ?? 'open',
    status: overrides.status ?? 'completed',
  } satisfies Extract<OfflineOperation, { kind: 'occurrence-status' }>
}

describe('offline task reconciliation', () => {
  it('stores only task data in the offline snapshot', () => {
    const privateWorkspace = workspace()
    privateWorkspace.journals.push({
      id: 'journal-1',
      title: 'Private reflection',
      body: 'This must remain on the server.',
      date: '2026-10-18',
      area: 'spiritual',
      goalId: '',
      updatedAt: now,
    })

    const cached = taskOnlyWorkspace(privateWorkspace)

    expect(cached.tasks).toHaveLength(1)
    expect(cached.journals).toEqual([])
  })

  it('replays a new task without replacing unrelated server records', () => {
    const current = workspace()
    const newTask = task({ id: 'new-task', title: 'Write a reflection' })
    const change = taskSaveOperation({ task: newTask })

    const result = applyOfflineOperations(current, [change])

    expect(result.conflicts).toEqual([])
    expect(result.appliedIds).toEqual([change.id])
    expect(result.workspace.tasks.map((record) => record.id)).toEqual([
      'task-1',
      'new-task',
    ])
  })

  it('keeps a conflicting task edit pending instead of overwriting the server', () => {
    const baseTask = task()
    const serverTask = task({
      title: 'A newer server title',
      updatedAt: '2026-10-18T13:00:00.000Z',
    })
    const offlineTask = task({
      title: 'My offline title',
      updatedAt: '2026-10-18T14:00:00.000Z',
    })
    const change = taskSaveOperation({
      baseTask,
      task: offlineTask,
    })
    const result = applyOfflineOperations(workspace(serverTask), [change])

    expect(result.conflicts).toHaveLength(1)
    expect(result.appliedIds).toEqual([])
    expect(result.workspace.tasks[0]).toEqual(serverTask)
    expect(result.conflicts[0]?.currentTask).toEqual(serverTask)
  })

  it('merges progress by stable entry ID and is safe to replay twice', () => {
    const change = progressEntryOperation()
    const first = applyOfflineOperations(workspace(), [change])
    const second = applyOfflineOperations(first.workspace, [change])

    expect(first.workspace.occurrences[0]?.entries).toHaveLength(1)
    expect(second.workspace.occurrences[0]?.entries).toHaveLength(1)
    expect(second.appliedIds).toEqual([change.id])
  })

  it('keeps concurrent completion changes for the user to resolve', () => {
    const change = occurrenceStatusOperation({
      status: 'skipped',
      baseStatus: 'open',
    })
    const result = applyOfflineOperations(
      workspace(task(), 'completed'),
      [change],
    )

    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.currentStatus).toBe('completed')
    expect(result.workspace.occurrences[0]?.status).toBe('completed')
  })
})
