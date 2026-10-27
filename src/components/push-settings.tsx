import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { enableNotifications } from '@/lib/notifications'

export function PushSettings({
  scope,
  disabled,
}: {
  scope: string
  disabled: boolean
}) {
  const [config, setConfig] = useState<{
    configured: boolean
    publicKey?: string
    deviceIds?: string[]
  } | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState(
    'Checking background notification availability…',
  )
  useEffect(() => {
    let active = true
    // This reset is scoped to the authenticated workspace; do not show one account's push state for another.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(false)
    setConfig(null)
    void (async () => {
      try {
        const res = await fetch('/.netlify/functions/push-device')
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!active) return
        setConfig(data)
        setMessage(
          data.configured
            ? 'Connect this browser for reminders when the page is closed. Delivery depends on the browser and device.'
            : 'Background push needs deployed service configuration. Open-page reminders remain available.',
        )
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const worker = await navigator.serviceWorker.getRegistration('/sw.js')
          const subscription = await worker?.pushManager.getSubscription()
          if (subscription) {
            const digest = await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(subscription.endpoint),
            )
            const id = [...new Uint8Array(digest)]
              .map((n) => n.toString(16).padStart(2, '0'))
              .join('')
            if (active) setEnabled(!!data.deviceIds?.includes(id))
          }
        }
      } catch {
        if (active)
          setMessage(
            'Background notification settings are unavailable. Retry after reconnecting.',
          )
      }
    })()
    return () => {
      active = false
    }
  }, [scope])
  async function connect() {
    if (!config?.publicKey || !('PushManager' in window)) {
      setMessage(
        'Background push is unavailable in this browser. Use open-page reminders.',
      )
      return
    }
    setWorking(true)
    try {
      if ((await enableNotifications()) !== 'granted')
        throw new Error(
          'Allow notifications in your browser settings to connect this device.',
        )
      const registration = await navigator.serviceWorker.ready
      const encoded = config.publicKey.replace(/-/g, '+').replace(/_/g, '/')
      const key = Uint8Array.from(
        atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')),
        (c) => c.charCodeAt(0),
      ).buffer
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }))
      const res = await fetch('/.netlify/functions/push-device', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, subscription: subscription.toJSON() }),
      })
      if (!res.ok)
        throw new Error(
          'Could not connect this browser. Reconnect your workspace and retry.',
        )
      setEnabled(true)
      setMessage(
        'This browser is connected to this workspace. Set a commitment reminder below. Private task titles are hidden in background notifications.',
      )
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Could not connect notifications.',
      )
    } finally {
      setWorking(false)
    }
  }
  async function disconnect() {
    setWorking(true)
    try {
      const worker = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await worker?.pushManager.getSubscription()
      if (subscription) {
        const res = await fetch('/.netlify/functions/push-device', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope, subscription: subscription.toJSON() }),
        })
        if (!res.ok) throw new Error()
        await subscription.unsubscribe()
      }
      setEnabled(false)
      setMessage(
        'Background push is disconnected for this browser. Your saved reminders are kept.',
      )
    } catch {
      setMessage('Could not disconnect this browser. Please retry.')
    } finally {
      setWorking(false)
    }
  }
  return (
    <section className="push-settings">
      <div>
        <span className="studio-label">BROWSER NOTIFICATIONS</span>
        <h3>
          {enabled ? 'Connected to your rhythm.' : 'Let your plans reach you.'}
        </h3>
        <p aria-live="polite">{message}</p>
        <p className="helper">
          On Android, allow notifications and background browser activity.
          Scheduling runs on the published site. Connecting switches this
          browser’s push reminders to the current workspace.
        </p>
      </div>
      <button
        className="button secondary"
        disabled={disabled || working || !config?.configured}
        onClick={() => void (enabled ? disconnect() : connect())}
      >
        <Bell size={16} />
        {working
          ? 'Updating…'
          : enabled
            ? 'Disconnect this browser'
            : 'Connect this browser'}
      </button>
    </section>
  )
}
