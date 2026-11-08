import { CATEGORIES, formatTime } from '../constants'
import { CategoryBadge } from './ui'

export default function AlertItem({ alert, onDismiss }) {
  const color = CATEGORIES[alert.geofence.category]?.color ?? '#64748b'
  const verb = alert.event_type === 'entry' ? 'entered' : 'exited'

  return (
    <div className="rounded-lg border border-l-4 border-slate-200 bg-white p-3 text-sm shadow-md" style={{ borderLeftColor: color }}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">
          {alert.vehicle.vehicle_number} {verb} {alert.geofence.geofence_name}
        </p>
        {onDismiss && (
          <button onClick={onDismiss} aria-label="Dismiss" className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <CategoryBadge category={alert.geofence.category} />
        <span className="text-slate-500">Driver: {alert.vehicle.driver_name}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {formatTime(alert.timestamp)} · {alert.location.latitude.toFixed(5)}, {alert.location.longitude.toFixed(5)}
      </p>
    </div>
  )
}