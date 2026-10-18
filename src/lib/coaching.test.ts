import { describe, it, expect } from 'vitest'
import { coachContext, ruleBasedReply } from './coaching'
import { initialWorkspace, occurrencesFor, putOccurrence } from './model'
import type { Task } from './model'
const date = '2026-10-18',
  at = '2026-10-18T12:00:00.000Z'
const task: Task = {
  id: 'study',
  title: 'Read two chapters',
  description: 'Private task note',
  area: 'academics',
  unit: 'chapters',
  target: 2,
  date,
  recurrence: 'daily',
  weekdays: [],
  priority: 'High',
  createdAt: at,
  updatedAt: at,
}
describe('honest, data-minimising accountability coach', () => {
  it('excludes journals, profile information and task notes from provider context', () => {
    const w = initialWorkspace()
    w.tasks = [task]
    w.preferences.name = 'Private name'
    w.journals = [
      {
        id: 'journal',
        title: 'Private title',
        body: 'Private writing',
        date,
        area: '',
        goalId: '',
        updatedAt: at,
      },
    ]
    const context = JSON.stringify(coachContext(w, date, 'Review my day'))
    expect(context).not.toContain('Private')
    expect(context).toContain('Read two chapters')
    expect(context).not.toContain('week')
  })
  it('only includes weekly summaries or goal records when relevant to the question', () => {
    const w = initialWorkspace()
    expect(coachContext(w, date, 'Review my day')).not.toHaveProperty('week')
    expect(
      coachContext(w, date, 'Review my weekly consistency').week,
    ).toHaveLength(7)
    expect(coachContext(w, date, 'Review my goals')).toHaveProperty('goals')
  })
  it('uses actual unmet targets and avoids invented achievements', () => {
    let w = initialWorkspace()
    w.tasks = [task]
    expect(ruleBasedReply(w, date, 'Help me plan')).toContain('0 of 1')
    expect(ruleBasedReply(w, date, 'Help me plan')).toContain(
      '2 chapters remain',
    )
    w = putOccurrence(w, {
      ...occurrencesFor(w, date)[0],
      entries: [{ id: 'entry', value: 1, at }],
    })
    expect(ruleBasedReply(w, date, 'Help me plan')).toContain(
      '1 chapters remain',
    )
    expect(ruleBasedReply(w, date, 'Help me plan')).toContain('0 of 1')
  })
  it('distinguishes an empty week from insufficient evidence about obstacles', () => {
    const w = initialWorkspace()
    expect(ruleBasedReply(w, date, 'Weekly review')).toContain(
      'no scheduled records',
    )
    w.tasks = [task]
    expect(ruleBasedReply(w, date, 'Weekly review')).toContain(
      'records alone do not tell me the cause',
    )
  })
})
