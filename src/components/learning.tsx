import { useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { reviewLearning } from '@/lib/model'
import type { Workspace } from '@/lib/model'

type Item = Workspace['learning'][number]
export function Learning({
  workspace,
  today,
  disabled,
  save,
  editing,
}: {
  workspace: Workspace
  today: string
  disabled: boolean
  save: (next: Workspace) => Promise<boolean>
  editing: (open: boolean) => void
}) {
  const [editor, setEditor] = useState<Item | 'new' | null>(null)
  const [filter, setFilter] = useState('')
  const [revealed, setRevealed] = useState<string[]>([])
  const [error, setError] = useState('')
  const open = (item: Item | 'new' | null) => {
    setEditor(item)
    editing(!!item)
    setError('')
  }
  const old = editor && editor !== 'new' ? editor : undefined
  const items = workspace.learning
    .filter((item) =>
      `${item.course} ${item.topic} ${item.question}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    )
    .sort((a, b) => a.due.localeCompare(b.due))
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '').trim()
    const item: Item = {
      id: old?.id ?? crypto.randomUUID(),
      kind: value('kind') as Item['kind'],
      course: value('course'),
      topic: value('topic'),
      question: value('question'),
      answer: value('answer'),
      due: value('due'),
      reviews: old?.reviews ?? [],
    }
    if (
      await save({
        ...workspace,
        learning: [...workspace.learning.filter((x) => x.id !== item.id), item],
      })
    )
      open(null)
    else setError('Not saved. Keep this form open and retry when connected.')
  }
  return (
    <section className="panel learning-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">PRACTICE WITH PURPOSE</span>
          <h2>Study & scripture review</h2>
          <p>
            {workspace.learning.filter((x) => x.due <= today).length} due for
            review · Recall practice is separate from task completion and focus
            time.
          </p>
        </div>
        <button
          className="button secondary"
          disabled={disabled}
          onClick={() => open('new')}
        >
          <Plus size={16} />
          Add review
        </button>
      </div>
      <label className="field">
        Find a course, reading plan or topic
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search your review library"
        />
      </label>
      {!items.length && (
        <div className="empty-state">
          <BookOpen size={26} />
          <h3>
            {workspace.learning.length
              ? 'No matching reviews'
              : 'Keep what you learn'}
          </h3>
          <p>
            Add a course topic or scripture passage, write a recall question,
            and schedule your first review. Use commitments above for
            assignments, exams, reading and prayer routines.
          </p>
        </div>
      )}
      <div className="learning-grid">
        {items.map((item) => (
          <article className="learning-card" key={item.id}>
            <div className="learning-meta">
              <span>
                {item.kind === 'study' ? 'Study' : 'Scripture'} · {item.course}
              </span>
              <span className={item.due <= today ? 'review-due' : ''}>
                {item.due <= today ? 'Due' : 'Next'} · {item.due}
              </span>
            </div>
            <h3>{item.topic}</h3>
            <p className="recall-question">{item.question}</p>
            <button
              className="text-link"
              aria-expanded={revealed.includes(item.id)}
              onClick={() =>
                setRevealed((ids) =>
                  ids.includes(item.id)
                    ? ids.filter((id) => id !== item.id)
                    : [...ids, item.id],
                )
              }
            >
              {revealed.includes(item.id)
                ? 'Hide notes'
                : 'Reveal notes after recalling'}
            </button>
            {revealed.includes(item.id) && (
              <div className="recall-answer">
                {item.answer || 'No notes added yet.'}
              </div>
            )}
            <p className="helper">
              Recall first, then rate your review. Again: tomorrow · Hard: 2
              days · Good: increasing interval, up to 60 days.
            </p>
            <div className="review-actions">
              {(['again', 'hard', 'good'] as const).map((rating) => (
                <button
                  className="button secondary"
                  disabled={disabled || item.due > today}
                  key={rating}
                  onClick={async () => {
                    if (
                      await save({
                        ...workspace,
                        learning: workspace.learning.map((x) =>
                          x.id === item.id
                            ? reviewLearning(x, rating, today)
                            : x,
                        ),
                      })
                    )
                      setRevealed((ids) => ids.filter((id) => id !== item.id))
                  }}
                >
                  {rating === 'again'
                    ? 'Again'
                    : rating === 'hard'
                      ? 'Hard'
                      : 'Good'}
                </button>
              ))}
              <button
                className="icon-btn"
                aria-label={`Edit ${item.topic}`}
                disabled={disabled}
                onClick={() => open(item)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-btn"
                aria-label={`Delete ${item.topic}`}
                disabled={disabled}
                onClick={async () => {
                  if (
                    confirm(
                      `Delete review “${item.topic}” and its review history?`,
                    )
                  )
                    await save({
                      ...workspace,
                      learning: workspace.learning.filter(
                        (x) => x.id !== item.id,
                      ),
                    })
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <details>
              <summary>{item.reviews.length} recorded reviews</summary>
              {[...item.reviews].reverse().map((review, i) => (
                <p className="helper" key={i}>
                  {new Date(review.at).toLocaleString()} · {review.rating} ·
                  next {review.next}
                </p>
              ))}
            </details>
          </article>
        ))}
      </div>
      <Dialog
        open={!!editor}
        onOpenChange={(value) => {
          if (!value) open(null)
        }}
      >
        <DialogContent className="daystar-dialog">
          <DialogHeader>
            <DialogTitle>{old ? 'Edit review' : 'New review'}</DialogTitle>
            <DialogDescription>
              Private recall notes stay in your workspace and are never included
              in coach context.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <label className="field">
              Review type
              <select name="kind" defaultValue={old?.kind ?? 'study'}>
                <option value="study">Academic study</option>
                <option value="scripture">Scripture memorisation</option>
              </select>
            </label>
            <label className="field">
              Course or reading plan
              <input
                name="course"
                required
                maxLength={200}
                defaultValue={old?.course}
              />
            </label>
            <label className="field">
              Topic or passage
              <input
                name="topic"
                required
                maxLength={200}
                defaultValue={old?.topic}
              />
            </label>
            <label className="field">
              Recall question
              <textarea
                name="question"
                required
                maxLength={3000}
                defaultValue={old?.question}
              />
            </label>
            <label className="field">
              Answer, notes or lessons
              <textarea
                name="answer"
                maxLength={5000}
                defaultValue={old?.answer}
              />
            </label>
            <label className="field">
              Next review
              <input
                type="date"
                name="due"
                required
                defaultValue={old?.due ?? today}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button className="button primary" disabled={disabled}>
              Save review
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
