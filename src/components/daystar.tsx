import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Home,
  CheckSquare,
  ChartNoAxesCombined,
  BookOpen,
  Settings,
  Flag,
  CalendarDays,
  Timer,
  Sparkles,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  Sun,
  Leaf,
  GraduationCap,
  BriefcaseBusiness,
  Heart,
  Sprout,
  Check,
  Circle,
  Play,
  Pause,
  Square,
  Download,
  Upload,
  LogOut,
  Cloud,
  MoreHorizontal,
  Pencil,
  Trash2,
  Target,
  Menu,
  X,
} from 'lucide-react'
import {
  getUser,
  login,
  signup,
  logout,
  requestPasswordRecovery,
  updateUser,
} from '@/lib/auth-client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Learning } from './learning'
import { GrowthStudio, DailyBrief } from './growth-studio'
import { CommandMenu } from './command-menu'
import { enableNotifications, deliverNotification } from '@/lib/notifications'
import {
  readSnapshot,
  syncDecision,
  writeSnapshot,
} from '@/lib/offline-workspace'
import type { OfflineSnapshot } from '@/lib/offline-workspace'
import {
  formatPercent,
  dueReminders,
  overdueOccurrences,
  initialWorkspace,
  dateKey,
  addDay,
  occurrencesFor,
  amount,
  isComplete,
  targetPercent,
  metrics,
  preserveHistory,
  restoreTask,
  putOccurrence,
  remainingTime,
  mergeBackup,
  workspaceSchema,
} from '@/lib/model'
import type { Workspace, Task, Occurrence } from '@/lib/model'

type Page =
  | 'Growth Studio'
  | 'Home'
  | 'Tasks'
  | 'Insights'
  | 'Journal'
  | 'Settings'
  | 'Goals'
  | 'Planner'
  | 'Focus Room'
  | 'Accountability Coach'
type Modal = {
  type: 'task' | 'journal' | 'goal' | 'progress' | 'auth' | 'area'
  id?: string
}
const mainNav = [
  { name: 'Home', icon: Home },
  { name: 'Tasks', icon: CheckSquare },
  { name: 'Insights', icon: ChartNoAxesCombined },
  { name: 'Journal', icon: BookOpen },
] as const
const extraNav = [
  { name: 'Growth Studio', icon: Sprout },
  { name: 'Goals', icon: Flag },
  { name: 'Planner', icon: CalendarDays },
  { name: 'Focus Room', icon: Timer },
  { name: 'Accountability Coach', icon: Sparkles },
] as const
const areaIcons = [Leaf, GraduationCap, BriefcaseBusiness, Heart, Sprout]
const uid = () => crypto.randomUUID()
const pc = formatPercent
function savedRecordCount(w: Workspace) {
  return (
    w.courses.length +
    w.projects.length +
    w.spiritualPlans.length +
    w.weeklyReviews.length +
    w.reminders.length +
    w.learning.length +
    w.tasks.length +
    w.occurrences.length +
    w.journals.length +
    w.goals.length +
    w.focus.length
  )
}
const nice = (
  d: string,
  opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' },
) => new Date(d + 'T12:00:00').toLocaleDateString('en', opts)
function Field({
  label,
  children,
  wide = false,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}
function Progress({ value, color }: { value: number | null; color?: string }) {
  return (
    <div className="progress-track">
      <span style={{ width: `${value ?? 0}%`, background: color }} />
    </div>
  )
}
function Empty({
  icon: Icon = Sprout,
  title,
  body,
  action,
  label,
}: {
  icon?: typeof Sprout
  title: string
  body: string
  action?: () => void
  label?: string
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">
        <Icon size={25} strokeWidth={1.3} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && (
        <button className="text-link" onClick={action}>
          {label}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  )
}
export default function Daystar() {
  const [w, setW] = useState<Workspace>(initialWorkspace)
  const [page, setPage] = useState<Page>('Home'),
    [modal, setModal] = useState<Modal | null>(null)
  const [today, setToday] = useState(dateKey()),
    [date, setDate] = useState(dateKey()),
    [loaded, setLoaded] = useState(false),
    [saving, setSaving] = useState(false),
    [offlinePending, setOfflinePending] = useState(false),
    [offlineStorageAvailable, setOfflineStorageAvailable] = useState<
      boolean | null
    >(null),
    [offlineConflict, setOfflineConflict] = useState<{
      local: OfflineSnapshot
      cloud: Workspace
      revision: number
      scope: string
    } | null>(null),
    [error, setError] = useState(''),
    [mode, setMode] = useState('device'),
    [user, setUser] = useState<{ email?: string; name?: string } | null>(null),
    [search, setSearch] = useState(''),
    [area, setArea] = useState('all'),
    [range, setRange] = useState(7),
    [tick, setTick] = useState(Date.now()),
    [chat, setChat] = useState<{ role: string; text: string }[]>([]),
    [thinking, setThinking] = useState(false),
    [authMode, setAuthMode] = useState('login'),
    [authPending, setAuthPending] = useState(false),
    [menu, setMenu] = useState(false),
    [permission, setPermission] = useState('not requested')
  const commandOpen = useRef(false)
  const scope = useRef(''),
    loadRef = useRef<() => Promise<void>>(async () => {}),
    authBusy = useRef(false),
    modalState = useRef(modal),
    learningEditing = useRef(false),
    reminderAttempt = useRef(''),
    revision = useRef(0),
    busy = useRef(false),
    latest = useRef(w),
    file = useRef<HTMLInputElement>(null),
    focusFinishing = useRef(false)
  useEffect(() => {
    latest.current = w
  }, [w])
  useEffect(() => {
    modalState.current = modal
  }, [modal])
  async function load() {
    setError('')
    setLoaded(false)
    let offlineReadFailed = false
    const cached = await readSnapshot().catch(() => {
      offlineReadFailed = true
      return null
    })
    if (offlineReadFailed) setOfflineStorageAvailable(false)
    try {
      const res = await fetch(
        '/api/workspace?timezone=' +
          encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone),
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to load workspace')
      const valid = workspaceSchema.parse(data.data)
      const scopedCache =
        cached?.scope === data.scope
          ? cached
          : await readSnapshot(data.scope).catch(() => null)
      const plan = syncDecision(scopedCache, data.scope, data.revision)
      if (plan === 'sync' && scopedCache) {
        const localDay = dateKey(valid.preferences.timezone)
        latest.current = valid
        revision.current = data.revision
        scope.current = data.scope
        setW(valid)
        setMode(data.mode)
        setToday(localDay)
        setDate(localDay)
        setLoaded(true)
        setOfflinePending(true)
        await save(scopedCache.data)
        return
      } else if (plan === 'conflict' && scopedCache) {
        setOfflineConflict({
          local: scopedCache,
          cloud: valid,
          revision: data.revision,
          scope: data.scope,
        })
        setOfflinePending(true)
      } else {
        setOfflineConflict(null)
        setOfflinePending(false)
      }
      latest.current = valid
      setW(valid)
      revision.current = data.revision
      scope.current = data.scope
      setMode(data.mode)
      const d = dateKey(valid.preferences.timezone)
      setToday(d)
      setDate(d)
      setLoaded(true)
      if (!scopedCache?.pending)
        await writeSnapshot({
          scope: data.scope,
          revision: data.revision,
          data: valid,
          savedAt: new Date().toISOString(),
          pending: false,
        })
          .then(() => setOfflineStorageAvailable(true))
          .catch(() => setOfflineStorageAvailable(false))
    } catch (e) {
      if (cached) {
        try {
          const valid = workspaceSchema.parse(cached.data)
          latest.current = valid
          setW(valid)
          revision.current = cached.revision
          scope.current = cached.scope
          setMode('offline')
          setOfflinePending(cached.pending)
          setLoaded(true)
          setError(
            cached.pending
              ? 'You are offline. New changes are saved on this device and will sync when you reconnect.'
              : 'You are offline. Showing the last saved copy from this device.',
          )
          return
        } catch {
          setError(
            'The saved offline copy could not be read. Reconnect to load your cloud workspace.',
          )
        }
      } else {
        setError(e instanceof Error ? e.message : 'Unable to load workspace')
      }
    }
  }
  loadRef.current = load
  useEffect(() => {
    async function init() {
      try {
        const u = await getUser()
        setUser(u ? { email: u.email, name: u.name } : null)
      } catch {
        /* The current account session may be unavailable while offline. */
      }
      await loadRef.current()
    }
    void init()
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js').catch(() => {})
    const reconnect = () => {
      if (
        modalState.current ||
        learningEditing.current ||
        busy.current ||
        latest.current.focus.some(
          (session) =>
            session.status === 'running' || session.status === 'paused',
        )
      )
        return
      void loadRef.current()
    }
    window.addEventListener('online', reconnect)
    const timer = setInterval(() => setTick(Date.now()), 1000)
    if ('Notification' in window) setPermission(Notification.permission)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', reconnect)
    }
  }, [])
  useEffect(() => {
    const d = dateKey(w.preferences.timezone, new Date(tick))
    if (d !== today) {
      setToday(d)
      if (date === today) setDate(d)
    }
  }, [tick, w.preferences.timezone, today, date])
  async function save(next: Workspace) {
    if (busy.current) {
      toast('A save is already in progress. Please try again in a moment.')
      return false
    }
    busy.current = true
    setSaving(true)
    setError('')
    try {
      const valid = workspaceSchema.parse(next)
      const res = await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: valid,
          revision: revision.current,
          scope: scope.current,
        }),
      }).catch(async () => {
        await writeSnapshot({
          scope: scope.current,
          revision: revision.current,
          data: valid,
          savedAt: new Date().toISOString(),
          pending: true,
        })
        setOfflineStorageAvailable(true)
        return null
      })
      if (!res) {
        setW(valid)
        latest.current = valid
        setOfflinePending(true)
        setMode('offline')
        setError(
          'Offline changes are saved on this device and waiting to sync.',
        )
        toast.success('Saved on this device. It will sync when you reconnect.')
        return true
      }
      const result = await res.json()
      if ([502, 503, 504].includes(res.status)) {
        await writeSnapshot({
          scope: scope.current,
          revision: revision.current,
          data: valid,
          savedAt: new Date().toISOString(),
          pending: true,
        })
        setOfflineStorageAvailable(true)
        setW(valid)
        latest.current = valid
        setOfflinePending(true)
        setMode('offline')
        setError(
          'The workspace is unavailable. Changes are saved on this device and waiting to sync.',
        )
        toast.success(
          'Saved on this device. It will sync when the workspace is available.',
        )
        return true
      }
      if (!res.ok) throw new Error(result.error || 'Saving failed')
      revision.current = result.revision
      setW(valid)
      latest.current = valid
      setOfflinePending(false)
      setOfflineConflict(null)
      await writeSnapshot({
        scope: scope.current,
        revision: result.revision,
        data: valid,
        savedAt: new Date().toISOString(),
        pending: false,
      })
        .then(() => setOfflineStorageAvailable(true))
        .catch(() => setOfflineStorageAvailable(false))
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving failed')
      toast.error(
        'Changes are not saved. Your form stays open so you can retry.',
      )
      return false
    } finally {
      setSaving(false)
      busy.current = false
    }
  }
  useEffect(() => {
    const interval = setInterval(async () => {
      if (
        !loaded ||
        modal ||
        learningEditing.current ||
        commandOpen.current ||
        busy.current ||
        document.visibilityState !== 'visible' ||
        latest.current.focus.some(
          (s) => s.status === 'running' || s.status === 'paused',
        )
      )
        return
      if (offlinePending) {
        if (navigator.onLine) void loadRef.current()
        return
      }
      try {
        const priorRevision = revision.current
        const priorScope = scope.current
        const res = await fetch(
          '/api/workspace?timezone=' +
            encodeURIComponent(
              Intl.DateTimeFormat().resolvedOptions().timeZone,
            ),
        )
        if (!res.ok) return
        const data = await res.json()
        if (
          busy.current ||
          modalState.current ||
          learningEditing.current ||
          commandOpen.current ||
          revision.current !== priorRevision ||
          scope.current !== priorScope ||
          data.scope !== scope.current
        )
          return
        if (data.revision !== revision.current) {
          const next = workspaceSchema.parse(data.data)
          setW(next)
          latest.current = next
          revision.current = data.revision
        }
      } catch {
        /* The next save reports connection failures. */
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [loaded, modal, offlinePending])
  const list = occurrencesFor(w, date),
    stats = metrics(list),
    week = Array.from({ length: 7 }, (_, i) => addDay(date, i - 6))
  const overdue = useMemo(() => overdueOccurrences(w, today), [w, today])
  const activeFocus = w.focus.find(
    (s) => s.status === 'running' || s.status === 'paused',
  )
  const left = activeFocus
    ? remainingTime(activeFocus, tick)
    : w.preferences.focusMinutes * 60
  useEffect(() => {
    if (
      activeFocus?.status === 'running' &&
      left === 0 &&
      !focusFinishing.current &&
      !busy.current
    ) {
      focusFinishing.current = true
      void save({
        ...latest.current,
        focus: latest.current.focus.map((s) =>
          s.id === activeFocus.id
            ? {
                ...s,
                status: 'completed',
                remaining: 0,
                runningSince: null,
                actual: s.duration,
              }
            : s,
        ),
      }).then(() => {
        focusFinishing.current = false
      })
    }
  }, [activeFocus?.id, activeFocus?.status, left])
  useEffect(() => {
    if (
      !loaded ||
      !w.preferences.reminders ||
      w.preferences.lastReminder === today ||
      modalState.current ||
      learningEditing.current ||
      authBusy.current ||
      busy.current
    )
      return
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: w.preferences.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(tick))
    const p = w.preferences
    const quiet =
      p.quietStart === p.quietEnd
        ? false
        : p.quietStart < p.quietEnd
          ? time >= p.quietStart && time < p.quietEnd
          : time >= p.quietStart || time < p.quietEnd
    if (
      time === p.reminderTime &&
      !quiet &&
      reminderAttempt.current !== today
    ) {
      reminderAttempt.current = today
      void save({
        ...latest.current,
        preferences: { ...p, lastReminder: today },
      }).then((saved) => {
        if (!saved) return
        toast('Your daily check-in is ready. Review today’s commitments.')
        void deliverNotification().catch(() =>
          toast(
            'Browser notification unavailable. Your in-app reminder is ready.',
          ),
        )
      })
    }
  }, [tick, loaded, w.preferences, today])
  useEffect(() => {
    if (
      !loaded ||
      busy.current ||
      modalState.current ||
      learningEditing.current ||
      authBusy.current
    )
      return
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: w.preferences.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(tick))
    const due = dueReminders(w, today, time)
    if (!due.length) return
    const ids = new Set(due.map((r) => r.id))
    void save({
      ...latest.current,
      reminders: latest.current.reminders.map((r) =>
        ids.has(r.id) ? { ...r, lastDelivered: today } : r,
      ),
    }).then((saved) => {
      if (!saved) return
      const titles = due
        .map((r) => latest.current.tasks.find((t) => t.id === r.taskId)?.title)
        .filter(Boolean)
        .join(' · ')
      toast(`Time for: ${titles}`)
      void deliverNotification(titles, 'daystar-routines').catch(() => {})
    })
  }, [tick, loaded, w, today])
  function navigate(p: Page) {
    learningEditing.current = false
    setPage(p)
    setMenu(false)
    setSearch('')
  }
  async function complete(o: Occurrence) {
    if (o.date > today) {
      toast('Future commitments cannot be completed early.')
      return
    }
    if (o.snapshot.target > 0) {
      setModal({ type: 'progress', id: o.id })
      return
    }
    await save(
      putOccurrence(w, { ...o, status: isComplete(o) ? 'open' : 'completed' }),
    )
  }
  async function archive(t: Task) {
    if (
      !confirm(
        `Archive “${t.title}” and cancel uncompleted occurrences from today onward? Historical records and logged progress are preserved.`,
      )
    )
      return
    const next = preserveHistory(w, today)
    await save({
      ...next,
      tasks: next.tasks.map((x) =>
        x.id === t.id
          ? { ...x, archivedFrom: today, updatedAt: new Date().toISOString() }
          : x,
      ),
      occurrences: next.occurrences.map((o) =>
        o.taskId === t.id && o.date >= today && !isComplete(o) && !amount(o)
          ? { ...o, status: 'skipped' }
          : o,
      ),
    })
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!modal) return
    if (modal.type === 'auth' && authBusy.current) return
    if (!loaded && modal.type !== 'auth') {
      toast.error('Connect to your workspace before saving.')
      return
    }
    const f = new FormData(e.currentTarget),
      v = (key: string) => String(f.get(key) || '')
    const now = new Date().toISOString()
    let next = w
    try {
      if (modal.type === 'auth') {
        authBusy.current = true
        setAuthPending(true)
        if (authMode === 'newpassword') {
          await updateUser({ password: v('password') })
          toast.success('Password updated.')
          setModal(null)
          return
        }
        if (authMode === 'recover') {
          await requestPasswordRecovery(v('email'))
          toast.success('Check your email for a recovery link.')
          return
        }
        const priorMode = mode
        const priorScope = scope.current
        const priorWorkspace = latest.current
        const u =
          authMode === 'signup'
            ? await signup(v('email'), v('password'), { full_name: v('name') })
            : await login(v('email'), v('password'))
        if (authMode === 'signup' && !u.confirmedAt) {
          toast.success('Check your email to confirm your account.')
          return
        }
        setUser({ email: u.email, name: u.name })
        setModal(null)
        await loadRef.current()
        if (
          priorMode !== 'account' &&
          priorScope !== scope.current &&
          savedRecordCount(priorWorkspace) > 0
        ) {
          const hasAccountRecords = savedRecordCount(latest.current) > 0
          const message = hasAccountRecords
            ? 'This browser has saved DAYSTAR records, and this account already has records too. Add the browser records that have new IDs? Existing account records with matching IDs will be kept. The browser workspace remains available when you sign out.'
            : 'This browser has saved DAYSTAR records. Add them to your account so they are available on your other devices? Your private browser copy remains available when you sign out.'
          if (confirm(message)) {
            const bothHaveActiveFocus =
              latest.current.focus.some(
                (session) =>
                  session.status === 'running' || session.status === 'paused',
              ) &&
              priorWorkspace.focus.some(
                (session) =>
                  session.status === 'running' || session.status === 'paused',
              )
            if (bothHaveActiveFocus) {
              toast.error(
                'Finish the active focus session on one workspace, then export and import the other copy.',
              )
            } else if (
              await save(mergeBackup(latest.current, priorWorkspace))
            ) {
              toast.success('Your browser records were added to your account.')
            }
          }
        }
        return
      }
      if (modal.type === 'task') {
        const existing = w.tasks.find((t) => t.id === modal.id)
        next = preserveHistory(w, today)
        const task: Task = {
          id: existing?.id ?? uid(),
          title: v('title'),
          description: v('description'),
          area: v('area'),
          unit: v('unit') === 'custom' ? v('customUnit') : v('unit'),
          target: Number(v('target')),
          date: v('date'),
          end: v('end') || undefined,
          effectiveFrom: existing ? today : undefined,
          pausedFrom: existing?.pausedFrom,
          archivedFrom: existing?.archivedFrom,
          recurrence: v('recurrence') as Task['recurrence'],
          weekdays: f.getAll('weekday').map(Number),
          priority: v('priority') as Task['priority'],
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        if (task.date < addDay(today, -3650) || task.date > addDay(today, 3650))
          throw new Error('Choose a start date within ten years of today.')
        if (task.end && task.end < task.date)
          throw new Error('The end date must follow the start date.')
        if (task.recurrence === 'selected' && !task.weekdays.length)
          throw new Error('Select at least one weekday.')
        next = {
          ...next,
          tasks: [...next.tasks.filter((t) => t.id !== task.id), task],
        }
      }
      if (modal.type === 'progress') {
        const o = list.find((x) => x.id === modal.id)
        if (!o) return
        if (o.date > today)
          throw new Error('Select today or a past date to record progress.')
        const value = Number(v('value'))
        if (!Number.isFinite(value) || value <= 0)
          throw new Error('Enter a positive progress amount.')
        next = putOccurrence(w, {
          ...o,
          status: 'open',
          entries: [...o.entries, { id: uid(), value, at: now }],
        })
      }
      if (modal.type === 'journal') {
        const entry = {
          id: modal.id ?? uid(),
          title: v('title'),
          body: v('body'),
          date: v('date'),
          area: v('area'),
          goalId: v('goalId'),
          updatedAt: now,
        }
        next = {
          ...w,
          journals: [...w.journals.filter((j) => j.id !== entry.id), entry],
        }
      }
      if (modal.type === 'goal') {
        const old = w.goals.find((g) => g.id === modal.id)
        const titles = v('milestones')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
        const goal = {
          id: old?.id ?? uid(),
          title: v('title'),
          description: v('description'),
          area: v('area'),
          date: v('date'),
          milestones: titles.map(
            (title) =>
              old?.milestones.find((m) => m.title === title) ?? {
                id: uid(),
                title,
                done: false,
              },
          ),
          taskIds: f.getAll('taskIds').map(String),
          notes: v('notes'),
          reviews: [
            ...(old?.reviews ?? []).slice(-99),
            { at: now, note: old ? 'Goal updated' : 'Goal created' },
          ],
        }
        next = {
          ...w,
          goals: [...w.goals.filter((g) => g.id !== goal.id), goal],
        }
      }
      if (modal.type === 'area') {
        const item = {
          id: modal.id ?? uid(),
          name: v('title'),
          color: v('color'),
        }
        next = {
          ...w,
          areas: modal.id
            ? w.areas.map((a) => (a.id === modal.id ? item : a))
            : [...w.areas, item],
        }
      }
      if (await save(next)) {
        setModal(null)
        toast.success('Saved to your workspace.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Please check the form.')
    } finally {
      authBusy.current = false
      setAuthPending(false)
    }
  }
  async function askCoach(message: string) {
    if (!message.trim() || thinking) return
    setChat((c) => [...c, { role: 'you', text: message }])
    setThinking(true)
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, scope: scope.current }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Coach unavailable')
      setChat((c) => [
        ...c,
        {
          role: data.mode === 'ai' ? 'AI coach' : 'Record-based coach',
          text: (data.notice ? data.notice + '\n\n' : '') + data.reply,
        },
      ])
    } catch (e) {
      setChat((c) => [
        ...c,
        {
          role: 'Service status',
          text: e instanceof Error ? e.message : 'The coach is unavailable.',
        },
      ])
    } finally {
      setThinking(false)
    }
  }
  async function focusAction(action: string) {
    if (!loaded) {
      toast.error('Connect to your workspace to record focus time.')
      return
    }
    if (action === 'start' || action === 'break') {
      if (activeFocus) return
      const duration =
        (action === 'break'
          ? w.preferences.breakMinutes
          : w.preferences.focusMinutes) * 60
      await save({
        ...w,
        focus: [
          ...w.focus,
          {
            id: uid(),
            taskId:
              (document.getElementById('focus-task') as HTMLSelectElement)
                ?.value ?? '',
            startedAt: new Date().toISOString(),
            duration,
            remaining: duration,
            runningSince: Date.now(),
            status: 'running',
            kind: action === 'break' ? 'break' : 'focus',
            actual: 0,
          },
        ],
      })
      return
    }
    if (!activeFocus) return
    const remaining = remainingTime(activeFocus)
    await save({
      ...w,
      focus: w.focus.map((s) =>
        s.id === activeFocus.id
          ? {
              ...s,
              remaining,
              runningSince: action === 'resume' ? Date.now() : null,
              status:
                action === 'resume'
                  ? 'running'
                  : action === 'pause'
                    ? 'paused'
                    : remaining === 0
                      ? 'completed'
                      : 'interrupted',
              actual: s.duration - remaining,
            }
          : s,
      ),
    })
  }
  function downloadWorkspace(data: Workspace, filename: string) {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: 'daystar-backup',
            exportedAt: new Date().toISOString(),
            data,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  function download() {
    downloadWorkspace(w, `daystar-${today}.json`)
    toast.success('Backup downloaded. Keep it somewhere private.')
  }
  async function keepCloudCopy() {
    const conflict = offlineConflict
    if (!conflict) return
    if (
      !confirm(
        'Use the newer cloud copy on this device? Your offline version will stop syncing. Download the offline copy first if you need its changes.',
      )
    )
      return
    try {
      await writeSnapshot({
        scope: conflict.scope,
        revision: conflict.revision,
        data: conflict.cloud,
        savedAt: new Date().toISOString(),
        pending: false,
      })
      setW(conflict.cloud)
      latest.current = conflict.cloud
      revision.current = conflict.revision
      scope.current = conflict.scope
      setOfflinePending(false)
      setOfflineConflict(null)
      setError('')
      toast.success('This device is using the cloud copy.')
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not update the offline copy.',
      )
    }
  }
  async function keepDeviceCopy() {
    const conflict = offlineConflict
    if (!conflict) return
    if (
      !confirm(
        'Replace the newer cloud workspace with this device’s saved version? Download both copies first if you need a recovery path.',
      )
    )
      return
    setSaving(true)
    busy.current = true
    try {
      const response = await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: conflict.local.data,
          revision: conflict.revision,
          scope: conflict.scope,
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not sync this device copy.')
      revision.current = result.revision
      scope.current = conflict.scope
      setW(conflict.local.data)
      latest.current = conflict.local.data
      setOfflinePending(false)
      setOfflineConflict(null)
      setError('')
      await writeSnapshot({
        scope: conflict.scope,
        revision: result.revision,
        data: conflict.local.data,
        savedAt: new Date().toISOString(),
        pending: false,
      })
      toast.success('Your device copy is now saved to the cloud.')
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not sync this device copy.',
      )
    } finally {
      busy.current = false
      setSaving(false)
    }
  }
  async function importFile(f: File) {
    try {
      if (f.size > 4000000)
        throw new Error('Choose a backup smaller than 4 MB.')
      const parsed = JSON.parse(await f.text())
      if (parsed.format !== 'daystar-backup')
        throw new Error(
          'This is not a compatible DAYSTAR v2 backup. Legacy records are not imported automatically.',
        )
      const backup = workspaceSchema.parse(parsed.data)
      if (
        !confirm(
          'Import new records from this backup? Matching IDs keep your current records. Preferences stay unchanged. No existing records are overwritten.',
        )
      )
        return
      if (await save(mergeBackup(w, backup)))
        toast.success('New records imported. Existing IDs were kept.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The backup is invalid.')
    }
  }
  function taskRows(items: Occurrence[]) {
    return items.length ? (
      <div className="task-list">
        {items.map((o) => {
          const done = isComplete(o),
            value = amount(o),
            a = w.areas.find((a) => a.id === o.snapshot.area)
          return (
            <div className={`task-row ${done ? 'done' : ''}`} key={o.id}>
              <button
                className={`task-check ${done ? 'checked' : ''}`}
                aria-label={`Record ${o.snapshot.title}`}
                onClick={() => complete(o)}
              >
                {done && <Check size={14} />}
              </button>
              <div className="task-details">
                <strong>{o.snapshot.title}</strong>
                <div>
                  <span className="area-dot" style={{ background: a?.color }} />
                  {a?.name ?? 'Other'}
                  <span className="meta-separator">·</span>
                  {o.snapshot.target > 0
                    ? `${value} / ${o.snapshot.target} ${o.snapshot.unit}`
                    : 'Simple commitment'}
                </div>
                {o.snapshot.target > 0 && (
                  <Progress value={targetPercent(o)} color={a?.color} />
                )}
              </div>
              <button
                title="Skip or restore this occurrence"
                onClick={async () => {
                  if (
                    confirm(
                      `${o.status === 'skipped' ? 'Restore' : 'Skip'} this occurrence? Skipped occurrences are excluded from your metrics.`,
                    )
                  )
                    await save(
                      putOccurrence(w, {
                        ...o,
                        status: o.status === 'skipped' ? 'open' : 'skipped',
                      }),
                    )
                }}
                className={`task-badge ${done ? 'success' : o.status === 'skipped' ? 'muted' : o.date < today ? 'late' : ''}`}
              >
                {o.status === 'skipped'
                  ? 'Skipped'
                  : done
                    ? 'Completed'
                    : o.date < today
                      ? 'Overdue'
                      : value > 0
                        ? 'In progress'
                        : o.snapshot.priority === 'High'
                          ? 'High priority'
                          : 'To do'}
              </button>
              <button
                className="icon-btn task-edit"
                aria-label={`Edit ${o.snapshot.title}`}
                onClick={() => setModal({ type: 'task', id: o.taskId })}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
          )
        })}
      </div>
    ) : (
      <Empty
        icon={CheckSquare}
        title="A little intention goes a long way."
        body="Give your day a direction. Start with one commitment that matters to you."
        action={() => setModal({ type: 'task' })}
        label="Add your first task"
      />
    )
  }
  function weekChart(days: string[]) {
    return (
      <div className="weekly-chart">
        {days.map((d) => {
          const m = metrics(occurrencesFor(w, d))
          return (
            <button
              key={d}
              title={`${nice(d)}: ${m.total ? pc(m.completion) : 'No tasks scheduled'}`}
              className={`chart-column ${d === date ? 'selected' : ''}`}
              onClick={() => setDate(d)}
            >
              <div className="chart-bar-space">
                <span
                  className={`chart-bar ${m.total ? 'has-data' : ''}`}
                  style={{
                    height: m.total
                      ? `${Math.max(3, m.completion ?? 0)}%`
                      : '4px',
                  }}
                />
                {m.total > 0 && <small>{pc(m.completion)}</small>}
              </div>
              <span>{nice(d, { weekday: 'short' }).slice(0, 1)}</span>
              <i className={d === date ? 'today-dot' : ''} />
            </button>
          )
        })}
      </div>
    )
  }
  const editTask = w.tasks.find((t) => t.id === modal?.id),
    editJournal = w.journals.find((j) => j.id === modal?.id),
    editGoal = w.goals.find((g) => g.id === modal?.id),
    editArea = w.areas.find((a) => a.id === modal?.id),
    editOcc = list.find((o) => o.id === modal?.id)
  const visibleList = list.filter(
    (o) =>
      (area === 'all' || o.snapshot.area === area) &&
      o.snapshot.title.toLowerCase().includes(search.toLowerCase()),
  )
  const areaSelect = (value?: string) => (
    <select name="area" defaultValue={value ?? w.areas[0]?.id}>
      {w.areas.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  )
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-content">
        Skip to workspace
      </a>
      {menu && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <button
          className="sidebar-close icon-btn"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X size={19} />
        </button>
        <a className="brand" href="/" aria-label="Daystar home">
          <Sun size={34} strokeWidth={1.1} />
          <div>
            DAYSTAR<span>PERSONAL GROWTH OS</span>
          </div>
        </a>
        <div className="nav-caption">YOUR WORKSPACE</div>
        <nav aria-label="Workspace">
          {mainNav.map((n) => (
            <button
              key={n.name}
              className={page === n.name ? 'active' : ''}
              aria-current={page === n.name ? 'page' : undefined}
              onClick={() => navigate(n.name)}
            >
              <n.icon size={19} />
              {n.name}
              {n.name === 'Tasks' && stats.total > 0 && (
                <span className="nav-count">{stats.remaining}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-divider" />
        <div className="nav-caption">GROW WITH INTENTION</div>
        <nav aria-label="Growth tools">
          {extraNav.map((n) => (
            <button
              key={n.name}
              className={page === n.name ? 'active' : ''}
              aria-current={page === n.name ? 'page' : undefined}
              onClick={() => navigate(n.name)}
            >
              <n.icon size={19} />
              {n.name}
              {n.name === 'Accountability Coach' && (
                <span className="new-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="little-note">
            <Sprout size={23} strokeWidth={1.1} />
            <p>
              Progress, not perfection.
              <br />
              <span>One intentional day at a time.</span>
            </p>
          </div>
          <button
            className={`settings-nav ${page === 'Settings' ? 'active' : ''}`}
            onClick={() => navigate('Settings')}
          >
            <Settings size={19} />
            Settings
          </button>
          <button
            className="profile"
            onClick={() => {
              if (user) navigate('Settings')
              else setModal({ type: 'auth' })
            }}
          >
            <span className="avatar">
              {w.preferences.name?.[0]?.toUpperCase() || 'Y'}
            </span>
            <span>
              <b>{w.preferences.name || 'Your personal space'}</b>
              <small>
                {user ? 'Personal account' : 'Make yourself at home'}
              </small>
            </span>
            <MoreHorizontal size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-btn"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={21} />
            </button>
            <span>Your workspace</span>
            <ChevronRight size={13} />
            <b>{page}</b>
          </div>
          <div className="top-actions">
            {loaded && (
              <CommandMenu
                workspace={w}
                navigate={navigate}
                edit={(type, id) => setModal({ type, id })}
                onOpenChange={(open) => {
                  commandOpen.current = open
                }}
              />
            )}

            <span className="save-status">
              <span className={error ? 'status-error' : ''} />
              {saving || authPending
                ? 'Saving…'
                : loaded
                  ? offlineConflict
                    ? 'Sync conflict'
                    : offlinePending
                      ? 'Saved on device'
                      : mode === 'offline'
                        ? 'Offline copy'
                        : user
                          ? 'Cloud saved'
                          : 'Private workspace'
                  : error
                    ? 'Connection failed'
                    : 'Connecting…'}
            </span>
            <button
              className="icon-btn notification-btn"
              aria-label="Reminder settings"
              onClick={() => navigate('Settings')}
            >
              <Bell size={19} />
              <i />
            </button>
            <button
              className="avatar small"
              aria-label="Account settings"
              onClick={() => navigate('Settings')}
            >
              {w.preferences.name?.[0]?.toUpperCase() || 'Y'}
            </button>
          </div>
        </header>
        <main id="workspace-content" tabIndex={-1}>
          {error && !modal && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button
                onClick={() => {
                  if (
                    confirm(
                      'Reload saved records? Unsaved form changes stay in the open form.',
                    )
                  )
                    void load()
                }}
              >
                Retry connection
              </button>
            </div>
          )}
          {offlineConflict && (
            <section
              className="sync-conflict"
              role="alert"
              aria-labelledby="sync-conflict-title"
            >
              <div>
                <strong id="sync-conflict-title">
                  This device and your cloud workspace both changed.
                </strong>
                <p>
                  Your offline copy is safe on this device. Download either
                  version before choosing which one to continue with.
                </p>
              </div>
              <div className="sync-conflict-actions">
                <button
                  className="button secondary"
                  onClick={() =>
                    downloadWorkspace(
                      offlineConflict.local.data,
                      `daystar-device-copy-${today}.json`,
                    )
                  }
                >
                  Download device copy
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    downloadWorkspace(
                      offlineConflict.cloud,
                      `daystar-cloud-copy-${today}.json`,
                    )
                  }
                >
                  Download cloud copy
                </button>
                <button
                  className="button secondary"
                  disabled={saving}
                  onClick={() => void keepCloudCopy()}
                >
                  Use cloud copy
                </button>
                <button
                  className="button primary"
                  disabled={saving}
                  onClick={() => void keepDeviceCopy()}
                >
                  Use device copy for cloud
                </button>
              </div>
            </section>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === 'Home'
                  ? 'A NEW DAY. A LITTLE MORE POSSIBILITY.'
                  : 'YOUR PERSONAL GROWTH OS'}
              </div>
              <h1>
                {page === 'Home'
                  ? `${Number(new Intl.DateTimeFormat('en', { hour: 'numeric', hourCycle: 'h23', timeZone: w.preferences.timezone }).format(new Date(tick))) < 12 ? 'Good morning' : Number(new Intl.DateTimeFormat('en', { hour: 'numeric', hourCycle: 'h23', timeZone: w.preferences.timezone }).format(new Date(tick))) < 17 ? 'Good afternoon' : 'Good evening'}${w.preferences.name ? ', ' + w.preferences.name.split(' ')[0] : ''}.`
                  : page === 'Tasks'
                    ? 'Make space for what matters.'
                    : page === 'Journal'
                      ? 'A moment to look inward.'
                      : page === 'Insights'
                        ? 'See the bigger picture.'
                        : page === 'Goals'
                          ? 'Give your growth a direction.'
                          : page === 'Focus Room'
                            ? 'One thing. Your full attention.'
                            : page === 'Planner'
                              ? 'A little planning. More intention.'
                              : page === 'Settings'
                                ? 'Make this space yours.'
                                : page === 'Growth Studio'
                                  ? 'A life built with intention.'
                                  : 'You don’t have to figure it out alone.'}
              </h1>
              <p>
                {page === 'Home'
                  ? 'Small steps today. Meaningful growth over time.'
                  : page === 'Tasks'
                    ? 'Your commitments, one intentional step at a time.'
                    : page === 'Insights'
                      ? 'Honest reflections from the progress you actually record.'
                      : page === 'Journal'
                        ? 'Leave a little room for reflection, learning, and becoming.'
                        : page === 'Goals'
                          ? 'Turn the things you care about into practical next steps.'
                          : page === 'Planner'
                            ? 'A clear view of the days ahead.'
                            : page === 'Focus Room'
                              ? 'Settle in, remove a distraction, and make a beginning.'
                              : page === 'Settings'
                                ? 'Your preferences, privacy, and peace of mind.'
                                : page === 'Growth Studio'
                                  ? 'Study deeply. Build steadily. Stay grounded.'
                                  : 'A practical conversation, grounded in your real commitments.'}
              </p>
            </div>
            {['Home', 'Tasks', 'Planner'].includes(page) ? (
              <button
                className="button primary"
                onClick={() => setModal({ type: 'task' })}
              >
                <Plus size={17} />
                Add task
              </button>
            ) : page === 'Journal' ? (
              <button
                className="button primary"
                onClick={() => setModal({ type: 'journal' })}
              >
                <Plus size={17} />
                New reflection
              </button>
            ) : page === 'Goals' ? (
              <button
                className="button primary"
                onClick={() => setModal({ type: 'goal' })}
              >
                <Plus size={17} />
                New goal
              </button>
            ) : null}
          </div>
          {page === 'Growth Studio' && (
            <GrowthStudio
              workspace={w}
              scope={scope.current}
              today={today}
              disabled={!loaded || saving || authPending}
              save={save}
              editing={(open) => {
                learningEditing.current = open
              }}
            />
          )}
          {page === 'Home' && (
            <>
              <DailyBrief
                workspace={w}
                today={today}
                openTasks={() => navigate('Tasks')}
                openStudio={() => navigate('Growth Studio')}
              />
              <section className="welcome-card">
                <div className="welcome-copy">
                  <span className="eyebrow">
                    <span className="tiny-line" />
                    YOUR GROWTH BEGINS WITH TODAY
                  </span>
                  <h2>
                    Become a little more
                    <br />
                    <em>of who you want to be.</em>
                  </h2>
                  <p>
                    You don’t need to do it all. Just take the next right step.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => navigate('Tasks')}
                  >
                    Let’s make today count
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="sunrise-art" aria-hidden="true">
                  <svg viewBox="0 0 400 280" fill="none">
                    <defs>
                      <linearGradient
                        id="daystar-dawn"
                        x1="230"
                        y1="60"
                        x2="230"
                        y2="224"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#dbc69e" stopOpacity=".7" />
                        <stop
                          offset="1"
                          stopColor="#b08d57"
                          stopOpacity=".08"
                        />
                      </linearGradient>
                      <clipPath id="daystar-horizon">
                        <path d="M0 0H400V200H0Z" />
                      </clipPath>
                    </defs>
                    <g clipPath="url(#daystar-horizon)">
                      <circle
                        cx="230"
                        cy="196"
                        r="134"
                        stroke="currentColor"
                        strokeOpacity=".18"
                      />
                      <circle
                        cx="230"
                        cy="196"
                        r="109"
                        stroke="currentColor"
                        strokeOpacity=".3"
                      />
                      <circle
                        cx="230"
                        cy="196"
                        r="84"
                        stroke="currentColor"
                        strokeOpacity=".5"
                      />
                      <circle
                        cx="230"
                        cy="196"
                        r="60"
                        fill="url(#daystar-dawn)"
                        stroke="currentColor"
                        strokeOpacity=".65"
                      />
                    </g>
                    <path
                      d="M50 200H390M88 213H368M123 226H340M159 239H306M195 252H269"
                      stroke="currentColor"
                      strokeOpacity=".4"
                    />
                    <path
                      d="M230 32V43M112 78L120 86M348 78L340 86M65 148L76 151M384 148L373 151"
                      stroke="currentColor"
                      strokeOpacity=".55"
                    />
                    <path
                      d="M230 14V23M225.5 18.5H234.5"
                      stroke="currentColor"
                    />
                    <circle cx="112" cy="200" r="2" fill="currentColor" />
                    <circle cx="348" cy="200" r="2" fill="currentColor" />
                  </svg>
                  <span>ROOTED IN PURPOSE. GROWING DAILY.</span>
                </div>
              </section>
              <div className="section-date">
                <div>
                  <CalendarDays size={16} />
                  <strong>
                    {nice(date, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </strong>
                  {date === today && <span className="today-label">Today</span>}
                </div>
                <div className="date-controls">
                  <button
                    className="icon-btn"
                    aria-label="Previous day"
                    onClick={() => setDate(addDay(date, -1))}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button onClick={() => setDate(today)}>Today</button>
                  <button
                    className="icon-btn"
                    aria-label="Next day"
                    onClick={() => setDate(addDay(date, 1))}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
              <div className="stats-grid">
                <section className="stat-card completion-card">
                  <div className="stat-top">
                    Daily completion
                    <CheckSquare size={17} />
                  </div>
                  <div className="metric">
                    <strong>{pc(stats.completion)}</strong>
                    <span>
                      {stats.total
                        ? `${stats.done} of ${stats.total} tasks completed`
                        : 'No tasks scheduled yet'}
                    </span>
                  </div>
                  <Progress value={stats.completion} />
                  <small>Your scheduled commitments</small>
                </section>
                <section className="stat-card">
                  <div className="stat-top">
                    Target progress
                    <Target size={17} />
                  </div>
                  <div className="metric">
                    <strong>{pc(stats.target)}</strong>
                    <span>
                      {stats.target === null
                        ? 'Make your first measurable step'
                        : 'Of measurable targets reached'}
                    </span>
                  </div>
                  <Progress value={stats.target} color="#ac915c" />
                  <small>Every target gets equal weight</small>
                </section>
                <section className="stat-card">
                  <div className="stat-top">
                    In progress
                    <Circle size={17} />
                  </div>
                  <div className="metric">
                    <strong>
                      {stats.inProgress}
                      <span className="metric-unit">tasks</span>
                    </strong>
                    <span>
                      {stats.inProgress
                        ? 'Keep your momentum going'
                        : 'A fresh place to begin'}
                    </span>
                  </div>
                  <div className="stat-foot">
                    <span
                      className="area-dot"
                      style={{ background: '#ac915c' }}
                    />
                    Small steps count
                  </div>
                </section>
                <section className="stat-card">
                  <div className="stat-top">
                    Still to do
                    <Flag size={17} />
                  </div>
                  <div className="metric">
                    <strong>
                      {stats.remaining}
                      <span className="metric-unit">tasks</span>
                    </strong>
                    <span>
                      {stats.total
                        ? 'One step at a time'
                        : 'Your day is yours to shape'}
                    </span>
                  </div>
                  <div className="stat-foot">
                    {overdue.length} overdue <span>·</span> {stats.done}{' '}
                    completed
                  </div>
                </section>
              </div>
              <div className="dashboard-grid">
                <div className="dashboard-left">
                  <section className="panel commitments-panel">
                    <div className="panel-header">
                      <div>
                        <h2>
                          Today’s commitments{' '}
                          <span className="count-pill">{stats.total}</span>
                        </h2>
                        <p>A little structure. A lot of possibility.</p>
                      </div>
                      <button
                        className="text-link"
                        onClick={() => navigate('Tasks')}
                      >
                        View all
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {taskRows(list)}
                    <button
                      className="add-inline"
                      onClick={() => setModal({ type: 'task' })}
                    >
                      <Plus size={16} />
                      Add a commitment<span>Make room for what matters</span>
                    </button>
                  </section>
                  <section className="panel life-panel">
                    <div className="panel-header">
                      <div>
                        <h2>A balanced life, in progress</h2>
                        <p>Different parts of you. Room for each to grow.</p>
                      </div>
                      <button
                        className="icon-btn"
                        aria-label="Manage life areas"
                        onClick={() => navigate('Settings')}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </div>
                    <div className="life-areas">
                      {w.areas.map((a, i) => {
                        const m = metrics(
                            list.filter((o) => o.snapshot.area === a.id),
                          ),
                          Icon = areaIcons[i % areaIcons.length]
                        return (
                          <button
                            key={a.id}
                            onClick={() => {
                              setArea(a.id)
                              navigate('Tasks')
                            }}
                            className="area-row"
                          >
                            <span
                              className="area-icon"
                              style={{
                                color: a.color,
                                background: a.color + '16',
                              }}
                            >
                              <Icon size={18} strokeWidth={1.5} />
                            </span>
                            <div>
                              <strong>{a.name}</strong>
                              <Progress
                                value={m.target ?? m.completion}
                                color={a.color}
                              />
                            </div>
                            <span>
                              {m.total
                                ? pc(m.target ?? m.completion)
                                : 'No tasks yet'}
                              <ChevronRight size={13} />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                </div>
                <div className="dashboard-right">
                  <section className="panel week-panel">
                    <div className="panel-header">
                      <div>
                        <h2>Your week at a glance</h2>
                        <p>
                          {nice(week[0], { month: 'short', day: 'numeric' })} —{' '}
                          {nice(date, { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <ChartNoAxesCombined size={19} strokeWidth={1.3} />
                    </div>
                    {weekChart(week)}
                    <div className="chart-footer">
                      <span className="area-dot" />
                      Task completion
                      <span>
                        {week.some((d) => metrics(occurrencesFor(w, d)).total)
                          ? 'Based on your records'
                          : 'Your story starts here'}
                      </span>
                    </div>
                  </section>
                  <section className="coach-card">
                    <div className="coach-heading">
                      <span className="coach-icon">
                        <Sparkles size={21} strokeWidth={1.3} />
                      </span>
                      <span>YOUR ACCOUNTABILITY COACH</span>
                      <ArrowUpRight size={17} />
                    </div>
                    <h2>
                      A little clarity.
                      <br />A gentle nudge forward.
                    </h2>
                    <p>
                      {stats.total
                        ? `You have ${stats.remaining} commitments left. Let’s find a realistic next step together.`
                        : 'Not sure where to begin? Let’s turn your intentions into a manageable plan.'}
                    </p>
                    <button onClick={() => navigate('Accountability Coach')}>
                      Let’s talk
                      <ArrowRight size={16} />
                    </button>
                    <div className="coach-note">
                      Grounded in your progress. Guided by you.
                    </div>
                  </section>
                  <section className="reflection-card">
                    <div>
                      <BookOpen size={20} strokeWidth={1.3} />
                      <span>A MOMENT FOR YOU</span>
                    </div>
                    <h3>
                      What’s one thing you’re
                      <br />
                      grateful for today?
                    </h3>
                    <button
                      className="text-link"
                      onClick={() => setModal({ type: 'journal' })}
                    >
                      Write a reflection
                      <ArrowRight size={15} />
                    </button>
                  </section>
                </div>
              </div>
              <div className="quick-links">
                <span>A LITTLE SPACE TO…</span>
                <button onClick={() => navigate('Focus Room')}>
                  <Timer size={17} />
                  Find your focus
                  <ArrowUpRight size={14} />
                </button>
                <button onClick={() => navigate('Goals')}>
                  <Flag size={17} />
                  Revisit your goals
                  <ArrowUpRight size={14} />
                </button>
                <button onClick={() => navigate('Planner')}>
                  <CalendarDays size={17} />
                  Plan what’s next
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          )}
          {page === 'Tasks' && (
            <>
              <div className="toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="Search tasks"
                    placeholder="Find a commitment…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filter life area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  <option value="all">All life areas</option>
                  {w.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Selected task date"
                  type="date"
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                />
              </div>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      {nice(date, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h2>
                    <p>
                      {stats.done} completed · {stats.remaining} remaining ·{' '}
                      {pc(stats.target)} target progress
                    </p>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => navigate('Insights')}
                  >
                    View trends
                    <ArrowUpRight size={15} />
                  </button>
                </div>
                {taskRows(visibleList)}
              </section>
              {overdue.length > 0 && (
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Unfinished from earlier days</h2>
                      <p>
                        {overdue.length} past commitments still need attention.
                        Review the original date to record or skip them.
                      </p>
                    </div>
                  </div>
                  {overdue
                    .filter((o) => area === 'all' || o.snapshot.area === area)
                    .slice(-15)
                    .reverse()
                    .map((o) => (
                      <button
                        className="overdue-link"
                        key={o.id}
                        onClick={() => setDate(o.date)}
                      >
                        <span>
                          <strong>{o.snapshot.title}</strong>
                          <small>
                            {nice(o.date)} · {amount(o)} / {o.snapshot.target}{' '}
                            {o.snapshot.unit}
                          </small>
                        </span>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                </section>
              )}
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>All commitments & schedules</h2>
                    <p>
                      Pause or edit future schedules. Historical records stay
                      intact.
                    </p>
                  </div>
                </div>
                {w.tasks
                  .filter(
                    (t) =>
                      !t.archivedFrom &&
                      (area === 'all' || t.area === area) &&
                      t.title.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((t) => (
                    <div className="record-row" key={t.id}>
                      <div>
                        <strong>{t.title}</strong>
                        <p>
                          {t.recurrence} ·{' '}
                          {t.target > 0
                            ? `${t.target} ${t.unit}`
                            : 'Simple task'}{' '}
                          · starts {nice(t.date)}
                          {t.pausedFrom ? ' · Paused' : ''}
                        </p>
                      </div>
                      <div className="row-actions">
                        <button
                          className="icon-btn"
                          aria-label={`Edit ${t.title}`}
                          onClick={() => setModal({ type: 'task', id: t.id })}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={`${t.pausedFrom ? 'Resume' : 'Pause'} ${t.title}`}
                          onClick={async () => {
                            const next = preserveHistory(w, today)
                            await save({
                              ...next,
                              tasks: next.tasks.map((x) =>
                                x.id === t.id
                                  ? {
                                      ...x,
                                      pausedFrom: x.pausedFrom
                                        ? undefined
                                        : today,
                                      effectiveFrom: today,
                                      updatedAt: new Date().toISOString(),
                                    }
                                  : x,
                              ),
                            })
                          }}
                        >
                          {t.pausedFrom ? (
                            <Play size={16} />
                          ) : (
                            <Pause size={16} />
                          )}
                        </button>
                        <button
                          className="icon-btn danger"
                          aria-label={`Archive ${t.title}`}
                          onClick={() => archive(t)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                {!w.tasks.length && (
                  <p className="muted helper">
                    Your task schedules appear here after you add a commitment.
                  </p>
                )}
              </section>
            </>
          )}
          {page === 'Tasks' && w.tasks.some((t) => t.archivedFrom) && (
            <section className="panel">
              <details>
                <summary>
                  Archived commitments ·{' '}
                  {w.tasks.filter((t) => t.archivedFrom).length}
                </summary>
                <p className="helper">
                  Restoring resumes a schedule from today. Past archive gaps and
                  logged progress stay intact. Expired end dates are cleared;
                  one-time tasks are rescheduled for today.
                </p>
                {w.tasks
                  .filter(
                    (t) =>
                      t.archivedFrom &&
                      (area === 'all' || t.area === area) &&
                      t.title.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((task) => (
                    <div className="record-row" key={task.id}>
                      <strong>{task.title}</strong>
                      <button
                        className="button secondary"
                        disabled={!loaded || saving}
                        onClick={async () => {
                          if (confirm(`Restore “${task.title}” from today?`))
                            await save(restoreTask(w, task.id, today))
                        }}
                      >
                        Restore commitment
                      </button>
                    </div>
                  ))}
              </details>
            </section>
          )}
          {page === 'Insights' && (
            <>
              <div className="toolbar">
                <select
                  aria-label="Insight life area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  <option value="all">All life areas</option>
                  {w.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <div className="segmented">
                  {[1, 7, 30].map((n) => (
                    <button
                      className={range === n ? 'selected' : ''}
                      key={n}
                      onClick={() => setRange(n)}
                    >
                      {n === 1 ? 'Daily' : n === 7 ? 'Weekly' : 'Monthly'}
                    </button>
                  ))}
                </div>
                <input
                  aria-label="Insight range end date"
                  type="date"
                  max={today}
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                />
                <span className="muted">
                  {nice(addDay(date, 1 - range))} – {nice(date)}
                </span>
              </div>
              {(() => {
                const days = Array.from({ length: range }, (_, i) =>
                  addDay(date, i - range + 1),
                )
                const all = days
                  .flatMap((d) => occurrencesFor(w, d))
                  .filter((o) => area === 'all' || o.snapshot.area === area)
                const m = metrics(all, today)
                return (
                  <>
                    <div className="stats-grid insight-stats">
                      {[
                        [
                          'Task completion',
                          pc(m.completion),
                          `${m.done} of ${m.total} scheduled tasks`,
                        ],
                        [
                          'Target progress',
                          pc(m.target),
                          'Equal average of measurable targets',
                        ],
                        [
                          'Missed commitments',
                          String(
                            all.filter(
                              (o) =>
                                o.date < today &&
                                o.status !== 'skipped' &&
                                !isComplete(o),
                            ).length,
                          ),
                          'Past, unfinished occurrences',
                        ],
                        [
                          'Consistency',
                          `${
                            days.filter((d) => {
                              const x = metrics(
                                occurrencesFor(w, d).filter(
                                  (o) =>
                                    area === 'all' || o.snapshot.area === area,
                                ),
                              )
                              return x.total > 0 && x.done === x.total
                            }).length
                          } / ${range}`,
                          'Days with every task complete',
                        ],
                      ].map(([label, value, sub]) => (
                        <section key={label} className="stat-card">
                          <div className="stat-top">{label}</div>
                          <div className="metric">
                            <strong>{value}</strong>
                            <span>{sub}</span>
                          </div>
                        </section>
                      ))}
                    </div>
                    <section className="panel">
                      <div className="panel-header">
                        <div>
                          <h2>Progress over time</h2>
                          {(() => {
                            const previous = Array.from(
                              { length: range },
                              (_, i) => addDay(date, i - 2 * range + 1),
                            )
                              .flatMap((d) => occurrencesFor(w, d))
                              .filter(
                                (o) =>
                                  area === 'all' || o.snapshot.area === area,
                              )
                            const pm = metrics(previous, today)
                            return (
                              <p>
                                {pm.total
                                  ? `Previous period: ${pc(pm.completion)} task completion · ${pc(pm.target)} target progress`
                                  : 'No records in the previous period to compare yet.'}
                              </p>
                            )
                          })()}
                          <p>
                            Task completion and target progress are different
                            measures.
                          </p>
                        </div>
                      </div>
                      {m.total ? (
                        <div className="trend-list">
                          {days.map((d) => {
                            const dm = metrics(
                              occurrencesFor(w, d).filter(
                                (o) =>
                                  area === 'all' || o.snapshot.area === area,
                              ),
                            )
                            return (
                              <div className="trend-row" key={d}>
                                <span>
                                  {nice(d, { month: 'short', day: 'numeric' })}
                                </span>
                                <div>
                                  <Progress
                                    value={dm.completion}
                                    color="#20364b"
                                  />
                                  <Progress value={dm.target} color="#ad925d" />
                                </div>
                                <span>
                                  {pc(dm.completion)} / {pc(dm.target)}
                                </span>
                              </div>
                            )
                          })}
                          <p className="helper">
                            Navy: task completion · Gold: target progress · —:
                            no eligible records
                          </p>
                        </div>
                      ) : (
                        <Empty
                          icon={ChartNoAxesCombined}
                          title="Every step leaves a story."
                          body="As you record your commitments, your patterns and progress appear here."
                        />
                      )}
                    </section>
                    <section className="panel">
                      <h2>Across your life areas</h2>
                      {w.areas.map((a) => {
                        const am = metrics(
                          all.filter((o) => o.snapshot.area === a.id),
                          today,
                        )
                        return (
                          <div className="record-row" key={a.id}>
                            <strong>{a.name}</strong>
                            <span>
                              {am.total
                                ? `${am.done}/${am.total} tasks · ${pc(am.target)} target progress`
                                : 'No records in this period'}
                            </span>
                          </div>
                        )
                      })}
                    </section>
                    <section className="panel metric-explainer">
                      <h2>A clear view, without a single growth score.</h2>
                      <p>
                        Task completion is completed scheduled occurrences
                        divided by all eligible scheduled occurrences. Target
                        progress is the unweighted average of each measurable
                        occurrence’s progress, capped at 100%. Units are never
                        added together. Skipped commitments are excluded,
                        zero-target tasks require manual completion, and empty
                        days have no percentage. Future days are excluded from
                        period totals.
                      </p>
                    </section>
                  </>
                )
              })()}
            </>
          )}
          {page === 'Insights' && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Learning practice</h2>
                  <p>
                    Recall reviews measure practice, not mastery or spiritual
                    maturity. This summary follows the selected period;
                    life-area filters above apply to commitments.
                  </p>
                </div>
                <button
                  className="text-link"
                  onClick={() => navigate('Planner')}
                >
                  Open review library <ArrowUpRight size={15} />
                </button>
              </div>
              {(['study', 'scripture'] as const).map((kind) => {
                const records = w.learning.filter((item) => item.kind === kind)
                const reviews = records
                  .flatMap((item) => item.reviews)
                  .filter((review) => {
                    const d = dateKey(
                      w.preferences.timezone,
                      new Date(review.at),
                    )
                    return (
                      d >= addDay(date, 1 - range) && d <= date && d <= today
                    )
                  })
                return (
                  <div className="record-row" key={kind}>
                    <strong>
                      {kind === 'study'
                        ? 'Academic recall'
                        : 'Scripture recall'}
                    </strong>
                    <span>
                      {reviews.length} reviews ·{' '}
                      {
                        reviews.filter((review) => review.rating !== 'good')
                          .length
                      }{' '}
                      rated again or hard
                    </span>
                  </div>
                )
              })}
            </section>
          )}
          {page === 'Journal' && (
            <>
              <div className="toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    placeholder="Search your reflections…"
                    aria-label="Search journal"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <section className="panel">
                {w.journals.length ? (
                  w.journals
                    .filter((j) =>
                      (j.title + ' ' + j.body)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((j) => (
                      <article className="journal-entry" key={j.id}>
                        <span className="eyebrow">
                          {nice(j.date, {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <h2>{j.title}</h2>
                        <p className="journal-body">{j.body}</p>
                        <div className="row-actions">
                          <button
                            className="text-link"
                            onClick={() =>
                              setModal({ type: 'journal', id: j.id })
                            }
                          >
                            <Pencil size={14} />
                            Edit reflection
                          </button>
                          <button
                            className="icon-btn danger"
                            aria-label={`Delete reflection ${j.title}`}
                            onClick={async () => {
                              if (
                                confirm(
                                  'Delete this individual journal entry? Export a backup first if you want to keep a copy.',
                                )
                              )
                                await save({
                                  ...w,
                                  journals: w.journals.filter(
                                    (x) => x.id !== j.id,
                                  ),
                                })
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </article>
                    ))
                ) : (
                  <Empty
                    icon={BookOpen}
                    title="There’s room for your story here."
                    body="What went well? What felt difficult? What is your next practical step? Take a moment to write it down."
                    action={() => setModal({ type: 'journal' })}
                    label="Write your first reflection"
                  />
                )}
              </section>
              {w.journals.length > 0 &&
                !w.journals.some((j) =>
                  (j.title + ' ' + j.body)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                ) && (
                  <p className="helper">
                    No reflections match your search. Try another word.
                  </p>
                )}
              <p className="privacy-line">
                <Leaf size={14} />
                Your reflections are private. Journal text is never sent to the
                accountability coach.
              </p>
            </>
          )}
          {page === 'Goals' && (
            <div className="goals-grid">
              {w.goals.length ? (
                w.goals.map((g) => {
                  const done = g.milestones.filter((m) => m.done).length
                  return (
                    <section className="panel goal-card" key={g.id}>
                      <div className="panel-header">
                        <span className="area-tag">
                          {w.areas.find((a) => a.id === g.area)?.name}
                        </span>
                        <button
                          className="icon-btn"
                          aria-label={`Edit ${g.title}`}
                          onClick={() => setModal({ type: 'goal', id: g.id })}
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                      <h2>{g.title}</h2>
                      <p>{g.description}</p>
                      <div className="goal-progress">
                        <span>
                          {done} of {g.milestones.length} milestones
                        </span>
                        <b>
                          {g.milestones.length
                            ? pc((done / g.milestones.length) * 100)
                            : 'Not started'}
                        </b>
                      </div>
                      <Progress
                        value={
                          g.milestones.length
                            ? (done / g.milestones.length) * 100
                            : 0
                        }
                      />
                      {g.milestones.map((m) => (
                        <label className="milestone" key={m.id}>
                          <input
                            type="checkbox"
                            checked={m.done}
                            onChange={async () => {
                              await save({
                                ...w,
                                goals: w.goals.map((x) =>
                                  x.id === g.id
                                    ? {
                                        ...x,
                                        milestones: x.milestones.map((y) =>
                                          y.id === m.id
                                            ? { ...y, done: !y.done }
                                            : y,
                                        ),
                                        reviews: [
                                          ...x.reviews.slice(-99),
                                          {
                                            at: new Date().toISOString(),
                                            note: `${m.done ? 'Reopened' : 'Completed'}: ${m.title}`,
                                          },
                                        ],
                                      }
                                    : x,
                                ),
                              })
                            }}
                          />
                          {m.title}
                        </label>
                      ))}
                      <div className="goal-date">
                        <CalendarDays size={14} />
                        Target: {nice(g.date)}
                        <span>
                          {g.milestones.length && done === g.milestones.length
                            ? 'Completed'
                            : g.date < today
                              ? 'Needs review'
                              : 'In progress'}
                        </span>
                      </div>
                      {g.taskIds.length > 0 && (
                        <p className="helper">
                          Linked:{' '}
                          {g.taskIds
                            .map(
                              (id) =>
                                w.tasks.find((t) => t.id === id)?.title ??
                                'Archived task',
                            )
                            .join(', ')}
                        </p>
                      )}
                      {g.notes && <p className="helper">{g.notes}</p>}
                      <details>
                        <summary>Review history ({g.reviews.length})</summary>
                        {g.reviews.map((r, i) => (
                          <p className="helper" key={i}>
                            {new Date(r.at).toLocaleDateString()} · {r.note}
                          </p>
                        ))}
                      </details>
                    </section>
                  )
                })
              ) : (
                <section className="panel wide">
                  <Empty
                    icon={Flag}
                    title="What are you working toward?"
                    body="Give a long-term intention a name. Then break it into milestones you can act on."
                    action={() => setModal({ type: 'goal' })}
                    label="Create your first goal"
                  />
                </section>
              )}
            </div>
          )}
          {page === 'Planner' && (
            <>
              <div className="toolbar">
                <input
                  aria-label="Planner start date"
                  type="date"
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                />
                <button
                  className="button secondary"
                  onClick={() => setDate(today)}
                >
                  Back to today
                </button>
              </div>
              <div className="planner-grid">
                {Array.from({ length: 7 }, (_, i) => addDay(date, i)).map(
                  (d) => {
                    const items = occurrencesFor(w, d)
                    return (
                      <section
                        className={`panel planner-day ${d === today ? 'is-today' : ''}`}
                        key={d}
                      >
                        <div className="planner-date">
                          <span>{nice(d, { weekday: 'long' })}</span>
                          <strong>
                            {nice(d, { month: 'short', day: 'numeric' })}
                          </strong>
                          {d === today && (
                            <span className="today-label">Today</span>
                          )}
                        </div>
                        {items.length ? (
                          items.map((o) => (
                            <button
                              className="planner-task"
                              key={o.id}
                              onClick={() => {
                                setDate(d)
                                navigate('Tasks')
                              }}
                            >
                              <span
                                className="area-dot"
                                style={{
                                  background: w.areas.find(
                                    (a) => a.id === o.snapshot.area,
                                  )?.color,
                                }}
                              />
                              <strong>{o.snapshot.title}</strong>
                              <small>
                                {isComplete(o)
                                  ? 'Completed'
                                  : o.status === 'skipped'
                                    ? 'Skipped'
                                    : `${o.snapshot.target} ${o.snapshot.unit}`}
                              </small>
                            </button>
                          ))
                        ) : (
                          <p className="muted helper">
                            Space for something meaningful.
                          </p>
                        )}
                        <button
                          className="text-link"
                          onClick={() => {
                            setDate(d)
                            setModal({ type: 'task' })
                          }}
                        >
                          <Plus size={14} />
                          Add task
                        </button>
                      </section>
                    )
                  },
                )}
              </div>
            </>
          )}
          {page === 'Planner' && (
            <Learning
              workspace={w}
              today={today}
              disabled={!loaded || saving}
              save={save}
              editing={(open) => {
                learningEditing.current = open
              }}
            />
          )}
          {page === 'Focus Room' && (
            <>
              <section className="focus-panel">
                <span className="eyebrow">
                  {activeFocus
                    ? activeFocus.kind === 'break'
                      ? 'TAKE A BREATH'
                      : 'A LITTLE DEEP WORK'
                    : 'A QUIETER SPACE FOR YOUR MIND'}
                </span>
                <div
                  className={`focus-clock ${activeFocus?.status === 'running' ? 'running' : ''}`}
                >
                  <div>
                    <span>
                      {String(Math.floor(left / 60)).padStart(2, '0')}
                      <i>:</i>
                      {String(left % 60).padStart(2, '0')}
                    </span>
                    <small>
                      {activeFocus
                        ? activeFocus.status === 'running'
                          ? 'Stay with this moment'
                          : 'Paused · take your time'
                        : 'Ready when you are'}
                    </small>
                  </div>
                </div>
                <label className="focus-task-label">
                  A commitment to focus on
                  <select
                    id="focus-task"
                    key={activeFocus?.id ?? 'new'}
                    disabled={!!activeFocus}
                    defaultValue={activeFocus?.taskId ?? ''}
                  >
                    <option value="">An unlinked focus session</option>
                    {occurrencesFor(w, today)
                      .filter((o) => !isComplete(o) && o.status !== 'skipped')
                      .map((o) => (
                        <option value={o.taskId} key={o.id}>
                          {o.snapshot.title}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="focus-controls">
                  {!activeFocus ? (
                    <>
                      <button
                        className="button primary"
                        disabled={!loaded || saving}
                        onClick={() => focusAction('start')}
                      >
                        <Play size={17} />
                        Begin focus
                      </button>
                      <button
                        className="button secondary"
                        disabled={!loaded || saving}
                        onClick={() => focusAction('break')}
                      >
                        Take a break
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="button primary"
                        disabled={saving}
                        onClick={() =>
                          focusAction(
                            activeFocus.status === 'running'
                              ? 'pause'
                              : 'resume',
                          )
                        }
                      >
                        {activeFocus.status === 'running' ? (
                          <Pause size={17} />
                        ) : (
                          <Play size={17} />
                        )}{' '}
                        {activeFocus.status === 'running' ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        className="button secondary"
                        disabled={saving}
                        onClick={() => focusAction('finish')}
                      >
                        <Square size={15} />
                        Finish session
                      </button>
                      <button
                        className="text-link"
                        disabled={saving}
                        onClick={() => {
                          if (
                            confirm(
                              'Reset this timer? Elapsed time stays in history as an interrupted session.',
                            )
                          )
                            void focusAction('reset')
                        }}
                      >
                        Reset timer
                      </button>
                    </>
                  )}
                </div>
                <p className="helper">
                  {w.preferences.focusMinutes} minutes of focus ·{' '}
                  {w.preferences.breakMinutes} minute break
                  <br />
                  Time is recalculated after refresh. Finishing early records an
                  interrupted session.
                </p>
              </section>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Your focus history</h2>
                    <p>
                      Actual time, honestly recorded. Focus time does not
                      automatically complete a task.
                    </p>
                  </div>
                </div>
                {w.focus
                  .filter((s) =>
                    ['completed', 'interrupted'].includes(s.status),
                  )
                  .reverse()
                  .map((s) => (
                    <div className="record-row" key={s.id}>
                      <div>
                        <strong>
                          {s.kind === 'break'
                            ? 'Break'
                            : w.tasks.find((t) => t.id === s.taskId)?.title ||
                              'Focused work'}
                        </strong>
                        <p>{new Date(s.startedAt).toLocaleString()}</p>
                      </div>
                      <span>
                        {Math.floor(s.actual / 60)}m {Math.round(s.actual % 60)}
                        s · {s.status}
                      </span>
                    </div>
                  ))}
                {!w.focus.some((s) =>
                  ['completed', 'interrupted'].includes(s.status),
                ) && (
                  <Empty
                    icon={Timer}
                    title="Make a little room for focus."
                    body="Your completed and interrupted sessions appear here, with the time you actually spent."
                  />
                )}
              </section>
            </>
          )}
          {page === 'Accountability Coach' && (
            <section className="panel chat-panel">
              <div className="coach-intro">
                <span className="coach-icon">
                  <Sparkles size={25} />
                </span>
                <h2>Start where you are.</h2>
                <p>
                  Review your commitments, find your next step, or make a
                  gentler plan.
                  <br />
                  AI uses today’s tasks and weekly totals, never your journal. A
                  clearly labelled record-based fallback is available.
                </p>
              </div>
              <div className="chat-suggestions">
                {[
                  'Review my day',
                  'Help me plan my next step',
                  'Break my next task down',
                  'Review my weekly consistency',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => askCoach(s)}
                    disabled={thinking}
                  >
                    {s}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
              <div className="chat-messages" aria-live="polite">
                {chat.map((m, i) => (
                  <div
                    className={`chat-message ${m.role === 'you' ? 'from-you' : ''}`}
                    key={i}
                  >
                    <span>{m.role === 'you' ? 'You' : m.role}</span>
                    <p>{m.text}</p>
                  </div>
                ))}
                {thinking && (
                  <p className="muted">Reviewing your saved commitments…</p>
                )}
              </div>
              <form
                className="chat-input"
                onSubmit={(e) => {
                  e.preventDefault()
                  const form = e.currentTarget
                  const input = new FormData(form).get('message')
                  if (input) {
                    void askCoach(String(input))
                    form.reset()
                  }
                }}
              >
                <input
                  name="message"
                  aria-label="Message to accountability coach"
                  required
                  maxLength={2000}
                  placeholder="What would help you move forward today?"
                />
                <button
                  className="button primary"
                  disabled={thinking || !loaded}
                  aria-label="Send message"
                >
                  <ArrowRight size={19} />
                </button>
              </form>
              <p className="helper">
                Each request uses current saved records. Each response is
                independent; messages stay on this screen only. AI can make
                mistakes.
              </p>
            </section>
          )}
          {page === 'Settings' && (
            <div className="settings-grid">
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Your personal space</h2>
                    <p>
                      {user?.email ||
                        'Private browser workspace · not linked across devices'}
                    </p>
                  </div>
                  <Cloud size={20} />
                </div>
                {user ? (
                  <button
                    className="button secondary"
                    onClick={async () => {
                      await logout()
                      setUser(null)
                      await load()
                      toast('Signed out. Your account records stay private.')
                    }}
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                ) : (
                  <>
                    <p className="helper">
                      Records are saved in the private cloud workspace under a
                      secure browser cookie. Sign in for an account workspace
                      that syncs across devices. After signing in, you can
                      explicitly add this browser’s records to your account;
                      export first if you also want a separate backup file.
                    </p>
                    <button
                      className="button primary"
                      onClick={() => {
                        setAuthMode('login')
                        setModal({ type: 'auth' })
                      }}
                    >
                      Sign in or create account
                      <ArrowRight size={16} />
                    </button>
                  </>
                )}
                <form
                  className="settings-form"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const f = new FormData(e.currentTarget)
                    const next = {
                      ...w,
                      preferences: {
                        ...w.preferences,
                        name: String(f.get('name')),
                        timezone: String(f.get('timezone')),
                        focusMinutes: Number(f.get('focusMinutes')),
                        breakMinutes: Number(f.get('breakMinutes')),
                        reminders: f.get('reminders') === 'on',
                        reminderTime: String(f.get('reminderTime')),
                        quietStart: String(f.get('quietStart')),
                        quietEnd: String(f.get('quietEnd')),
                      },
                    }
                    try {
                      if (await save(workspaceSchema.parse(next)))
                        toast.success('Preferences saved.')
                    } catch {
                      toast.error('Check your time zone and duration values.')
                    }
                  }}
                >
                  <Field label="Your name">
                    <input
                      name="name"
                      maxLength={100}
                      defaultValue={w.preferences.name}
                      placeholder="How would you like to be greeted?"
                    />
                  </Field>
                  <Field label="Time zone">
                    <select
                      name="timezone"
                      defaultValue={w.preferences.timezone}
                    >
                      {Array.from(
                        new Set([
                          w.preferences.timezone,
                          Intl.DateTimeFormat().resolvedOptions().timeZone,
                          'UTC',
                          'Africa/Lagos',
                          'Europe/London',
                          'America/New_York',
                          'America/Los_Angeles',
                          'Asia/Kolkata',
                          'Australia/Sydney',
                        ]),
                      ).map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <div className="form-grid">
                    <Field label="Focus duration (minutes)">
                      <input
                        name="focusMinutes"
                        type="number"
                        min="1"
                        max="180"
                        defaultValue={w.preferences.focusMinutes}
                        required
                      />
                    </Field>
                    <Field label="Break duration (minutes)">
                      <input
                        name="breakMinutes"
                        type="number"
                        min="1"
                        max="60"
                        defaultValue={w.preferences.breakMinutes}
                        required
                      />
                    </Field>
                  </div>
                  <h3>Gentle reminders</h3>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      name="reminders"
                      defaultChecked={w.preferences.reminders}
                    />
                    Enable a daily check-in while DAYSTAR is open
                  </label>
                  <Field label="Daily check-in time">
                    <input
                      name="reminderTime"
                      type="time"
                      defaultValue={w.preferences.reminderTime}
                      required
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Quiet hours start">
                      <input
                        type="time"
                        name="quietStart"
                        defaultValue={w.preferences.quietStart}
                        required
                      />
                    </Field>
                    <Field label="Quiet hours end">
                      <input
                        type="time"
                        name="quietEnd"
                        defaultValue={w.preferences.quietEnd}
                        required
                      />
                    </Field>
                  </div>
                  <p className="helper">
                    Browser notifications: {permission}. Notifications require
                    permission. Open-page reminders work while DAYSTAR is open.
                    Connect background push in Growth Studio → Reminders when
                    available. Email reminders are not configured.
                  </p>
                  <button
                    type="button"
                    className="text-link"
                    onClick={async () => {
                      if (!('Notification' in window)) {
                        toast('This browser does not support notifications.')
                        return
                      }
                      try {
                        setPermission(await enableNotifications())
                      } catch {
                        toast.error(
                          'Notifications could not be enabled. Check browser permissions and retry.',
                        )
                      }
                    }}
                  >
                    <Bell size={15} />
                    Enable browser notifications
                  </button>
                  <button
                    className="button primary"
                    disabled={!loaded || saving}
                  >
                    {saving ? 'Saving…' : 'Save preferences'}
                  </button>
                </form>
              </section>
              <div>
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Life areas</h2>
                      <p>Give each part of your life its own space.</p>
                    </div>
                    <button
                      className="icon-btn"
                      aria-label="Add life area"
                      onClick={() => setModal({ type: 'area' })}
                    >
                      <Plus size={19} />
                    </button>
                  </div>
                  {w.areas.map((a) => (
                    <button
                      key={a.id}
                      className="settings-area"
                      onClick={() => setModal({ type: 'area', id: a.id })}
                    >
                      <span
                        className="area-dot"
                        style={{ background: a.color }}
                      />
                      {a.name}
                      <Pencil size={14} />
                    </button>
                  ))}
                </section>
                <section className="panel">
                  <h2>Backup & recovery</h2>
                  <p className="helper">
                    Export tasks, historical occurrences and progress, goals,
                    reviews, journal entries, life areas, focus sessions, and
                    preferences in a portable DAYSTAR v2 JSON file.
                  </p>
                  <div className="backup-buttons">
                    <button
                      className="button secondary"
                      disabled={!loaded}
                      onClick={download}
                    >
                      <Download size={16} />
                      Export backup
                    </button>
                    <button
                      className="button secondary"
                      disabled={!loaded || saving}
                      onClick={() => file.current?.click()}
                    >
                      <Upload size={16} />
                      Import backup
                    </button>
                    <input
                      type="file"
                      accept="application/json,.json"
                      hidden
                      ref={file}
                      onChange={(e) => {
                        if (e.target.files?.[0])
                          void importFile(e.target.files[0])
                        e.target.value = ''
                      }}
                    />
                  </div>
                  <p className="helper">
                    Imports add new IDs and keep existing records. An export is
                    a manual backup, not an automatic backup. Store it securely.
                    For a lost device, sign in on another device or import your
                    last export.
                  </p>
                </section>
                <section className="panel">
                  <h2>Privacy & connected services</h2>
                  <div className="service-row">
                    <span>Storage</span>
                    <b>
                      {mode === 'offline'
                        ? 'Offline device copy'
                        : loaded
                          ? 'Cloud database connected'
                          : error
                            ? 'Unavailable · retry connection'
                            : 'Connection pending'}
                    </b>
                  </div>
                  <div className="service-row">
                    <span>Cross-device sync</span>
                    <b>
                      {offlineConflict
                        ? 'Needs your choice'
                        : offlinePending
                          ? 'Waiting for connection'
                          : mode === 'account'
                            ? 'Account workspace'
                            : 'Sign in to connect'}
                    </b>
                  </div>
                  <div className="service-row">
                    <span>Offline copy</span>
                    <b>
                      {offlineStorageAvailable === false
                        ? 'Unavailable in this browser'
                        : offlinePending
                          ? 'Changes waiting to sync'
                          : mode === 'offline'
                            ? 'Last saved copy in this browser'
                            : offlineStorageAvailable
                              ? 'Ready on this browser'
                              : 'Checking availability'}
                    </b>
                  </div>
                  <div className="service-row">
                    <span>Sign-in</span>
                    <b>Email and password</b>
                  </div>
                  <div className="service-row">
                    <span>AI coach</span>
                    <b>Server-side provider</b>
                  </div>
                  <p className="helper">
                    Private records are accessed on the server. Journal entries
                    are never included in AI requests. A private offline copy is
                    stored in this browser’s IndexedDB and may be accessible to
                    anyone using this browser profile. Offline edits sync after
                    reconnection when the cloud revision is unchanged. A
                    conflict stops automatic sync and keeps both copies until
                    you choose. Browser workspaces also depend on their private
                    cookie; export before clearing browser data.
                  </p>
                </section>
                <div className="version-note">
                  <Sun size={18} />
                  DAYSTAR Personal Growth OS
                  <span>Version 2.0 · A fresh beginning</span>
                  <a
                    href="https://vercel.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Project support
                    <ArrowUpRight size={12} />
                  </a>
                </div>
              </div>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <Sun size={14} />A little progress. A day at a time.
            </span>
            <span>DAYSTAR · PERSONAL GROWTH OS</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-bottom">
        {[...mainNav, { name: 'Settings', icon: Settings }].map((n) => (
          <button
            key={n.name}
            className={page === n.name ? 'active' : ''}
            aria-current={page === n.name ? 'page' : undefined}
            onClick={() => navigate(n.name as Page)}
          >
            <n.icon size={20} />
            <span>{n.name}</span>
          </button>
        ))}
      </nav>
      <Dialog open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="daystar-dialog">
          <DialogHeader>
            <DialogTitle>
              {modal?.type === 'task'
                ? editTask
                  ? 'Edit your commitment'
                  : 'A commitment to yourself'
                : modal?.type === 'journal'
                  ? editJournal
                    ? 'Revisit your reflection'
                    : 'A moment for reflection'
                  : modal?.type === 'progress'
                    ? 'Every little step counts.'
                    : modal?.type === 'goal'
                      ? 'Give your intention a direction.'
                      : modal?.type === 'area'
                        ? 'Make space for a life area.'
                        : authMode === 'signup'
                          ? 'Your growth, across devices.'
                          : authMode === 'recover'
                            ? 'Recover your account.'
                            : authMode === 'newpassword'
                              ? 'Choose a new password.'
                              : 'Welcome to your personal space.'}
            </DialogTitle>
            <DialogDescription>
              {modal?.type === 'task'
                ? 'Set a realistic target and a rhythm that works for you.'
                : modal?.type === 'progress'
                  ? `Record actual progress for ${editOcc?.snapshot.title ?? 'your commitment'}.`
                  : modal?.type === 'auth'
                    ? 'Your private records belong to your account. Browser records stay separate until you explicitly import them.'
                    : 'A thoughtful space for the things that matter.'}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={submit}
            className="modal-form"
            key={`${modal?.type}-${modal?.id}-${authMode}`}
          >
            {modal?.type === 'task' && (
              <>
                <Field label="Task name">
                  <input
                    autoFocus
                    name="title"
                    defaultValue={editTask?.title}
                    placeholder="What would you like to commit to?"
                    required
                    maxLength={200}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Life area">{areaSelect(editTask?.area)}</Field>
                  <Field label="Priority">
                    <select
                      name="priority"
                      defaultValue={editTask?.priority ?? 'Medium'}
                    >
                      {['Low', 'Medium', 'High'].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Measurement unit">
                    <select
                      name="unit"
                      defaultValue={
                        editTask &&
                        ![
                          'minutes',
                          'repetitions',
                          'sessions',
                          'chapters',
                          'counts',
                        ].includes(editTask.unit)
                          ? 'custom'
                          : (editTask?.unit ?? 'minutes')
                      }
                    >
                      <option value="minutes">Minutes</option>
                      <option value="counts">Counts</option>
                      <option value="repetitions">Repetitions</option>
                      <option value="sessions">Sessions</option>
                      <option value="chapters">Chapters</option>
                      <option value="custom">Custom unit</option>
                    </select>
                  </Field>
                  <Field label="Target (0 for a simple check-off)">
                    <input
                      name="target"
                      type="number"
                      min="0"
                      max="1000000"
                      step="any"
                      defaultValue={editTask?.target ?? 30}
                      required
                    />
                  </Field>
                  <Field label="Custom unit, if selected">
                    <input
                      name="customUnit"
                      placeholder="e.g. pages"
                      defaultValue={editTask?.unit}
                      maxLength={40}
                    />
                  </Field>
                  <Field label="Repeat">
                    <select
                      name="recurrence"
                      defaultValue={editTask?.recurrence ?? 'once'}
                    >
                      <option value="once">One time</option>
                      <option value="daily">Every day</option>
                      <option value="weekdays">Weekdays (Mon–Fri)</option>
                      <option value="weekly">Weekly on start weekday</option>
                      <option value="selected">Selected weekdays</option>
                    </select>
                  </Field>
                  <Field label="Start / scheduled date">
                    <input
                      type="date"
                      name="date"
                      defaultValue={editTask?.date ?? date}
                      required
                    />
                  </Field>
                  <Field label="End date (optional)">
                    <input
                      type="date"
                      name="end"
                      defaultValue={editTask?.end}
                    />
                  </Field>
                </div>
                <fieldset>
                  <legend>For selected weekdays</legend>
                  <div className="weekday-picker">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                      (d, i) => (
                        <label key={d}>
                          <input
                            type="checkbox"
                            name="weekday"
                            value={i}
                            defaultChecked={editTask?.weekdays.includes(i)}
                          />
                          {d}
                        </label>
                      ),
                    )}
                  </div>
                </fieldset>
                <Field label="Description & notes (optional)">
                  <textarea
                    name="description"
                    defaultValue={editTask?.description}
                    placeholder="A little clarity about why this matters…"
                    maxLength={3000}
                  />
                </Field>
                {editTask && (
                  <p className="helper">
                    Past occurrences are preserved. Existing progress entries
                    keep their original target and unit. To change today’s
                    target after recording progress, create a new commitment.
                  </p>
                )}
              </>
            )}
            {modal?.type === 'progress' && (
              <>
                <div className="progress-summary">
                  <strong>{editOcc?.snapshot.title}</strong>
                  <span>
                    {editOcc ? amount(editOcc) : 0} / {editOcc?.snapshot.target}{' '}
                    {editOcc?.snapshot.unit}
                  </span>
                  <Progress value={editOcc ? targetPercent(editOcc) : 0} />
                  <p>
                    {Math.max(
                      0,
                      (editOcc?.snapshot.target ?? 0) -
                        (editOcc ? amount(editOcc) : 0),
                    )}{' '}
                    {editOcc?.snapshot.unit} remaining
                  </p>
                </div>
                <Field label={`Add progress (${editOcc?.snapshot.unit})`}>
                  <input
                    autoFocus
                    name="value"
                    type="number"
                    step="any"
                    min="0.01"
                    max="1000000"
                    placeholder="How much did you do?"
                    required
                  />
                </Field>
                <p className="helper">
                  Amounts add to earlier entries. The display caps at 100%; your
                  full recorded amount is preserved.
                </p>
                {editOcc?.entries.map((e) => (
                  <div className="progress-entry" key={e.id}>
                    <span>
                      +{e.value} {editOcc.snapshot.unit}
                    </span>
                    <span>
                      {new Date(e.at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Delete this progress entry"
                      onClick={async () => {
                        if (confirm('Delete this individual progress entry?'))
                          await save(
                            putOccurrence(w, {
                              ...editOcc,
                              entries: editOcc.entries.filter(
                                (x) => x.id !== e.id,
                              ),
                            }),
                          )
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-link"
                  onClick={async () => {
                    if (
                      editOcc &&
                      confirm(
                        `${editOcc.status === 'skipped' ? 'Restore' : 'Skip'} this occurrence? Skipped occurrences are excluded from metrics; progress stays recorded.`,
                      )
                    ) {
                      if (
                        await save(
                          putOccurrence(w, {
                            ...editOcc,
                            status:
                              editOcc.status === 'skipped' ? 'open' : 'skipped',
                          }),
                        )
                      )
                        setModal(null)
                    }
                  }}
                >
                  {editOcc?.status === 'skipped'
                    ? 'Restore this occurrence'
                    : 'Skip this occurrence'}
                </button>
              </>
            )}
            {modal?.type === 'journal' && (
              <>
                <Field label="Reflection title">
                  <input
                    autoFocus
                    name="title"
                    defaultValue={editJournal?.title}
                    placeholder="What’s on your mind?"
                    maxLength={200}
                    required
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Date">
                    <input
                      type="date"
                      name="date"
                      defaultValue={editJournal?.date ?? date}
                      required
                    />
                  </Field>
                  <Field label="Life area (optional)">
                    <select name="area" defaultValue={editJournal?.area ?? ''}>
                      <option value="">General reflection</option>
                      {w.areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Linked goal (optional)">
                  <select
                    name="goalId"
                    defaultValue={editJournal?.goalId ?? ''}
                  >
                    <option value="">No linked goal</option>
                    {w.goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="journal-prompts">
                  What went well? What felt difficult? What did you learn? What
                  is your next practical step?
                </div>
                <Field label="Your reflection">
                  <textarea
                    name="body"
                    defaultValue={editJournal?.body}
                    className="large-textarea"
                    placeholder="Begin wherever you are…"
                    required
                    maxLength={30000}
                  />
                </Field>
              </>
            )}
            {modal?.type === 'goal' && (
              <>
                <Field label="Goal title">
                  <input
                    autoFocus
                    name="title"
                    defaultValue={editGoal?.title}
                    placeholder="Something meaningful to work toward"
                    maxLength={200}
                    required
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    name="description"
                    defaultValue={editGoal?.description}
                    maxLength={3000}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Life area">{areaSelect(editGoal?.area)}</Field>
                  <Field label="Target date">
                    <input
                      type="date"
                      name="date"
                      defaultValue={editGoal?.date ?? addDay(today, 30)}
                      required
                    />
                  </Field>
                </div>
                <Field label="Milestones (one per line)">
                  <textarea
                    name="milestones"
                    defaultValue={editGoal?.milestones
                      .map((m) => m.title)
                      .join('\n')}
                    placeholder="A small first step…"
                  />
                </Field>
                <fieldset>
                  <legend>Link existing tasks</legend>
                  {w.tasks
                    .filter((t) => !t.archivedFrom)
                    .map((t) => (
                      <label className="check-label" key={t.id}>
                        <input
                          type="checkbox"
                          name="taskIds"
                          value={t.id}
                          defaultChecked={editGoal?.taskIds.includes(t.id)}
                        />
                        {t.title}
                      </label>
                    ))}
                </fieldset>
                <Field label="Notes">
                  <textarea
                    name="notes"
                    maxLength={5000}
                    defaultValue={editGoal?.notes}
                  />
                </Field>
              </>
            )}
            {modal?.type === 'area' && (
              <>
                <Field label="Life area name">
                  <input
                    autoFocus
                    name="title"
                    defaultValue={editArea?.name}
                    maxLength={80}
                    required
                  />
                </Field>
                <Field label="Area colour">
                  <input
                    name="color"
                    type="color"
                    defaultValue={editArea?.color ?? '#ac915d'}
                  />
                </Field>
              </>
            )}
            {modal?.type === 'auth' && (
              <>
                {authMode === 'signup' && (
                  <Field label="Your name">
                    <input
                      name="name"
                      maxLength={100}
                      autoComplete="name"
                      required
                    />
                  </Field>
                )}
                {authMode !== 'newpassword' && (
                  <Field label="Email address">
                    <input
                      autoFocus
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                    />
                  </Field>
                )}
                {authMode !== 'recover' && (
                  <Field label="Password">
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      autoComplete={
                        authMode === 'login'
                          ? 'current-password'
                          : 'new-password'
                      }
                      required
                    />
                  </Field>
                )}
                <div className="auth-links">
                  <button
                    className="text-link"
                    type="button"
                    onClick={() =>
                      setAuthMode(authMode === 'signup' ? 'login' : 'signup')
                    }
                  >
                    {authMode === 'signup'
                      ? 'Already have an account? Sign in'
                      : 'Create an account'}
                  </button>
                  <button
                    className="text-link"
                    type="button"
                    onClick={() => setAuthMode('recover')}
                  >
                    Forgot password
                  </button>
                </div>
              </>
            )}
            {error && (
              <p className="error-banner" role="alert">
                {error} Your changes are not saved. Copy any unsaved text before
                reconnecting.
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={
                  saving || authPending || (!loaded && modal?.type !== 'auth')
                }
              >
                {authPending
                  ? 'Connecting…'
                  : saving
                    ? 'Saving…'
                    : modal?.type === 'auth'
                      ? authMode === 'signup'
                        ? 'Create account'
                        : authMode === 'recover'
                          ? 'Send recovery email'
                          : authMode === 'newpassword'
                            ? 'Update password'
                            : 'Sign in'
                      : modal?.type === 'progress'
                        ? 'Record progress'
                        : 'Save'}
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
