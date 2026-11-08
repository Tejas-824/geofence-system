import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import GeoMap from '../components/GeoMap'
import { CategoryBadge, Field, Loading, Notice } from '../components/ui'
import { btnCls, CATEGORIES, cardCls, inputCls } from '../constants'

const emptyForm = { name: '', description: '', category: 'delivery_zone' }

export default function Geofences() {
  const [geofences, setGeofences] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [points, setPoints] = useState([])
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [focus, setFocus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getGeofences(filter)
      setGeofences(data.geofences)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const addPoint = (lat, lng) => {
    setPoints((prev) => [...prev, [Number(lat.toFixed(6)), Number(lng.toFixed(6))]])
  }

  const addManualPoint = () => {
    const lat = Number(manualLat)
    const lng = Number(manualLng)
    if (manualLat === '' || manualLng === '' || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return setMessage({ type: 'error', text: 'Enter a latitude (-90 to 90) and longitude (-180 to 180).' })
    }
    addPoint(lat, lng)
    setManualLat('')
    setManualLng('')
    setMessage(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setMessage({ type: 'error', text: 'Give the geofence a name.' })
    if (points.length < 3) return setMessage({ type: 'error', text: 'Add at least 3 points on the map.' })

    setSaving(true)
    setMessage(null)
    try {
      // the backend wants a closed polygon, so repeat the first point at the end
      await api.createGeofence({ ...form, coordinates: [...points, points[0]] })
      setFocus(points[0])
      setForm(emptyForm)
      setPoints([])
      setMessage({ type: 'success', text: 'Geofence created.' })
      await load()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <GeoMap geofences={geofences} draft={points} focus={focus} onMapClick={addPoint} className="h-[32rem]" />
        <p className="mt-2 text-xs text-slate-500">Click the map to add points to the new geofence (purple line).</p>
      </div>

      <div className="space-y-4">
        <form onSubmit={submit} className={`${cardCls} space-y-3`}>
          <h2 className="font-semibold">New geofence</h2>
          <Field label="Name">
            <input className={inputCls} value={form.name} onChange={setField('name')} placeholder="Downtown Delivery Zone" />
          </Field>
          <Field label="Description">
            <input className={inputCls} value={form.description} onChange={setField('description')} />
          </Field>
          <Field label="Category">
            <select className={inputCls} value={form.category} onChange={setField('category')}>
              {Object.entries(CATEGORIES).map(([value, c]) => (
                <option key={value} value={value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <p className="mb-1 text-sm font-medium text-slate-600">Points ({points.length})</p>
            <div className="flex gap-2">
              <input className={inputCls} type="number" step="any" placeholder="Lat" value={manualLat} onChange={(e) => setManualLat(e.target.value)} />
              <input className={inputCls} type="number" step="any" placeholder="Lng" value={manualLng} onChange={(e) => setManualLng(e.target.value)} />
              <button type="button" onClick={addManualPoint} className="rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50">
                Add
              </button>
            </div>
            <div className="mt-2 flex gap-3 text-xs">
              <button type="button" onClick={() => setPoints((p) => p.slice(0, -1))} disabled={!points.length} className="text-blue-600 disabled:text-slate-400">
                Undo last point
              </button>
              <button type="button" onClick={() => setPoints([])} disabled={!points.length} className="text-red-600 disabled:text-slate-400">
                Clear
              </button>
            </div>
          </div>

          <button className={`${btnCls} w-full`} disabled={saving}>
            {saving ? 'Saving…' : 'Create geofence'}
          </button>
          <Notice message={message} />
        </form>

        <div className={cardCls}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">All geofences</h2>
            <select className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All categories</option>
              {Object.entries(CATEGORIES).map(([value, c]) => (
                <option key={value} value={value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <Loading />
          ) : geofences.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No geofences yet.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {geofences.map((g) => (
                <li key={g.id}>
                  <button onClick={() => setFocus(g.coordinates[0])} className="w-full rounded-lg border border-slate-200 p-2 text-left text-sm hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{g.name}</span>
                      <CategoryBadge category={g.category} />
                    </div>
                    {g.description && <p className="text-xs text-slate-500">{g.description}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}