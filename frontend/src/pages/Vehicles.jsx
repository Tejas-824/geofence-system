import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { Field, Loading, Notice } from '../components/ui'
import { btnCls, cardCls, formatTime, inputCls } from '../constants'

const emptyForm = { vehicle_number: '', driver_name: '', vehicle_type: 'truck', phone: '' }
const VEHICLE_TYPES = ['truck', 'car', 'van', 'motorcycle']

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { vehicles: list } = await api.getVehicles()
      const withStatus = await Promise.all(
        list.map(async (v) => {
          try {
            const s = await api.getVehicleLocation(v.id)
            return { ...v, location: s.current_location, geofences: s.current_geofences }
          } catch {
            return { ...v, location: null, geofences: [] }
          }
        }),
      )
      setVehicles(withStatus)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await api.createVehicle(form)
      setForm(emptyForm)
      setMessage({ type: 'success', text: 'Vehicle registered.' })
      await load()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form onSubmit={submit} className={`${cardCls} h-fit space-y-3`}>
        <h2 className="font-semibold">Register vehicle</h2>
        <Field label="Vehicle number">
          <input className={inputCls} value={form.vehicle_number} onChange={setField('vehicle_number')} placeholder="KA-01-AB-1234" required />
        </Field>
        <Field label="Driver name">
          <input className={inputCls} value={form.driver_name} onChange={setField('driver_name')} required />
        </Field>
        <Field label="Vehicle type">
          <select className={inputCls} value={form.vehicle_type} onChange={setField('vehicle_type')}>
            {VEHICLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Phone">
          <input className={inputCls} value={form.phone} onChange={setField('phone')} placeholder="+1234567890" required />
        </Field>
        <button className={`${btnCls} w-full`} disabled={saving}>
          {saving ? 'Saving…' : 'Register vehicle'}
        </button>
        <Notice message={message} />
      </form>

      <div className={`${cardCls} lg:col-span-2`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Vehicles</h2>
          <button onClick={load} className="text-sm text-blue-600 hover:underline">
            Refresh
          </button>
        </div>

        {loading ? (
          <Loading />
        ) : vehicles.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No vehicles registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Vehicle</th>
                  <th className="pr-3">Driver</th>
                  <th className="pr-3">Last location</th>
                  <th>Inside</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{v.vehicle_number}</p>
                      <p className="text-xs text-slate-500">{v.vehicle_type}</p>
                    </td>
                    <td className="pr-3">
                      {v.driver_name}
                      <p className="text-xs text-slate-500">{v.phone}</p>
                    </td>
                    <td className="pr-3">
                      {v.location ? (
                        <>
                          {v.location.latitude.toFixed(5)}, {v.location.longitude.toFixed(5)}
                          <p className="text-xs text-slate-500">{formatTime(v.location.timestamp)}</p>
                        </>
                      ) : (
                        <span className="text-slate-400">No location yet</span>
                      )}
                    </td>
                    <td>
                      {v.geofences.length ? (
                        v.geofences.map((g) => (
                          <span key={g.geofence_id} className="mr-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs">
                            {g.geofence_name}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}