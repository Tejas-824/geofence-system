import { NavLink, Route, Routes } from 'react-router-dom'
import Toasts from './components/Toasts'
import { LiveBadge } from './components/ui'
import { AlertsProvider } from './hooks/AlertsProvider'
import Alerts from './pages/Alerts'
import Dashboard from './pages/Dashboard'
import Geofences from './pages/Geofences'
import History from './pages/History'
import Vehicles from './pages/Vehicles'

const links = [
  ['/', 'Dashboard'],
  ['/geofences', 'Geofences'],
  ['/vehicles', 'Vehicles'],
  ['/alerts', 'Alerts'],
  ['/history', 'History'],
]

export default function App() {
  return (
    <AlertsProvider>
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="sticky top-0 z-1500 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <h1 className="shrink-0 font-bold text-blue-700">Geofence Tracker</h1>
            <nav className="flex gap-1 overflow-x-auto text-sm">
              {links.map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-lg px-3 py-1.5 ${isActive ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
            <LiveBadge />
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/geofences" element={<Geofences />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>

        <Toasts />
      </div>
    </AlertsProvider>
  )
}