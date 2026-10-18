import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  Flag,
  GraduationCap,
  Layers,
  Plus,
  Sparkles,
  Bell,
  Archive,
  Pencil,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  dailyBrief,
  weeklySummary,
  toggleProjectStep,
  formatPercent,
  addDay,
} from '@/lib/model'
import type { Workspace } from '@/lib/model'
import { Learning } from './learning'
import { PushSettings } from './push-settings'

type Tab = 'Academy' | 'Projects' | 'Spiritual' | 'Weekly review' | 'Reminders'
type Collection =
  'courses' | 'projects' | 'spiritualPlans' | 'weeklyReviews' | 'reminders'
const collections: Record<Tab, Collection> = {
  Academy: 'courses',
  Projects: 'projects',
  Spiritual: 'spiritualPlans',
  'Weekly review': 'weeklyReviews',
  Reminders: 'reminders',
}
const tabs = [
  { name: 'Academy', icon: GraduationCap },
  { name: 'Projects', icon: Layers },
  { name: 'Spiritual', icon: BookOpen },
  { name: 'Weekly review', icon: CalendarDays },
  { name: 'Reminders', icon: Bell },
] as const
const uid = () => crypto.randomUUID()
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}
export function DailyBrief({
  workspace: w,
  today,
  openTasks,
  openStudio,
}: {
  workspace: Workspace
  today: string
  openTasks: () => void
  openStudio: () => void
}) {
  const brief = dailyBrief(w, today)
  return (
    <section className="daily-brief" aria-label="Daily briefing">
      <div className="brief-intro">
        <span className="eyebrow">
          <Sparkles size={14} /> THE DAY, DISTILLED
        </span>
        <h2>
          Your next
          <br />
          meaningful move.
        </h2>
        <p>A clear starting point, drawn from your saved plans.</p>
      </div>
      <div className="brief-main">
        <span className="studio-label">01 / MAKE A BEGINNING</span>
        <h3>
          {brief.priorities[0]?.snapshot.title ||
            'Leave room for your first intention.'}
        </h3>
        <p>
          {brief.remaining
            ? `${brief.remaining} commitments remain today. Start small; record what you actually do.`
            : 'Create a commitment to give today a little direction.'}
        </p>
        <button className="text-link" onClick={openTasks}>
          Open commitments <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="brief-signals">
        <button onClick={openStudio}>
          <strong>{brief.deadlines.length}</strong>
          <span>
            academic deadlines
            <br />
            overdue or within 7 days
          </span>
          <ArrowUpRight size={16} />
        </button>
        <button onClick={openStudio}>
          <strong>{brief.dueReviews}</strong>
          <span>
            recall questions
            <br />
            ready to revisit
          </span>
          <ArrowUpRight size={16} />
        </button>
      </div>
    </section>
  )
}
export function GrowthStudio({
  workspace: w,
  today,
  scope,
  disabled,
  save,
  editing,
}: {
  workspace: Workspace
  today: string
  scope: string
  disabled: boolean
  save: (next: Workspace) => Promise<boolean>
  editing: (open: boolean) => void
}) {
  const [tab, setTab] = useState<Tab>('Academy')
  const [editor, setEditor] = useState<{
    collection: Collection | 'assessment'
    id?: string
    parent?: string
  } | null>(null)
  const [error, setError] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const summary = weeklySummary(w, today)
  const close = () => {
    setEditor(null)
    editing(false)
    setError('')
  }
  const open = (
    collection: Collection | 'assessment',
    id?: string,
    parent?: string,
  ) => {
    setEditor({ collection, id, parent })
    editing(true)
    setError('')
  }
  const current =
    editor?.collection === 'courses'
      ? w.courses.find((x) => x.id === editor.id)
      : undefined
  const project =
    editor?.collection === 'projects'
      ? w.projects.find((x) => x.id === editor.id)
      : undefined
  const plan =
    editor?.collection === 'spiritualPlans'
      ? w.spiritualPlans.find((x) => x.id === editor.id)
      : undefined
  const review =
    editor?.collection === 'weeklyReviews'
      ? w.weeklyReviews.find((x) => x.id === editor.id)
      : undefined
  const reminder =
    editor?.collection === 'reminders'
      ? w.reminders.find((x) => x.id === editor.id)
      : undefined
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editor) return
    const form = new FormData(e.currentTarget)
    const v = (key: string) => String(form.get(key) ?? '').trim()
    const lines = (key: string) =>
      v(key)
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
    const selected = form.getAll('taskIds').map(String)
    const id = editor.id || uid()
    let next = w
    if (editor.collection === 'courses') {
      const item = {
        id,
        title: v('title'),
        code: v('code'),
        notes: v('notes'),
        archived: current?.archived ?? false,
        assessments: current?.assessments ?? [],
      }
      next = { ...w, courses: [...w.courses.filter((x) => x.id !== id), item] }
    } else if (editor.collection === 'assessment') {
      next = {
        ...w,
        courses: w.courses.map((c) =>
          c.id === editor.parent
            ? {
                ...c,
                assessments: [
                  ...c.assessments,
                  {
                    id,
                    title: v('title'),
                    date: v('date'),
                    kind: v('kind') as 'exam' | 'assignment',
                    done: false,
                  },
                ],
              }
            : c,
        ),
      }
    } else if (editor.collection === 'projects') {
      const steps =
        project?.steps ??
        lines('steps').map((title) => ({ id: uid(), title, done: false }))
      if (!steps.length || steps.length > 100) {
        setError('Add between 1 and 100 steps.')
        return
      }
      const item = {
        id,
        title: v('title'),
        date: v('date'),
        goalId: v('goalId'),
        notes: v('notes'),
        archived: project?.archived ?? false,
        taskIds: selected,
        sequential: project?.sequential ?? form.get('sequential') === 'on',
        steps,
      }
      next = {
        ...w,
        projects: [...w.projects.filter((x) => x.id !== id), item],
      }
    } else if (editor.collection === 'spiritualPlans') {
      const items =
        plan?.items ?? lines('items').map((title) => ({ id: uid(), title }))
      if (!items.length || items.length > 365) {
        setError('Add between 1 and 365 passages or sessions.')
        return
      }
      const item = {
        id,
        title: v('title'),
        start: v('start'),
        kind: v('kind') as 'reading' | 'prayer' | 'scripture',
        notes: v('notes'),
        archived: plan?.archived ?? false,
        items,
      }
      next = {
        ...w,
        spiritualPlans: [...w.spiritualPlans.filter((x) => x.id !== id), item],
      }
    } else if (editor.collection === 'weeklyReviews') {
      if (selected.length > 3) {
        setError('Choose at most three priorities.')
        return
      }
      const item = {
        id,
        date: review?.date ?? today,
        win: v('win'),
        obstacle: v('obstacle'),
        next: v('next'),
        taskIds: selected,
      }
      next = {
        ...w,
        weeklyReviews: [...w.weeklyReviews.filter((x) => x.id !== id), item],
      }
    } else {
      const item = {
        id,
        taskId: v('taskId'),
        time: v('time'),
        enabled: true,
        lastDelivered: reminder?.lastDelivered ?? '',
      }
      next = {
        ...w,
        reminders: [...w.reminders.filter((x) => x.id !== id), item],
      }
    }
    if (await save(next)) close()
    else
      setError(
        'Not saved. Your text is still here. Copy it before reconnecting after a conflict.',
      )
  }
  const activeTasks = w.tasks.filter((t) => !t.archivedFrom)
  const taskChoices = (ids: string[] = []) => (
    <fieldset className="studio-task-choices">
      <legend>Linked commitments</legend>
      {activeTasks.length ? (
        activeTasks.map((t) => (
          <label key={t.id}>
            <input
              type="checkbox"
              name="taskIds"
              value={t.id}
              defaultChecked={ids.includes(t.id)}
            />
            {t.title}
          </label>
        ))
      ) : (
        <p className="helper">Create commitments in Tasks to link them here.</p>
      )}
    </fieldset>
  )
  return (
    <>
      <section className="studio-masthead">
        <div>
          <span className="eyebrow">INTENTION INTO PRACTICE</span>
          <h2>
            Build a life
            <br />
            <span>with direction.</span>
          </h2>
          <p>
            Your study, projects, and spiritual rhythms. One considered
            workspace.
          </p>
        </div>
        <div className="studio-orbit" aria-hidden="true">
          <div />
          <div />
          <div />
          <Sparkles size={30} />
          <span>SMALL STEPS · DEEP ROOTS</span>
        </div>
      </section>
      <nav className="studio-tabs" aria-label="Growth studio tools">
        {tabs.map(({ name, icon: Icon }) => (
          <button
            key={name}
            aria-current={tab === name ? 'page' : undefined}
            className={tab === name ? 'active' : ''}
            onClick={() => setTab(name)}
          >
            <Icon size={17} />
            {name}
          </button>
        ))}
      </nav>
      <div className="studio-section-heading">
        <div>
          <span className="studio-label">YOUR {tab.toUpperCase()}</span>
          <h2>
            {tab === 'Academy'
              ? 'Learn with a clear horizon.'
              : tab === 'Projects'
                ? 'Big ambitions. Visible steps.'
                : tab === 'Spiritual'
                  ? 'Make room for what anchors you.'
                  : tab === 'Weekly review'
                    ? 'Pause. Notice. Begin again.'
                    : 'A nudge at the right moment.'}
          </h2>
        </div>
        <button
          className="button primary"
          disabled={disabled || (tab === 'Reminders' && !activeTasks.length)}
          onClick={() => open(collections[tab])}
        >
          <Plus size={16} />
          {tab === 'Academy'
            ? 'Add course'
            : tab === 'Projects'
              ? 'New project'
              : tab === 'Spiritual'
                ? 'New plan'
                : tab === 'Weekly review'
                  ? 'Write review'
                  : 'Add reminder'}
        </button>
      </div>
      {['Academy', 'Projects', 'Spiritual'].includes(tab) && (
        <label className="studio-archive">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />{' '}
          Include archived
        </label>
      )}
      {tab === 'Academy' && (
        <>
          <div className="studio-grid">
            {w.courses
              .filter((c) => showArchived || !c.archived)
              .map((c) => (
                <article className="studio-card" key={c.id}>
                  <div className="studio-card-top">
                    <span className="studio-label">
                      {c.code || 'COURSE'}
                      {c.archived ? ' · ARCHIVED' : ''}
                    </span>
                    <div>
                      <button
                        className="icon-btn"
                        aria-label={`Edit ${c.title}`}
                        disabled={disabled}
                        onClick={() => open('courses', c.id)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`${c.archived ? 'Restore' : 'Archive'} ${c.title}`}
                        disabled={disabled}
                        onClick={() =>
                          void save({
                            ...w,
                            courses: w.courses.map((x) =>
                              x.id === c.id
                                ? { ...x, archived: !x.archived }
                                : x,
                            ),
                          })
                        }
                      >
                        <Archive size={16} />
                      </button>
                    </div>
                  </div>
                  <h3>{c.title}</h3>
                  <p className="studio-notes">
                    {c.notes || 'Keep assignments and examinations in sight.'}
                  </p>
                  <div className="studio-deadlines">
                    {[...c.assessments]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((a) => (
                        <label
                          className={`studio-check ${a.done ? 'is-done' : ''}`}
                          key={a.id}
                        >
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={a.done}
                            onChange={() =>
                              void save({
                                ...w,
                                courses: w.courses.map((x) =>
                                  x.id === c.id
                                    ? {
                                        ...x,
                                        assessments: x.assessments.map((y) =>
                                          y.id === a.id
                                            ? { ...y, done: !y.done }
                                            : y,
                                        ),
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                          <span>
                            <b>{a.title}</b>
                            <small
                              className={
                                !a.done && a.date < today ? 'review-due' : ''
                              }
                            >
                              {a.kind} · {a.date}
                              {!a.done && a.date < today ? ' · Overdue' : ''}
                            </small>
                          </span>
                        </label>
                      ))}
                  </div>
                  <button
                    className="text-link"
                    disabled={disabled || c.archived}
                    onClick={() => open('assessment', undefined, c.id)}
                  >
                    <Plus size={15} />
                    Add assignment or exam
                  </button>
                </article>
              ))}
          </div>
          {!w.courses.filter((c) => showArchived || !c.archived).length && (
            <StudioEmpty
              icon={<GraduationCap size={30} />}
              title="Your semester starts here."
              body="Create a course, add real deadlines, and build recall questions below. No sample activity is added."
            />
          )}
          <Learning
            workspace={w}
            today={today}
            disabled={disabled}
            save={save}
            editing={editing}
          />
        </>
      )}
      {tab === 'Projects' && (
        <>
          <div className="studio-grid">
            {w.projects
              .filter((p) => showArchived || !p.archived)
              .map((p) => {
                const done = p.steps.filter((s) => s.done).length
                return (
                  <article className="studio-card" key={p.id}>
                    <div className="studio-card-top">
                      <span className="studio-label">
                        {p.archived
                          ? 'ARCHIVED'
                          : p.date < today && done < p.steps.length
                            ? 'PAST TARGET DATE'
                            : `TARGET · ${p.date}`}
                      </span>
                      <div>
                        <button
                          className="icon-btn"
                          aria-label={`Edit ${p.title}`}
                          disabled={disabled}
                          onClick={() => open('projects', p.id)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={`${p.archived ? 'Restore' : 'Archive'} ${p.title}`}
                          disabled={disabled}
                          onClick={() =>
                            void save({
                              ...w,
                              projects: w.projects.map((x) =>
                                x.id === p.id
                                  ? { ...x, archived: !x.archived }
                                  : x,
                              ),
                            })
                          }
                        >
                          <Archive size={16} />
                        </button>
                      </div>
                    </div>
                    <h3>{p.title}</h3>
                    <p className="studio-notes">{p.notes}</p>
                    <div className="studio-progress">
                      <span
                        style={{ width: `${(done / p.steps.length) * 100}%` }}
                      />
                    </div>
                    <p className="helper">
                      {done} of {p.steps.length} defined steps complete
                      {p.sequential ? ' · Steps unlock in order' : ''}
                    </p>
                    {p.steps.map((s, i) => (
                      <label className="studio-check" key={s.id}>
                        <input
                          type="checkbox"
                          checked={s.done}
                          disabled={
                            disabled ||
                            p.archived ||
                            (p.sequential &&
                              p.steps.slice(0, i).some((x) => !x.done))
                          }
                          onChange={() =>
                            void save({
                              ...w,
                              projects: w.projects.map((x) =>
                                x.id === p.id ? toggleProjectStep(x, s.id) : x,
                              ),
                            })
                          }
                        />
                        <span>{s.title}</span>
                      </label>
                    ))}
                    {p.goalId && (
                      <p className="helper">
                        <Flag size={13} /> Goal:{' '}
                        {w.goals.find((g) => g.id === p.goalId)?.title}
                      </p>
                    )}
                    <details>
                      <summary>Linked commitments ({p.taskIds.length})</summary>
                      {p.taskIds.map((id) => (
                        <p className="helper" key={id}>
                          {w.tasks.find((t) => t.id === id)?.title}
                        </p>
                      ))}
                    </details>
                  </article>
                )
              })}
          </div>
          {!w.projects.filter((p) => showArchived || !p.archived).length && (
            <StudioEmpty
              icon={<Layers size={30} />}
              title="Give an ambition a structure."
              body="Define steps, link commitments and a goal, and optionally unlock each step in order. Project progress measures your defined steps."
            />
          )}
        </>
      )}
      {tab === 'Spiritual' && (
        <>
          <p className="studio-disclaimer">
            Private reading, prayer, and memorisation plans. Consistency records
            describe practice; they do not measure spiritual maturity. Notes
            stay out of coach context.
          </p>
          <div className="studio-grid">
            {w.spiritualPlans
              .filter((p) => showArchived || !p.archived)
              .map((p) => (
                <article className="studio-card" key={p.id}>
                  <div className="studio-card-top">
                    <span className="studio-label">
                      {p.kind} ·{' '}
                      {p.archived
                        ? 'ARCHIVED'
                        : `${p.items.filter((i) => i.completedOn).length}/${p.items.length} RECORDED`}
                    </span>
                    <div>
                      <button
                        className="icon-btn"
                        aria-label={`Edit ${p.title}`}
                        disabled={disabled}
                        onClick={() => open('spiritualPlans', p.id)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`${p.archived ? 'Restore' : 'Archive'} ${p.title}`}
                        disabled={disabled}
                        onClick={() =>
                          void save({
                            ...w,
                            spiritualPlans: w.spiritualPlans.map((x) =>
                              x.id === p.id
                                ? { ...x, archived: !x.archived }
                                : x,
                            ),
                          })
                        }
                      >
                        <Archive size={16} />
                      </button>
                    </div>
                  </div>
                  <h3>{p.title}</h3>
                  <p className="studio-notes">{p.notes}</p>
                  {p.items.map((item, i) => (
                    <label className="studio-check" key={item.id}>
                      <input
                        type="checkbox"
                        checked={!!item.completedOn}
                        disabled={disabled || p.archived || p.start > today}
                        onChange={() => {
                          if (
                            item.completedOn &&
                            !confirm('Remove this individual practice record?')
                          )
                            return
                          void save({
                            ...w,
                            spiritualPlans: w.spiritualPlans.map((x) =>
                              x.id === p.id
                                ? {
                                    ...x,
                                    items: x.items.map((y) =>
                                      y.id === item.id
                                        ? {
                                            ...y,
                                            completedOn: y.completedOn
                                              ? undefined
                                              : today,
                                          }
                                        : y,
                                    ),
                                  }
                                : x,
                            ),
                          })
                        }}
                      />
                      <span>
                        <b>{item.title}</b>
                        <small>
                          {item.completedOn
                            ? `Recorded ${item.completedOn}`
                            : `Suggested ${addDay(p.start, i)}`}
                        </small>
                      </span>
                    </label>
                  ))}
                </article>
              ))}
          </div>
          {!w.spiritualPlans.filter((p) => showArchived || !p.archived)
            .length && (
            <StudioEmpty
              icon={<BookOpen size={30} />}
              title="A rhythm you can return to."
              body="Write one passage, prayer session, or memory practice per line. Each receives a suggested day, with flexible completion."
            />
          )}
        </>
      )}
      {tab === 'Weekly review' && (
        <>
          <section className="studio-week">
            <div>
              <span className="studio-label">7 DAYS ENDING {today}</span>
              <h3>Your week, honestly.</h3>
              <p>
                {summary.done} of {summary.total} eligible commitments
                completed.
              </p>
            </div>
            <div>
              <strong>{formatPercent(summary.completion)}</strong>
              <span>completion</span>
            </div>
            <div>
              <strong>{summary.focusMinutes}</strong>
              <span>recorded focus minutes</span>
            </div>
            <div>
              <strong>{summary.reviews}</strong>
              <span>recall reviews</span>
            </div>
          </section>
          <div className="studio-grid">
            {[...w.weeklyReviews]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((r) => (
                <article className="studio-card" key={r.id}>
                  <div className="studio-card-top">
                    <span className="studio-label">REVIEW · {r.date}</span>
                    <button
                      className="icon-btn"
                      aria-label={`Edit review ${r.date}`}
                      disabled={disabled}
                      onClick={() => open('weeklyReviews', r.id)}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                  <h3>The next chapter.</h3>
                  {r.win && (
                    <>
                      <h4>What helped</h4>
                      <p className="studio-notes">{r.win}</p>
                    </>
                  )}
                  {r.obstacle && (
                    <>
                      <h4>What got in the way</h4>
                      <p className="studio-notes">{r.obstacle}</p>
                    </>
                  )}
                  <h4>My next small change</h4>
                  <p className="studio-notes">{r.next}</p>
                  {r.taskIds.map((id) => (
                    <p className="studio-priority" key={id}>
                      <Check size={14} />
                      {w.tasks.find((t) => t.id === id)?.title}
                    </p>
                  ))}
                  <button
                    className="text-link"
                    disabled={disabled}
                    onClick={() => {
                      if (confirm('Delete this individual weekly reflection?'))
                        void save({
                          ...w,
                          weeklyReviews: w.weeklyReviews.filter(
                            (x) => x.id !== r.id,
                          ),
                        })
                    }}
                  >
                    Delete reflection
                  </button>
                </article>
              ))}
          </div>
          {!w.weeklyReviews.length && (
            <StudioEmpty
              icon={<CalendarDays size={30} />}
              title="Keep the lesson. Change the plan."
              body="Reflect on the past seven days and choose up to three commitments for your next chapter. Your reflections stay private."
            />
          )}
        </>
      )}
      {tab === 'Reminders' && (
        <>
          <PushSettings scope={scope} disabled={disabled} />
          <p className="studio-disclaimer">
            Reminders use your workspace timezone and respect quiet hours in
            Settings. In-app delivery needs an open page. Browser notifications
            also need permission in Settings; closed-device delivery is not
            enabled here.
          </p>
          <div className="studio-grid">
            {w.reminders.map((r) => (
              <article className="studio-card" key={r.id}>
                <span className="studio-label">
                  SCHEDULED DAYS ONLY · {w.preferences.timezone}
                </span>
                <h3>{w.tasks.find((t) => t.id === r.taskId)?.title}</h3>
                <div className="studio-reminder-time">{r.time}</div>
                <p className="helper">
                  {r.enabled ? 'Active' : 'Paused'} · Completed and skipped
                  commitments are excluded.
                </p>
                <div className="studio-actions">
                  <button
                    className="button secondary"
                    disabled={disabled}
                    onClick={() => open('reminders', r.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="button secondary"
                    disabled={disabled}
                    onClick={() =>
                      void save({
                        ...w,
                        reminders: w.reminders.map((x) =>
                          x.id === r.id ? { ...x, enabled: !x.enabled } : x,
                        ),
                      })
                    }
                  >
                    {r.enabled ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    className="text-link"
                    disabled={disabled}
                    onClick={() => {
                      if (
                        confirm(
                          'Remove this reminder? Your commitment is kept.',
                        )
                      )
                        void save({
                          ...w,
                          reminders: w.reminders.filter((x) => x.id !== r.id),
                        })
                    }}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!w.reminders.length && (
            <StudioEmpty
              icon={<Bell size={30} />}
              title="Give a routine its moment."
              body="Create a commitment first, then choose a time to be reminded on its scheduled days."
            />
          )}
        </>
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(isOpen) => {
          if (!isOpen && !disabled) close()
        }}
      >
        <DialogContent className="daystar-dialog">
          <DialogHeader>
            <DialogTitle>
              {editor?.id ? 'Edit' : 'Create'}{' '}
              {editor?.collection === 'assessment'
                ? 'deadline'
                : editor?.collection === 'courses'
                  ? 'course'
                  : editor?.collection === 'projects'
                    ? 'project'
                    : editor?.collection === 'spiritualPlans'
                      ? 'spiritual plan'
                      : editor?.collection === 'weeklyReviews'
                        ? 'weekly review'
                        : 'reminder'}
            </DialogTitle>
            <DialogDescription>
              Saved privately to your workspace. Changes appear after a
              successful save.
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <form className="studio-form" onSubmit={submit}>
              {['courses', 'projects', 'spiritualPlans', 'assessment'].includes(
                editor.collection,
              ) && (
                <Field label="Title">
                  <input
                    name="title"
                    required
                    maxLength={200}
                    defaultValue={
                      current?.title ?? project?.title ?? plan?.title
                    }
                  />
                </Field>
              )}
              {editor.collection === 'courses' && (
                <Field label="Course code (optional)">
                  <input
                    name="code"
                    maxLength={40}
                    defaultValue={current?.code}
                  />
                </Field>
              )}
              {editor.collection === 'assessment' && (
                <>
                  <Field label="Type">
                    <select name="kind">
                      <option value="assignment">Assignment</option>
                      <option value="exam">Exam</option>
                    </select>
                  </Field>
                  <Field label="Deadline">
                    <input
                      type="date"
                      name="date"
                      required
                      defaultValue={today}
                    />
                  </Field>
                </>
              )}
              {editor.collection === 'projects' && (
                <>
                  <Field label="Target date">
                    <input
                      type="date"
                      name="date"
                      required
                      defaultValue={project?.date ?? addDay(today, 14)}
                    />
                  </Field>
                  <Field label="Related goal">
                    <select name="goalId" defaultValue={project?.goalId ?? ''}>
                      <option value="">No linked goal</option>
                      {w.goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {!project && (
                    <>
                      <Field label="Defined steps — one per line">
                        <textarea
                          name="steps"
                          required
                          rows={5}
                          maxLength={20000}
                          placeholder={
                            'Define the outcome\nComplete the first draft\nReview and deliver'
                          }
                        />
                      </Field>
                      <label className="studio-checkbox">
                        <input type="checkbox" name="sequential" />
                        Unlock steps in order
                      </label>
                    </>
                  )}
                  {taskChoices(project?.taskIds)}
                </>
              )}
              {editor.collection === 'spiritualPlans' && (
                <>
                  <Field label="Practice">
                    <select name="kind" defaultValue={plan?.kind ?? 'reading'}>
                      <option value="reading">Bible reading</option>
                      <option value="prayer">Prayer sessions</option>
                      <option value="scripture">Scripture memorisation</option>
                    </select>
                  </Field>
                  <Field label="Start date">
                    <input
                      type="date"
                      name="start"
                      required
                      max={
                        plan?.items.some((i) => i.completedOn)
                          ? [...plan.items]
                              .filter((i) => i.completedOn)
                              .map((i) => i.completedOn!)
                              .sort()[0]
                          : undefined
                      }
                      defaultValue={plan?.start ?? today}
                    />
                  </Field>
                  {!plan && (
                    <Field label="Passages or sessions — one per line">
                      <textarea
                        name="items"
                        required
                        rows={6}
                        maxLength={73000}
                        placeholder={'Psalm 23\nPsalm 27\nPsalm 46'}
                      />
                    </Field>
                  )}
                </>
              )}
              {['courses', 'projects', 'spiritualPlans'].includes(
                editor.collection,
              ) && (
                <Field label="Private notes">
                  <textarea
                    name="notes"
                    rows={3}
                    maxLength={5000}
                    defaultValue={
                      current?.notes ?? project?.notes ?? plan?.notes
                    }
                  />
                </Field>
              )}
              {editor.collection === 'weeklyReviews' && (
                <>
                  <p className="helper">
                    Seven days ending {review?.date ?? today}. Review facts
                    separately from your interpretation.
                  </p>
                  <Field label="What helped this week?">
                    <textarea
                      name="win"
                      rows={3}
                      maxLength={3000}
                      defaultValue={review?.win}
                    />
                  </Field>
                  <Field label="What got in the way?">
                    <textarea
                      name="obstacle"
                      rows={3}
                      maxLength={3000}
                      defaultValue={review?.obstacle}
                    />
                  </Field>
                  <Field label="One small change for next week">
                    <textarea
                      name="next"
                      required
                      rows={3}
                      maxLength={3000}
                      defaultValue={review?.next}
                    />
                  </Field>
                  <p className="helper">Choose up to three priorities.</p>
                  {taskChoices(review?.taskIds)}
                </>
              )}
              {editor.collection === 'reminders' && (
                <>
                  <Field label="Commitment">
                    <select
                      name="taskId"
                      required
                      defaultValue={reminder?.taskId}
                    >
                      {activeTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Reminder time · ${w.preferences.timezone}`}>
                    <input
                      type="time"
                      name="time"
                      required
                      defaultValue={reminder?.time ?? '09:00'}
                    />
                  </Field>
                  <p className="helper">
                    Saving activates this reminder. Quiet hours still apply.
                  </p>
                </>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="studio-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={disabled}
                  onClick={close}
                >
                  Cancel
                </button>
                <button
                  className="button primary"
                  disabled={disabled}
                  type="submit"
                >
                  {disabled ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
function StudioEmpty({
  icon,
  title,
  body,
}: {
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <div className="studio-empty">
      {icon}
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}
