import { CATEGORIES } from '../constants'
import { useAlerts } from '../hooks/AlertsProvider'

export function Notice({ message }) {
  if (!message) return null
  const styles =
    message.type === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-green-200 bg-green-50 text-green-700'
  return <p className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>{message.text}</p>
}

export function Loading({ text = 'Loading…' }) {
  return <p className="py-6 text-center text-sm text-slate-500">{text}</p>
}

export function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

export function CategoryBadge({ category }) {
  const c = CATEGORIES[category]
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ background: c?.color ?? '#64748b' }}
    >
      {c?.label ?? category}
    </span>
  )
}

export function LiveBadge() {
  const { connected } = useAlerts()
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'animate-pulse bg-amber-500'}`} />
      {connected ? 'Live' : 'Reconnecting…'}
    </span>
  )
}