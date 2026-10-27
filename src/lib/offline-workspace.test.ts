import { describe, expect, it } from 'vitest'
import { initialWorkspace } from './model'
import { syncDecision } from './offline-workspace'
import type { OfflineSnapshot } from './offline-workspace'

function snapshot(
  pending = true,
  revision = 4,
  scope = 'account-a',
): OfflineSnapshot {
  return {
    scope,
    revision,
    data: initialWorkspace(),
    savedAt: new Date('2026-10-27T10:00:00.000Z').toISOString(),
    pending,
  }
}

describe('offline workspace reconciliation', () => {
  it('syncs a pending copy only when its base cloud revision is unchanged', () => {
    expect(syncDecision(snapshot(), 'account-a', 4)).toBe('sync')
  })

  it('preserves both copies for a changed cloud revision', () => {
    expect(syncDecision(snapshot(), 'account-a', 5)).toBe('conflict')
  })

  it('does not apply a pending copy to a different account workspace', () => {
    expect(syncDecision(snapshot(), 'account-b', 4)).toBe('different-workspace')
  })

  it('does not queue an already-synced copy', () => {
    expect(syncDecision(snapshot(false), 'account-a', 4)).toBe('none')
    expect(syncDecision(null, 'account-a', 4)).toBe('none')
  })
})
