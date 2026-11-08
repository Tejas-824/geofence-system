import { useAlerts } from '../hooks/AlertsProvider'
import AlertItem from './AlertItem'

export default function Toasts() {
  const { toasts, dismissToast } = useAlerts()

  return (
    <div className="fixed right-4 top-16 z-[2000] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <AlertItem key={t.event_id} alert={t} onDismiss={() => dismissToast(t.event_id)} />
      ))}
    </div>
  )
}