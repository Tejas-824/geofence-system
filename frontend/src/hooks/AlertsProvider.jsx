import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { WS_URL } from '../api/client'

const AlertsContext = createContext(null)
const MAX_ALERTS = 50
const MAX_TOASTS = 4

export function AlertsProvider({ children }) {
  const [alerts, setAlerts] = useState([])
  const [toasts, setToasts] = useState([])
  const [connected, setConnected] = useState(false)

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.event_id !== id))
  }, [])

  useEffect(() => {
    let socket
    let retryTimer
    let retries = 0
    let stopped = false

    const connect = () => {
      socket = new WebSocket(WS_URL)

      socket.onopen = () => {
        retries = 0
        setConnected(true)
      }

      socket.onmessage = (msg) => {
        let alert
        try {
          alert = JSON.parse(msg.data)
        } catch {
          return
        }
        setAlerts((prev) => [alert, ...prev].slice(0, MAX_ALERTS))
        setToasts((prev) => [alert, ...prev].slice(0, MAX_TOASTS))
        setTimeout(() => dismissToast(alert.event_id), 8000)
      }

      socket.onclose = () => {
        setConnected(false)
        if (stopped) return
        // wait a bit longer after every failed try, max 15s
        const delay = Math.min(1000 * 2 ** retries, 15000)
        retries += 1
        retryTimer = setTimeout(connect, delay)
      }

      socket.onerror = () => socket.close()
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      socket?.close()
    }
  }, [dismissToast])

  return (
    <AlertsContext.Provider value={{ alerts, toasts, connected, dismissToast }}>
      {children}
    </AlertsContext.Provider>
  )
}

export function useAlerts() {
  const ctx = useContext(AlertsContext)
  if (!ctx) throw new Error('useAlerts must be used inside AlertsProvider')
  return ctx
}