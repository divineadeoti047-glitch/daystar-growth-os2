import { useEffect, useState } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { Workspace } from '@/lib/model'
export function CommandMenu({
  workspace,
  navigate,
  edit,
  onOpenChange,
}: {
  workspace: Workspace
  navigate: (
    page:
      | 'Home'
      | 'Tasks'
      | 'Journal'
      | 'Goals'
      | 'Growth Studio'
      | 'Planner'
      | 'Focus Room'
      | 'Accountability Coach',
  ) => void
  edit: (type: 'task' | 'journal' | 'goal', id?: string) => void
  onOpenChange: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('')
  function change(value: boolean) {
    setOpen(value)
    onOpenChange(value)
    if (!value) setQuery('')
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((value) => {
          onOpenChange(!value)
          return !value
        })
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onOpenChange])
  const actions = [
    {
      title: 'Create a commitment',
      detail: 'Quick action',
      action: () => edit('task'),
    },
    {
      title: 'Write a reflection',
      detail: 'Quick action',
      action: () => edit('journal'),
    },
    {
      title: 'Enter the Focus Room',
      detail: 'Go to',
      action: () => navigate('Focus Room'),
    },
    {
      title: 'Open Growth Studio',
      detail: 'Courses, projects, spiritual plans and reviews',
      action: () => navigate('Growth Studio'),
    },
    {
      title: 'See my planner',
      detail: 'Go to',
      action: () => navigate('Planner'),
    },
    {
      title: 'Ask the coach',
      detail: 'Go to',
      action: () => navigate('Accountability Coach'),
    },
    ...workspace.tasks
      .filter((t) => !t.archivedFrom)
      .map((t) => ({
        title: t.title,
        detail: 'Commitment',
        action: () => edit('task', t.id),
      })),
    ...workspace.goals.map((g) => ({
      title: g.title,
      detail: 'Goal',
      action: () => edit('goal', g.id),
    })),
    ...workspace.journals.map((j) => ({
      title: j.title,
      detail: `Private journal · ${j.date}`,
      action: () => edit('journal', j.id),
    })),
  ].filter((a) =>
    `${a.title} ${a.detail}`.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <>
      <button
        className="command-trigger"
        onClick={() => change(true)}
        aria-label="Search workspace and quick actions"
      >
        <Search size={16} />
        <span>Find your next move</span>
        <kbd>⌘ / Ctrl K</kbd>
      </button>
      <Dialog open={open} onOpenChange={change}>
        <DialogContent className="daystar-dialog command-dialog">
          <DialogHeader>
            <DialogTitle>A little less searching.</DialogTitle>
            <DialogDescription>
              Find saved commitments, goals, journal titles, or a quick action.
              Search stays in this workspace.
            </DialogDescription>
          </DialogHeader>
          <label className="field">
            <span>Search your workspace</span>
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="A task, an intention, a place to begin…"
            />
          </label>
          <div className="command-results">
            {actions.slice(0, 30).map((a, i) => (
              <button
                key={`${a.detail}:${i}`}
                onClick={() => {
                  change(false)
                  a.action()
                }}
              >
                <span>
                  <b>{a.title}</b>
                  <small>{a.detail}</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
            {!actions.length && (
              <p>No matches. Try another title or create a commitment.</p>
            )}
            {actions.length > 30 && (
              <p>Showing 30 matches. Refine your search to find more.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
