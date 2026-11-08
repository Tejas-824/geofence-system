import { cardCls } from '../constants'
import { useAlerts } from '../hooks/AlertsProvider'
import AlertItem from './AlertItem'
import { LiveBadge } from './ui'

export default function AlertFeed({ limit = 10 }) {
  const { alerts } = useAlerts()

  return (
    <div className={cardCls}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Live alerts</h2>
        <LiveBadge />
      </div>
      {alerts.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          No alerts yet. They'll show up here the moment a vehicle triggers a rule.
        </p>
      ) : (
        <div className="space-y-2">
          {alerts.slice(0, limit).map((a) => (
            <AlertItem key={a.event_id} alert={a} />
          ))}
        </div>
      )}
    </div>
  )
}