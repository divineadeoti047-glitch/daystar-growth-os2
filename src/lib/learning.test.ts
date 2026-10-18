import { describe, expect, it } from 'vitest'
import {
  initialWorkspace,
  mergeBackup,
  remainingTime,
  reviewLearning,
  restoreTask,
  occurrencesFor,
  workspaceSchema,
} from './model'
import type { Workspace } from './model'
const item: Workspace['learning'][number] = {
  id: 'topic',
  kind: 'study',
  course: 'BIO 201',
  topic: 'Cell division',
  question: 'What distinguishes meiosis?',
  answer: 'Private notes',
  due: '2026-10-18',
  reviews: [],
}
describe('private review records', () => {
  it('accepts older documents without losing existing records', () => {
    const { learning: _learning, ...legacy } = initialWorkspace()
    expect(workspaceSchema.parse(legacy).learning).toEqual([])
  })
  it('schedules increasing good intervals and resets after difficulty', () => {
    const first = reviewLearning(
      item,
      'good',
      '2026-10-18',
      '2026-10-18T10:00:00Z',
    )
    expect(first.due).toBe('2026-10-21')
    const second = reviewLearning(
      first,
      'good',
      '2026-10-21',
      '2026-10-21T10:00:00Z',
    )
    expect(second.due).toBe('2026-10-28')
    const hard = reviewLearning(
      second,
      'hard',
      '2026-10-28',
      '2026-10-28T10:00:00Z',
    )
    expect(hard.due).toBe('2026-10-30')
    expect(reviewLearning(hard, 'again', '2026-10-30').due).toBe('2026-10-31')
    expect(item.reviews).toHaveLength(0)
    expect(second.reviews).toHaveLength(2)
  })
  it('merges review backups additively and validates identifiers and dates', () => {
    const current = initialWorkspace()
    current.learning = [item]
    const backup = initialWorkspace()
    backup.learning = [
      { ...item, answer: 'Do not overwrite' },
      { ...item, id: 'new' },
    ]
    const result = mergeBackup(current, backup)
    expect(result.learning).toHaveLength(2)
    expect(result.learning[0].answer).toBe('Private notes')
    backup.learning.push(item)
    expect(workspaceSchema.safeParse(backup).success).toBe(false)
    backup.learning = [{ ...item, due: '2026-02-31' }]
    expect(workspaceSchema.safeParse(backup).success).toBe(false)
  })
  it('never increases remaining time if the clock moves backwards', () => {
    const session: Workspace['focus'][number] = {
      id: 'focus',
      taskId: '',
      startedAt: '2026-10-18T10:00:00Z',
      duration: 60,
      remaining: 40,
      runningSince: 10000,
      status: 'running',
      kind: 'focus',
      actual: 20,
    }
    expect(remainingTime(session, 5000)).toBe(40)
    expect(remainingTime({ ...session, runningSince: 0 }, 10000)).toBe(30)
  })
})

describe('archive recovery', () => {
  it('preserves past snapshots and archive gaps when resuming today', () => {
    const w = initialWorkspace()
    w.tasks = [
      {
        id: 'routine',
        title: 'Read',
        description: '',
        area: 'spiritual',
        unit: 'chapters',
        target: 1,
        date: '2026-10-14',
        recurrence: 'daily',
        weekdays: [],
        priority: 'Medium',
        archivedFrom: '2026-10-16',
        createdAt: '2026-10-14T00:00:00Z',
        updatedAt: '2026-10-16T00:00:00Z',
      },
    ]
    const result = restoreTask(w, 'routine', '2026-10-18')
    expect(occurrencesFor(result, '2026-10-15')).toHaveLength(1)
    expect(occurrencesFor(result, '2026-10-16')).toHaveLength(0)
    expect(occurrencesFor(result, '2026-10-17')).toHaveLength(0)
    expect(occurrencesFor(result, '2026-10-18')).toHaveLength(1)
    expect(w.tasks[0].archivedFrom).toBe('2026-10-16')
    expect(workspaceSchema.safeParse(result).success).toBe(true)
  })
})
