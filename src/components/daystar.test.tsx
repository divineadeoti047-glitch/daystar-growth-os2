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

vi.mock('@/lib/auth-client', () => ({
  getUser: vi.fn().mockResolvedValue(null),
  login: vi.fn().mockResolvedValue({
    email: 'reader@example.com',
    name: 'Reader',
    confirmedAt: '2026-10-27T10:00:00.000Z',
  }),
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

  it('offers to add device records to the account after sign-in', async () => {
    const device = initialWorkspace()
    device.tasks.push({
      id: 'device-task-1',
      title: 'Read one chapter',
      description: '',
      area: device.areas[0].id,
      unit: 'chapters',
      target: 1,
      date: '2026-10-27',
      recurrence: 'once',
      weekdays: [],
      priority: 'Medium',
      createdAt: '2026-10-27T10:00:00.000Z',
      updatedAt: '2026-10-27T10:00:00.000Z',
    })
    const account = initialWorkspace()
    const response = (
      data: unknown,
      revision: number,
      scope: string,
      mode: string,
    ) => ({
      ok: true,
      json: async () => ({ data, revision, scope, mode }),
    })
    const request = vi
      .fn()
      .mockResolvedValueOnce(response(device, 2, 'device-scope', 'device'))
      .mockResolvedValueOnce(response(account, 8, 'account-scope', 'account'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ revision: 9 }) })
    vi.stubGlobal('fetch', request)
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const { container } = render(<Daystar />)
    await screen.findByText('Private workspace')
    fireEvent.click(
      within(container.querySelector('aside')!).getByRole('button', {
        name: 'Settings',
      }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /sign in or create account/i }),
    )
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.change(dialog.getByLabelText('Email address'), {
      target: { value: 'reader@example.com' },
    })
    fireEvent.change(dialog.getByLabelText('Password'), {
      target: { value: 'long-enough-password' },
    })
    fireEvent.submit(
      dialog.getByRole('button', { name: 'Sign in' }).closest('form')!,
    )
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Add them to your account'),
    )
    expect(JSON.parse(request.mock.calls[2][1].body).data.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Read one chapter' }),
      ]),
    )
    expect(JSON.parse(request.mock.calls[2][1].body)).toMatchObject({
      revision: 8,
      scope: 'account-scope',
    })
  })
})
