import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import Daystar from './daystar'
import { initialWorkspace } from '@/lib/model'

vi.mock('@netlify/identity', () => ({
  getUser: vi.fn().mockResolvedValue(null),
  getSettings: vi.fn().mockResolvedValue({ providers: {} }),
  handleAuthCallback: vi.fn().mockResolvedValue(null),
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: initialWorkspace(),
        revision: 0,
        scope: 'private',
        mode: 'device',
      }),
    }),
  )
})

describe('saved workspace interactions', () => {
  it('opens every workspace destination with empty saved records', async () => {
    const { container } = render(<Daystar />)
    await screen.findByText('Private workspace')
    const sidebar = within(container.querySelector('aside')!)
    for (const name of [
      'Tasks',
      'Insights',
      'Journal',
      'Goals',
      'Planner',
      'Focus Room',
      'Accountability Coach',
      'Settings',
      'Home',
    ]) {
      fireEvent.click(sidebar.getByRole('button', { name }))
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    }
    expect(
      screen.queryByRole('button', { name: /reset/i }),
    ).not.toBeInTheDocument()
  })

  it('keeps an unsaved task form and its text after a revision conflict', async () => {
    render(<Daystar />)
    await screen.findByText('Private workspace')
    fireEvent.click(screen.getByRole('button', { name: /add task/i }))
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.change(dialog.getByLabelText('Task name'), {
      target: { value: 'Read one chapter' },
    })
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Records changed on another device.' }),
    } as Response)
    fireEvent.submit(
      dialog.getByRole('button', { name: 'Save' }).closest('form')!,
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Records changed on another device.',
      ),
    )
    expect(dialog.getByLabelText('Task name')).toHaveValue('Read one chapter')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const request = vi
      .mocked(fetch)
      .mock.calls.find(([, options]) => options?.method === 'PUT')
    expect(request).toBeDefined()
    expect(JSON.parse(request![1]!.body as string)).toMatchObject({
      revision: 0,
      scope: 'private',
    })
  })
})
