import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import AlertFeed from '../components/AlertFeed'
import GeoMap from '../components/GeoMap'
import { Field, Loading, Notice } from '../components/ui'
import { btnCls, cardCls, inputCls, toLocalInput } from '../constants'

// attaches the latest location and current geofences to a vehicle
async function withStatus(vehicle) {
  try {
    const status = await api.getVehicleLocation(vehicle.id)
    return { ...vehicle, location: status.current_location, geofences: status.current_geofences }
  } catch {
    return { ...vehicle, location: null, geofences: [] }
  }
}

export default function Dashboard() {
  const [geofences, setGeofences] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [vehicleId, setVehicleId] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [time, setTime] = useState(toLocalInput(new Date()))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    try {
      const [g, v] = await Promise.all([api.getGeofences(), api.getVehicles()])
      setGeofences(g.geofences)
      setVehicles(await Promise.all(v.vehicles.map(withStatus)))
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleMapClick = (la, ln) => {
    setLat(la.toFixed(6))
    setLng(ln.toFixed(6))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!vehicleId) return setMessage({ type: 'error', text: 'Pick a vehicle first.' })
    if (lat === '' || lng === '') return setMessage({ type: 'error', text: 'Click the map or type a latitude and longitude.' })
    if (!time) return setMessage({ type: 'error', text: 'Pick a date and time.' })

    setSaving(true)
    setMessage(null)
    try {
      const res = await api.updateLocation({
        vehicle_id: vehicleId,
        latitude: Number(lat),
        longitude: Number(lng),
        timestamp: new Date(time).toISOString(),
      })
      const inside = res.current_geofences.map((g) => g.geofence_name)
      setMessage({
        type: 'success',
        text: inside.length ? `Location saved. Inside: ${inside.join(', ')}` : 'Location saved. Not inside any geofence.',
      })

      const updated = await withStatus(vehicles.find((v) => v.id === vehicleId))
      setVehicles((prev) => prev.map((v) => (v.id === vehicleId ? updated : v)))
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const picked = lat !== '' && lng !== '' ? [Number(lat), Number(lng)] : null

  if (loading) return <Loading text="Loading map…" />

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <GeoMap
          geofences={geofences}
          vehicles={vehicles}
          picked={picked}
          focus={geofences[0]?.coordinates[0]}
          onMapClick={handleMapClick}
          className="h-[32rem]"
        />
        <p className="mt-2 text-xs text-slate-500">Click anywhere on the map to set a vehicle location.</p>
      </div>

      <div className="space-y-4">
        <form onSubmit={submit} className={`${cardCls} space-y-3`}>
          <h2 className="font-semibold">Update vehicle location</h2>
          <Field label="Vehicle">
            <select className={inputCls} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Select a vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicle_number} ({v.driver_name})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Latitude">
              <input className={inputCls} type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
            </Field>
            <Field label="Longitude">
              <input className={inputCls} type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} />
            </Field>
          </div>
          <Field label="Time">
            <input className={inputCls} type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <button className={`${btnCls} w-full`} disabled={saving}>
            {saving ? 'Updating…' : 'Update location'}
          </button>
          <Notice message={message} />
        </form>

        <AlertFeed limit={5} />
      </div>
    </div>
  )
}