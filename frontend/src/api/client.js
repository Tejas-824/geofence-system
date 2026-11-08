const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws/alerts'

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

// builds ?a=1&b=2 and skips empty values
function query(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== '' && v != null)
  return entries.length ? '?' + new URLSearchParams(entries).toString() : ''
}

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) })

export const api = {
  getGeofences: (category = '') => request(`/geofences${query({ category })}`),
  createGeofence: (body) => post('/geofences', body),

  getVehicles: () => request('/vehicles'),
  createVehicle: (body) => post('/vehicles', body),
  getVehicleLocation: (id) => request(`/vehicles/location/${id}`),
  updateLocation: (body) => post('/vehicles/location', body),

  getAlerts: () => request('/alerts'),
  configureAlert: (body) => post('/alerts/configure', body),

  getHistory: (params = {}) => request(`/violations/history${query(params)}`),
}