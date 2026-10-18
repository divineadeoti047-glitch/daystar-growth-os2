import { addDay, amount, isComplete, metrics, occurrencesFor } from './model'
import type { Workspace } from './model'
export function coachContext(w: Workspace, today: string, message: string) {
  const list = occurrencesFor(w, today).filter((o) => o.status !== 'skipped')
  const weekly = /week|consisten|pattern/i.test(message)
  const goals = /goal|milestone/i.test(message)
  return {
    date: today,
    metrics: metrics(list),
    taskListTruncated: list.length > 30,
    tasks: list.slice(0, 30).map((o) => ({
      title: o.snapshot.title,
      target: o.snapshot.target,
      unit: o.snapshot.unit,
      progress: amount(o),
      completed: isComplete(o),
    })),
    ...(weekly
      ? {
          week: Array.from({ length: 7 }, (_, i) => {
            const date = addDay(today, i - 6)
            return { date, ...metrics(occurrencesFor(w, date)) }
          }),
        }
      : {}),
    ...(goals
      ? {
          goals: w.goals.slice(0, 20).map((g) => ({
            title: g.title,
            date: g.date,
            milestones: g.milestones.length,
            completedMilestones: g.milestones.filter((m) => m.done).length,
          })),
        }
      : {}),
  }
}
export function ruleBasedReply(w: Workspace, today: string, message: string) {
  const list = occurrencesFor(w, today),
    m = metrics(list)
  if (/break.*down|overwhelm|smaller|stuck/i.test(message)) {
    const item = list
      .filter((o) => !isComplete(o) && o.status !== 'skipped')
      .sort(
        (a, b) =>
          ({ High: 0, Medium: 1, Low: 2 })[a.snapshot.priority] -
          { High: 0, Medium: 1, Low: 2 }[b.snapshot.priority],
      )[0]
    if (!item)
      return 'There is no unfinished scheduled commitment to break down today. Add one concrete task, then choose a small first action.'
    const left = Math.max(0, item.snapshot.target - amount(item))
    return `For “${item.snapshot.title}”, try this suggested sequence: 1. Open the material or tools you need. 2. Name one visible result you could produce in five minutes. 3. Work on that result, then record only what you actually completed.${item.snapshot.target > 0 ? ` Your recorded remaining target is ${left} ${item.snapshot.unit}.` : ' This task needs manual completion.'} These are planning suggestions, not recorded actions; nothing has been changed.`
  }
  if (/week|consisten|pattern/i.test(message)) {
    const all = Array.from({ length: 7 }, (_, i) =>
      occurrencesFor(w, addDay(today, i - 6)),
    ).flat()
    const week = metrics(all)
    return week.total
      ? `Over the seven days ending ${today}, you completed ${week.done} of ${week.total} scheduled commitments. ${week.remaining} remain unfinished. Review one unfinished commitment: what got in the way, and what smaller step could you repeat next week? These records alone do not tell me the cause.`
      : 'There are no scheduled records in the last seven days. Start with one manageable daily commitment; a week of honest records gives you something useful to review.'
  }
  if (/goal|milestone/i.test(message)) {
    const goal =
      w.goals.find((g) => g.milestones.some((m) => !m.done)) ?? w.goals[0]
    if (!goal)
      return 'There are no goals saved yet. Name one meaningful objective, set a target date, and add a small first milestone.'
    const next = goal.milestones.find((m) => !m.done)
    return `For “${goal.title}”, ${goal.milestones.filter((m) => m.done).length} of ${goal.milestones.length} milestones are complete. ${next ? `Your next unfinished milestone is “${next.title}”. Choose one action that moves it forward.` : 'Review whether your milestones cover the goal, then add or update the next practical step.'}`
  }
  if (!m.total)
    return 'Your day is a clean slate. Add one manageable commitment, give it a realistic target, and choose a time to begin.'
  const open = list
    .filter((o) => !isComplete(o) && o.status !== 'skipped')
    .sort(
      (a, b) =>
        ({ High: 0, Medium: 1, Low: 2 })[a.snapshot.priority] -
        { High: 0, Medium: 1, Low: 2 }[b.snapshot.priority],
    )
  const o = open[0]
  return `You have completed ${m.done} of ${m.total} commitments today. ${o ? `Start with “${o.snapshot.title}”${o.snapshot.target > 0 ? `: ${Math.max(0, o.snapshot.target - amount(o))} ${o.snapshot.unit} remain` : ''}. Choose a small, realistic next step and record what you actually do. You can pause a future recurring schedule if it no longer fits.` : 'All scheduled commitments meet their completion criteria. Take a moment to reflect on what helped, and what you want to repeat.'}`
}
