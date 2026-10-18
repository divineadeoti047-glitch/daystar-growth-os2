import { describe, expect, it } from 'vitest'
import {
  addDay,
  amount,
  dateKey,
  formatPercent,
  initialWorkspace,
  isComplete,
  mergeBackup,
  metrics,
  occurrencesFor,
  overdueOccurrences,
  preserveHistory,
  putOccurrence,
  remainingTime,
  scheduled,
  targetPercent,
  workspaceSchema,
} from './model'
import type { Task, Workspace } from './model'
const today = '2026-10-18'
const at = '2026-10-18T10:00:00.000Z'
function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'study',
    title: 'Study',
    description: '',
    area: 'academics',
    unit: 'minutes',
    target: 120,
    date: today,
    recurrence: 'daily',
    weekdays: [],
    priority: 'Medium',
    createdAt: at,
    updatedAt: at,
    ...overrides,
  }
}
function workspace(tasks: Task[] = [task()]): Workspace {
  return { ...initialWorkspace(), tasks }
}
function entry(value: number) {
  return { id: crypto.randomUUID(), value, at }
}
describe('independent, honest progress', () => {
  it('does not report 100% on empty days', () => {
    expect(metrics([])).toMatchObject({
      total: 0,
      completion: null,
      target: null,
    })
    expect(formatPercent(null)).toBe('—')
  })
  it('counts every scheduled task, including those without a record', () => {
    let w = workspace([task(), task({ id: 'read' })])
    const [o] = occurrencesFor(w, today)
    w = putOccurrence(w, { ...o, entries: [entry(120)] })
    expect(metrics(occurrencesFor(w, today))).toMatchObject({
      total: 2,
      done: 1,
      completion: 50,
      target: 50,
    })
  })
  it('returns zero when no scheduled task is complete', () => {
    expect(metrics(occurrencesFor(workspace(), today)).completion).toBe(0)
  })
  it('sums incremental progress and preserves amounts above target', () => {
    const o = {
      ...occurrencesFor(workspace(), today)[0],
      entries: [entry(25), entry(40), entry(30)],
    }
    expect(amount(o)).toBe(95)
    expect(isComplete(o)).toBe(false)
    expect(targetPercent(o)).toBeCloseTo(79.166666)
    const over = { ...o, entries: [...o.entries, entry(80)] }
    expect(amount(over)).toBe(175)
    expect(targetPercent(over)).toBe(100)
    expect(isComplete(over)).toBe(true)
  })
  it('equally averages targets across different units without summing units', () => {
    const w = workspace([
      task({ id: 'a', target: 10, unit: 'chapters' }),
      task({ id: 'b', target: 120 }),
      task({ id: 'c', target: 3, unit: 'sessions' }),
    ])
    const list = occurrencesFor(w, today).map((o, i) => ({
      ...o,
      entries: i === 0 ? [entry(10)] : i === 1 ? [entry(60)] : [],
    }))
    expect(metrics(list).target).toBe(50)
    expect(metrics(list).completion).toBeCloseTo(100 / 3)
  })
  it('does not use a manual status to complete an unmet measurable target', () => {
    const o = {
      ...occurrencesFor(workspace(), today)[0],
      status: 'completed' as const,
    }
    expect(isComplete(o)).toBe(false)
    expect(metrics([o]).target).toBe(0)
  })
  it('requires explicit completion for zero targets and excludes them from target averages', () => {
    const o = occurrencesFor(workspace([task({ target: 0 })]), today)[0]
    expect(isComplete(o)).toBe(false)
    expect(metrics([o])).toMatchObject({ completion: 0, target: null })
    expect(metrics([{ ...o, status: 'completed' }])).toMatchObject({
      completion: 100,
      target: null,
    })
  })
  it('excludes skipped occurrences without deleting their underlying progress', () => {
    const o = {
      ...occurrencesFor(workspace(), today)[0],
      entries: [entry(50)],
      status: 'skipped' as const,
    }
    expect(metrics([o])).toMatchObject({
      total: 0,
      target: null,
      completion: null,
    })
    expect(amount(o)).toBe(50)
  })
  it('never rounds an unfinished percentage to 100%', () => {
    expect(formatPercent(99.999)).toBe('99.9%')
    expect(formatPercent(100)).toBe('100%')
  })
  it.each([
    'minutes',
    'counts',
    'repetitions',
    'sessions',
    'chapters',
    'pages',
  ])('supports the %s measurement unit', (unit) => {
    expect(workspaceSchema.safeParse(workspace([task({ unit })])).success).toBe(
      true,
    )
  })
  it('rejects negative targets, negative entries, duplicate entry IDs, NaN, and invalid dates', () => {
    expect(
      workspaceSchema.safeParse(workspace([task({ target: -1 })])).success,
    ).toBe(false)
    expect(
      workspaceSchema.safeParse(workspace([task({ date: '2026-02-30' })]))
        .success,
    ).toBe(false)
    for (const value of [-1, 0, NaN]) {
      const w = workspace()
      w.occurrences = [
        { ...occurrencesFor(w, today)[0], entries: [entry(value)] },
      ]
      expect(workspaceSchema.safeParse(w).success).toBe(false)
    }
    const w = workspace()
    const e = entry(2)
    w.occurrences = [{ ...occurrencesFor(w, today)[0], entries: [e, e] }]
    expect(workspaceSchema.safeParse(w).success).toBe(false)
  })
})
describe('scheduling and historical accuracy', () => {
  it('supports one-time, daily, weekdays, weekly and selected weekdays', () => {
    expect(scheduled(task({ recurrence: 'once' }), today)).toBe(true)
    expect(scheduled(task({ recurrence: 'once' }), addDay(today, 1))).toBe(
      false,
    )
    expect(scheduled(task(), addDay(today, 1))).toBe(true)
    expect(scheduled(task({ recurrence: 'weekdays' }), today)).toBe(false)
    expect(scheduled(task({ recurrence: 'weekdays' }), '2026-10-19')).toBe(true)
    expect(scheduled(task({ recurrence: 'weekly' }), '2026-10-25')).toBe(true)
    expect(scheduled(task({ recurrence: 'weekly' }), '2026-10-19')).toBe(false)
    expect(
      scheduled(
        task({ recurrence: 'selected', weekdays: [1, 3] }),
        '2026-10-21',
      ),
    ).toBe(true)
  })
  it('honors start, end, pause and archive boundaries', () => {
    expect(scheduled(task(), '2026-10-17')).toBe(false)
    expect(scheduled(task({ end: today }), '2026-10-19')).toBe(false)
    expect(scheduled(task({ pausedFrom: today }), today)).toBe(false)
    expect(scheduled(task({ archivedFrom: today }), today)).toBe(false)
  })
  it('reopening or materializing never duplicates an occurrence', () => {
    const w = workspace([task({ date: '2026-10-15' })])
    const saved = preserveHistory(preserveHistory(w, today), today)
    expect(saved.occurrences).toHaveLength(3)
    expect(occurrencesFor(saved, '2026-10-16')).toHaveLength(1)
    expect(occurrencesFor(w, today)).toEqual(occurrencesFor(w, today))
  })
  it('keeps yesterday independent from today', () => {
    let w = workspace([task({ date: '2026-10-17' })])
    const yesterday = occurrencesFor(w, '2026-10-17')[0]
    w = putOccurrence(w, { ...yesterday, entries: [entry(120)] })
    expect(metrics(occurrencesFor(w, '2026-10-17')).completion).toBe(100)
    expect(metrics(occurrencesFor(w, today)).completion).toBe(0)
  })
  it('preserves past scheduled occurrences and targets when future schedule changes', () => {
    let w = preserveHistory(workspace([task({ date: '2026-10-16' })]), today)
    w = {
      ...w,
      tasks: [
        {
          ...w.tasks[0],
          target: 10,
          recurrence: 'once',
          date: '2026-10-20',
          effectiveFrom: today,
        },
      ],
    }
    expect(occurrencesFor(w, '2026-10-16')[0].snapshot.target).toBe(120)
    expect(occurrencesFor(w, '2026-10-17')).toHaveLength(1)
    expect(occurrencesFor(w, today)).toHaveLength(0)
  })
  it('does not backfill paused dates after resuming', () => {
    let w = preserveHistory(
      workspace([task({ date: '2026-10-15' })]),
      '2026-10-16',
    )
    w.tasks = [
      { ...w.tasks[0], pausedFrom: '2026-10-16', effectiveFrom: '2026-10-16' },
    ]
    w = preserveHistory(w, today)
    w.tasks = [{ ...w.tasks[0], pausedFrom: undefined, effectiveFrom: today }]
    expect(occurrencesFor(w, '2026-10-15')).toHaveLength(1)
    expect(occurrencesFor(w, '2026-10-16')).toHaveLength(0)
    expect(occurrencesFor(w, '2026-10-17')).toHaveLength(0)
    expect(occurrencesFor(w, today)).toHaveLength(1)
  })
  it.each([7, 30])(
    'calculates the %i-day period directly from scheduled records',
    (days) => {
      let w = workspace([task({ date: addDay(today, 1 - days) })])
      for (let i = 0; i < days; i++) {
        const date = addDay(today, -i)
        if (i % 2 === 0)
          w = putOccurrence(w, {
            ...occurrencesFor(w, date)[0],
            entries: [entry(60)],
          })
      }
      const all = Array.from({ length: days }, (_, i) =>
        occurrencesFor(w, addDay(today, -i)),
      ).flat()
      const m = metrics(all, today)
      expect(m.total).toBe(days)
      expect(m.done).toBe(0)
      expect(m.target).toBeCloseTo((Math.ceil(days / 2) * 50) / days)
    },
  )
  it('excludes future records from period totals', () => {
    const w = workspace()
    const future = {
      ...occurrencesFor(w, addDay(today, 1))[0],
      entries: [entry(120)],
    }
    expect(metrics([future], today)).toMatchObject({
      total: 0,
      completion: null,
      target: null,
    })
  })
  it('recalculates after progress removal and preserves historical archived tasks', () => {
    let w = workspace([task({ date: '2026-10-17' })])
    const o = occurrencesFor(w, '2026-10-17')[0]
    w = putOccurrence(w, { ...o, entries: [entry(120)] })
    expect(metrics(occurrencesFor(w, '2026-10-17')).completion).toBe(100)
    w = putOccurrence(w, { ...o, entries: [] })
    expect(metrics(occurrencesFor(w, '2026-10-17')).completion).toBe(0)
    w = preserveHistory(w, today)
    w.tasks[0].archivedFrom = today
    expect(occurrencesFor(w, '2026-10-17')).toHaveLength(1)
    expect(occurrencesFor(w, today)).toHaveLength(0)
    expect(overdueOccurrences(w, today)).toHaveLength(1)
  })
  it('uses explicit IANA time zones across a calendar boundary', () => {
    const instant = new Date('2026-10-18T00:30:00Z')
    expect(dateKey('America/Los_Angeles', instant)).toBe('2026-10-17')
    expect(dateKey('Africa/Lagos', instant)).toBe(today)
    expect(addDay('2026-12-31', 1)).toBe('2027-01-01')
  })
})
describe('backups and focus recovery', () => {
  it('round-trips actual journal and goal data and keeps existing IDs on import', () => {
    const current = workspace()
    current.journals = [
      {
        id: 'j',
        title: 'Reflection',
        body: 'Private writing',
        date: today,
        area: '',
        goalId: '',
        updatedAt: at,
      },
    ]
    const backup = workspace([
      task({ title: 'Do not overwrite' }),
      task({ id: 'new' }),
    ])
    backup.journals = [{ ...current.journals[0], body: 'Do not overwrite' }]
    backup.preferences.name = 'Do not overwrite'
    const merged = mergeBackup(
      current,
      workspaceSchema.parse(JSON.parse(JSON.stringify(backup))),
    )
    expect(merged.tasks).toHaveLength(2)
    expect(merged.tasks[0].title).toBe('Study')
    expect(merged.journals[0].body).toBe('Private writing')
    expect(merged.preferences.name).toBe('')
  })
  it('rejects duplicate occurrence identifiers and incompatible backups', () => {
    const w = workspace()
    w.occurrences = [occurrencesFor(w, today)[0], occurrencesFor(w, today)[0]]
    expect(workspaceSchema.safeParse(w).success).toBe(false)
    expect(workspaceSchema.safeParse({ tasks: [] }).success).toBe(false)
  })
  it('recalculates the remaining timer from timestamps after browser suspension', () => {
    const s: Workspace['focus'][number] = {
      id: 'focus',
      taskId: '',
      startedAt: at,
      duration: 1500,
      remaining: 1200,
      runningSince: 100000,
      status: 'running',
      actual: 300,
      kind: 'focus',
    }
    expect(remainingTime(s, 160000)).toBe(1140)
    expect(
      remainingTime({ ...s, status: 'paused', runningSince: null }, 160000),
    ).toBe(1200)
    expect(remainingTime(s, 2000000)).toBe(0)
  })
  it('rejects a falsely completed interrupted session', () => {
    const w = workspace()
    w.focus = [
      {
        id: 'f',
        taskId: '',
        startedAt: at,
        duration: 1500,
        remaining: 500,
        runningSince: null,
        status: 'completed',
        actual: 1000,
        kind: 'focus',
      },
    ]
    expect(workspaceSchema.safeParse(w).success).toBe(false)
    w.focus[0].status = 'interrupted'
    expect(workspaceSchema.safeParse(w).success).toBe(true)
  })
})
