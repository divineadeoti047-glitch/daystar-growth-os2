import { z } from 'zod'
const id = z.string().min(1).max(100)
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    'Invalid date',
  )
const stamp = z.string().datetime()
export const taskSchema = z.object({
  id,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(3000),
  area: id,
  unit: z.string().trim().min(1).max(40),
  target: z.number().finite().min(0).max(1000000),
  date: day,
  end: day.optional(),
  effectiveFrom: day.optional(),
  recurrence: z.enum(['once', 'daily', 'weekdays', 'weekly', 'selected']),
  weekdays: z.array(z.number().int().min(0).max(6)),
  priority: z.enum(['Low', 'Medium', 'High']),
  pausedFrom: day.optional(),
  archivedFrom: day.optional(),
  createdAt: stamp,
  updatedAt: stamp,
})
export type Task = z.infer<typeof taskSchema>
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    courses: z
      .array(
        z.object({
          id,
          title: z.string().trim().min(1).max(200),
          code: z.string().max(40),
          notes: z.string().max(5000),
          archived: z.boolean(),
          assessments: z
            .array(
              z.object({
                id,
                title: z.string().trim().min(1).max(200),
                date: day,
                kind: z.enum(['assignment', 'exam']),
                done: z.boolean(),
              }),
            )
            .max(200),
        }),
      )
      .max(100)
      .default([]),
    projects: z
      .array(
        z.object({
          id,
          title: z.string().trim().min(1).max(200),
          date: day,
          goalId: z.string().max(100),
          notes: z.string().max(5000),
          archived: z.boolean(),
          taskIds: z.array(id).max(100),
          sequential: z.boolean(),
          steps: z
            .array(
              z.object({
                id,
                title: z.string().trim().min(1).max(200),
                done: z.boolean(),
              }),
            )
            .max(100),
        }),
      )
      .max(300)
      .default([]),
    spiritualPlans: z
      .array(
        z.object({
          id,
          title: z.string().trim().min(1).max(200),
          start: day,
          kind: z.enum(['reading', 'prayer', 'scripture']),
          notes: z.string().max(5000),
          archived: z.boolean(),
          items: z
            .array(
              z.object({
                id,
                title: z.string().trim().min(1).max(200),
                completedOn: day.optional(),
              }),
            )
            .max(365),
        }),
      )
      .max(200)
      .default([]),
    weeklyReviews: z
      .array(
        z.object({
          id,
          date: day,
          win: z.string().max(3000),
          obstacle: z.string().max(3000),
          next: z.string().trim().min(1).max(3000),
          taskIds: z.array(id).max(3),
        }),
      )
      .max(1000)
      .default([]),
    reminders: z
      .array(
        z.object({
          id,
          taskId: id,
          time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          enabled: z.boolean(),
          lastDelivered: z.string().max(10),
        }),
      )
      .max(200)
      .default([]),
    learning: z
      .array(
        z.object({
          id,
          kind: z.enum(['study', 'scripture']),
          course: z.string().trim().min(1).max(200),
          topic: z.string().trim().min(1).max(200),
          question: z.string().trim().min(1).max(3000),
          answer: z.string().max(5000),
          due: day,
          reviews: z
            .array(
              z.object({
                at: stamp,
                rating: z.enum(['again', 'hard', 'good']),
                next: day,
              }),
            )
            .max(1000),
        }),
      )
      .max(2000)
      .default([]),
    tasks: z.array(taskSchema).max(2000),
    occurrences: z
      .array(
        z.object({
          id,
          taskId: id,
          date: day,
          snapshot: taskSchema,
          status: z.enum(['open', 'completed', 'skipped']),
          entries: z
            .array(
              z.object({
                id,
                value: z.number().finite().positive().max(1000000),
                at: stamp,
              }),
            )
            .max(1000),
        }),
      )
      .max(20000),
    areas: z
      .array(
        z.object({
          id,
          name: z.string().trim().min(1).max(80),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        }),
      )
      .min(1)
      .max(50),
    journals: z
      .array(
        z.object({
          id,
          title: z.string().trim().min(1).max(200),
          body: z.string().trim().min(1).max(30000),
          date: day,
          area: z.string().max(100),
          goalId: z.string().max(100),
          updatedAt: stamp,
        }),
      )
      .max(5000),
    goals: z
      .array(
        z.object({
          id,
          title: z.string().trim().min(1).max(200),
          description: z.string().max(3000),
          area: id,
          date: day,
          milestones: z
            .array(
              z.object({
                id,
                title: z.string().min(1).max(200),
                done: z.boolean(),
              }),
            )
            .max(100),
          taskIds: z.array(id).max(100),
          notes: z.string().max(5000),
          reviews: z
            .array(z.object({ at: stamp, note: z.string().max(2000) }))
            .max(100),
        }),
      )
      .max(500),
    focus: z
      .array(
        z.object({
          id,
          taskId: z.string().max(100),
          startedAt: stamp,
          duration: z.number().int().min(60).max(10800),
          remaining: z.number().min(0).max(10800),
          runningSince: z.number().nullable(),
          status: z.enum(['running', 'paused', 'completed', 'interrupted']),
          kind: z.enum(['focus', 'break']),
          actual: z.number().min(0).max(10800),
        }),
      )
      .max(5000),
    preferences: z.object({
      name: z.string().max(100),
      timezone: z
        .string()
        .max(80)
        .refine((s) => {
          try {
            new Intl.DateTimeFormat('en', { timeZone: s })
            return true
          } catch {
            return false
          }
        }),
      focusMinutes: z.number().int().min(1).max(180),
      breakMinutes: z.number().int().min(1).max(60),
      reminders: z.boolean(),
      reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      lastReminder: z.string().max(20),
    }),
  })
  .superRefine((w, ctx) => {
    for (const key of [
      'courses',
      'projects',
      'spiritualPlans',
      'weeklyReviews',
      'reminders',
      'learning',
      'tasks',
      'occurrences',
      'areas',
      'journals',
      'goals',
      'focus',
    ] as const)
      if (new Set(w[key].map((x) => x.id)).size !== w[key].length)
        ctx.addIssue({
          code: 'custom',
          message: 'Duplicate identifiers',
          path: [key],
        })
    const areaIds = new Set(w.areas.map((a) => a.id))
    const taskIds = new Set(w.tasks.map((t) => t.id))
    const goalIds = new Set(w.goals.map((g) => g.id))
    for (const project of w.projects) {
      if (
        (project.goalId && !goalIds.has(project.goalId)) ||
        project.taskIds.some((id) => !taskIds.has(id)) ||
        new Set(project.steps.map((s) => s.id)).size !== project.steps.length ||
        (project.sequential &&
          project.steps.some(
            (s, i) => s.done && project.steps.slice(0, i).some((p) => !p.done),
          ))
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid project relationships or sequence',
        })
    }
    for (const course of w.courses)
      if (
        new Set(course.assessments.map((a) => a.id)).size !==
        course.assessments.length
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Duplicate assessment identifiers',
        })
    for (const plan of w.spiritualPlans)
      if (
        new Set(plan.items.map((a) => a.id)).size !== plan.items.length ||
        plan.items.some((a) => a.completedOn && a.completedOn < plan.start)
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid spiritual plan records',
        })
    for (const review of w.weeklyReviews)
      if (
        review.taskIds.some((id) => !taskIds.has(id)) ||
        new Set(review.taskIds).size !== review.taskIds.length
      )
        ctx.addIssue({ code: 'custom', message: 'Invalid weekly priorities' })
    for (const reminder of w.reminders)
      if (!taskIds.has(reminder.taskId))
        ctx.addIssue({ code: 'custom', message: 'Invalid reminder task' })
    for (const t of w.tasks) {
      if (
        !areaIds.has(t.area) ||
        (t.end && t.end < t.date) ||
        (t.recurrence === 'selected' && !t.weekdays.length)
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid task schedule or life area',
        })
    }
    for (const o of w.occurrences) {
      if (
        !taskIds.has(o.taskId) ||
        !areaIds.has(o.snapshot.area) ||
        new Set(o.entries.map((e) => e.id)).size !== o.entries.length
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid progress relationships or duplicate entries',
        })
    }
    for (const g of w.goals)
      if (
        !areaIds.has(g.area) ||
        g.taskIds.some((id) => !taskIds.has(id)) ||
        new Set(g.milestones.map((m) => m.id)).size !== g.milestones.length
      )
        ctx.addIssue({ code: 'custom', message: 'Invalid goal relationships' })
    for (const j of w.journals)
      if (
        (j.area && !areaIds.has(j.area)) ||
        (j.goalId && !goalIds.has(j.goalId))
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid reflection relationship',
        })
    if (
      w.focus.filter((s) => s.status === 'running' || s.status === 'paused')
        .length > 1
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Finish the current focus session before importing another active session',
      })
    for (const s of w.focus)
      if (
        s.remaining > s.duration ||
        s.actual > s.duration ||
        (s.status === 'completed' &&
          (s.remaining !== 0 || s.actual !== s.duration)) ||
        (s.status === 'running' && (s.runningSince !== null) === null)
      )
        ctx.addIssue({ code: 'custom', message: 'Invalid focus session' })
    for (const o of w.occurrences)
      if (o.id !== `${o.taskId}:${o.date}` || o.snapshot.id !== o.taskId)
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid occurrence relationship',
        })
  })
export type Workspace = z.infer<typeof workspaceSchema>
export type Occurrence = Workspace['occurrences'][number]
export const initialWorkspace = (): Workspace => ({
  version: 1,
  courses: [],
  projects: [],
  spiritualPlans: [],
  weeklyReviews: [],
  reminders: [],
  learning: [],
  tasks: [],
  occurrences: [],
  journals: [],
  goals: [],
  focus: [],
  areas: [
    { id: 'spiritual', name: 'Spiritual Growth', color: '#b09562' },
    { id: 'academics', name: 'Academics', color: '#6c879d' },
    { id: 'career', name: 'Skills & Career', color: '#8c8baf' },
    { id: 'health', name: 'Health & Well-being', color: '#789580' },
    { id: 'personal', name: 'Personal Development', color: '#b4846e' },
  ],
  preferences: {
    name: '',
    timezone: 'UTC',
    focusMinutes: 25,
    breakMinutes: 5,
    reminders: false,
    reminderTime: '08:00',
    quietStart: '22:00',
    quietEnd: '07:00',
    lastReminder: '',
  },
})
export function dateKey(timezone = 'UTC', date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
export function addDay(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export function scheduled(t: Task, date: string) {
  if (
    date < t.date ||
    (t.effectiveFrom && date < t.effectiveFrom) ||
    (t.end && date > t.end) ||
    (t.pausedFrom && date >= t.pausedFrom) ||
    (t.archivedFrom && date >= t.archivedFrom)
  )
    return false
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay()
  return t.recurrence === 'once'
    ? date === t.date
    : t.recurrence === 'daily'
      ? true
      : t.recurrence === 'weekdays'
        ? [1, 2, 3, 4, 5].includes(weekday)
        : t.recurrence === 'selected'
          ? t.weekdays.includes(weekday)
          : weekday === new Date(t.date + 'T12:00:00Z').getUTCDay()
}
export function occurrencesFor(w: Workspace, date: string): Occurrence[] {
  const saved = w.occurrences.filter((o) => o.date === date)
  const ids = new Set(saved.map((o) => o.taskId))
  return [
    ...saved,
    ...w.tasks
      .filter((t) => !ids.has(t.id) && scheduled(t, date))
      .map((t) => ({
        id: `${t.id}:${date}`,
        taskId: t.id,
        date,
        snapshot: { ...t },
        status: 'open' as const,
        entries: [],
      })),
  ]
}
export function amount(o: Occurrence) {
  return o.entries.reduce((sum, e) => sum + e.value, 0)
}
export function isComplete(o: Occurrence) {
  return (
    o.status !== 'skipped' &&
    (o.snapshot.target > 0
      ? amount(o) >= o.snapshot.target
      : o.status === 'completed')
  )
}
export function targetPercent(o: Occurrence) {
  return o.snapshot.target > 0
    ? Math.min(100, (amount(o) / o.snapshot.target) * 100)
    : null
}
export function metrics(list: Occurrence[], today?: string) {
  const all = list.filter(
    (o) => o.status !== 'skipped' && (!today || o.date <= today),
  )
  const done = all.filter(isComplete).length
  const measured = all.filter((o) => o.snapshot.target > 0)
  return {
    total: all.length,
    done,
    remaining: all.length - done,
    inProgress: all.filter((o) => amount(o) > 0 && !isComplete(o)).length,
    completion: all.length ? (done / all.length) * 100 : null,
    target: measured.length
      ? measured.reduce((s, o) => s + (targetPercent(o) ?? 0), 0) /
        measured.length
      : null,
  }
}
// Freeze past occurrences before any schedule edit; new schedules only affect today and later.
export function preserveHistory(w: Workspace, today: string): Workspace {
  const ids = new Set(w.occurrences.map((o) => o.id))
  const extra: Occurrence[] = []
  for (const t of w.tasks) {
    let d = t.date
    for (let i = 0; d < today && i < 36525; i++, d = addDay(d, 1)) {
      const key = `${t.id}:${d}`
      if (!ids.has(key) && scheduled(t, d)) {
        extra.push({
          id: key,
          taskId: t.id,
          date: d,
          snapshot: { ...t },
          status: 'open',
          entries: [],
        })
        ids.add(key)
      }
    }
  }
  return { ...w, occurrences: [...w.occurrences, ...extra] }
}
export function putOccurrence(w: Workspace, o: Occurrence): Workspace {
  return {
    ...w,
    occurrences: [...w.occurrences.filter((x) => x.id !== o.id), o],
  }
}
export function mergeBackup(current: Workspace, backup: Workspace): Workspace {
  const out = { ...current }
  for (const key of [
    'courses',
    'projects',
    'spiritualPlans',
    'weeklyReviews',
    'reminders',
    'learning',
    'tasks',
    'occurrences',
    'areas',
    'journals',
    'goals',
    'focus',
  ] as const) {
    const oldIds = new Set(current[key].map((x) => x.id))
    ;(out[key] as unknown[]) = [
      ...current[key],
      ...backup[key].filter((x) => !oldIds.has(x.id)),
    ]
  }
  return workspaceSchema.parse(out)
}
export function remainingTime(s: Workspace['focus'][number], now = Date.now()) {
  return Math.max(
    0,
    s.remaining -
      (s.status === 'running' && s.runningSince !== null
        ? Math.max(0, Math.floor((now - s.runningSince) / 1000))
        : 0),
  )
}

export function formatPercent(value: number | null) {
  if (value === null) return '—'
  const safe = value < 100 ? Math.min(99.9, value) : 100
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(safe)}%`
}
export function overdueOccurrences(w: Workspace, today: string) {
  const first = [
    ...w.tasks.map((t) => t.date),
    ...w.occurrences.map((o) => o.date),
  ].sort()[0]
  if (!first) return []
  const out: Occurrence[] = []
  let d = first
  for (let i = 0; d < today && i < 36525; i++, d = addDay(d, 1))
    out.push(
      ...occurrencesFor(w, d).filter(
        (o) => o.status !== 'skipped' && !isComplete(o),
      ),
    )
  return out
}

// Recall ratings schedule practice; they never imply mastery or spiritual maturity.
export function reviewLearning(
  item: Workspace['learning'][number],
  rating: 'again' | 'hard' | 'good',
  today: string,
  at = new Date().toISOString(),
) {
  let consecutiveGood = 0
  for (const review of [...item.reviews].reverse()) {
    if (review.rating !== 'good') break
    consecutiveGood++
  }
  const interval =
    rating === 'again'
      ? 1
      : rating === 'hard'
        ? 2
        : Math.min(60, 2 ** Math.min(6, consecutiveGood + 2) - 1)
  const next = addDay(today, interval)
  return {
    ...item,
    due: next,
    reviews: [...item.reviews, { at, rating, next }],
  }
}

// Recovery resumes today; archived gaps remain absent from historical metrics.
export function restoreTask(
  w: Workspace,
  taskId: string,
  today: string,
): Workspace {
  const task = w.tasks.find((t) => t.id === taskId)
  if (!task?.archivedFrom) return w
  const next = preserveHistory(w, today)
  return {
    ...next,
    tasks: next.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            archivedFrom: undefined,
            pausedFrom: undefined,
            effectiveFrom: today,
            date: t.recurrence === 'once' ? today : t.date,
            end: t.end && t.end < today ? undefined : t.end,
            updatedAt: new Date().toISOString(),
          }
        : t,
    ),
    occurrences: next.occurrences.filter(
      (o) =>
        !(
          o.taskId === taskId &&
          o.date >= today &&
          o.status === 'skipped' &&
          !o.entries.length
        ),
    ),
  }
}

export function weeklySummary(w: Workspace, today: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDay(today, i - 6))
  return {
    days: days.map((date) => ({ date, ...metrics(occurrencesFor(w, date)) })),
    ...metrics(days.flatMap((date) => occurrencesFor(w, date))),
    focusMinutes: Math.floor(
      w.focus
        .filter(
          (s) =>
            s.kind === 'focus' &&
            days.includes(
              dateKey(w.preferences.timezone, new Date(s.startedAt)),
            ),
        )
        .reduce(
          (n, s) =>
            n +
            (s.status === 'completed' || s.status === 'interrupted'
              ? s.actual
              : 0),
          0,
        ) / 60,
    ),
    reviews: w.learning.reduce(
      (n, item) =>
        n +
        item.reviews.filter((r) =>
          days.includes(dateKey(w.preferences.timezone, new Date(r.at))),
        ).length,
      0,
    ),
  }
}

export function dailyBrief(w: Workspace, today: string) {
  const priorities = occurrencesFor(w, today)
    .filter((o) => o.status !== 'skipped' && !isComplete(o))
    .sort(
      (a, b) =>
        ({ High: 0, Medium: 1, Low: 2 })[a.snapshot.priority] -
        { High: 0, Medium: 1, Low: 2 }[b.snapshot.priority],
    )
  const deadlines = w.courses
    .filter((c) => !c.archived)
    .flatMap((c) =>
      c.assessments
        .filter((a) => !a.done && a.date <= addDay(today, 7))
        .map((a) => ({ ...a, course: c.title })),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
  return {
    priorities: priorities.slice(0, 3),
    remaining: priorities.length,
    deadlines,
    dueReviews: w.learning.filter((i) => i.due <= today).length,
  }
}

export function toggleProjectStep(
  project: Workspace['projects'][number],
  stepId: string,
) {
  const index = project.steps.findIndex((s) => s.id === stepId)
  if (
    index < 0 ||
    (project.sequential && project.steps.slice(0, index).some((s) => !s.done))
  )
    return project
  const done = !project.steps[index].done
  return {
    ...project,
    steps: project.steps.map((s, i) => ({
      ...s,
      done:
        i === index
          ? done
          : project.sequential && !done && i > index
            ? false
            : s.done,
    })),
  }
}

export function dueReminders(w: Workspace, today: string, time: string) {
  const p = w.preferences
  const quiet =
    p.quietStart !== p.quietEnd &&
    (p.quietStart < p.quietEnd
      ? time >= p.quietStart && time < p.quietEnd
      : time >= p.quietStart || time < p.quietEnd)
  if (quiet) return []
  const items = occurrencesFor(w, today)
  return w.reminders.filter(
    (r) =>
      r.enabled &&
      r.lastDelivered !== today &&
      r.time <= time &&
      items.some(
        (o) =>
          o.taskId === r.taskId && o.status !== 'skipped' && !isComplete(o),
      ),
  )
}
