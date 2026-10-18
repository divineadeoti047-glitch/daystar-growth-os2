import { describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { Learning } from './learning'
import { initialWorkspace } from '@/lib/model'
import type { Workspace } from '@/lib/model'
const item: Workspace['learning'][number] = {
  id: 'topic',
  kind: 'study',
  course: 'BIO 201',
  topic: 'Cell division',
  question: 'How does meiosis differ?',
  answer: 'Private recall answer',
  due: '2026-10-18',
  reviews: [],
}
describe('review workflow', () => {
  it('preserves text when a save fails and closes only after success', async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const editing = vi.fn()
    render(
      <Learning
        workspace={initialWorkspace()}
        today="2026-10-18"
        disabled={false}
        save={save}
        editing={editing}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add review' }))
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.change(dialog.getByLabelText('Course or reading plan'), {
      target: { value: 'BIO 201' },
    })
    fireEvent.change(dialog.getByLabelText('Topic or passage'), {
      target: { value: 'Cell division' },
    })
    fireEvent.change(dialog.getByLabelText('Recall question'), {
      target: { value: 'How does meiosis differ?' },
    })
    fireEvent.submit(
      dialog.getByRole('button', { name: 'Save review' }).closest('form')!,
    )
    await screen.findByRole('alert')
    expect(dialog.getByLabelText('Topic or passage')).toHaveValue(
      'Cell division',
    )
    fireEvent.submit(
      dialog.getByRole('button', { name: 'Save review' }).closest('form')!,
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(save.mock.calls[1][0].learning[0]).toMatchObject({
      course: 'BIO 201',
      topic: 'Cell division',
      due: '2026-10-18',
      reviews: [],
    })
    expect(editing).toHaveBeenLastCalledWith(false)
  })
  it('reveals private notes on demand and saves a dated recall review', async () => {
    const workspace = initialWorkspace()
    workspace.learning = [item]
    const save = vi.fn().mockResolvedValue(true)
    render(
      <Learning
        workspace={workspace}
        today="2026-10-18"
        disabled={false}
        save={save}
        editing={vi.fn()}
      />,
    )
    expect(screen.queryByText('Private recall answer')).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Reveal notes after recalling' }),
    )
    expect(screen.getByText('Private recall answer')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save.mock.calls[0][0].learning[0]).toMatchObject({
      due: '2026-10-20',
      reviews: [{ rating: 'hard', next: '2026-10-20' }],
    })
    expect(workspace.learning[0].reviews).toEqual([])
  })
})
