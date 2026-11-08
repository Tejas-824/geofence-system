import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import AlertFeed from '../components/AlertFeed'
import { Field, Loading, Notice } from '../components/ui'
import { btnCls, cardCls, formatTime, inputCls } from '../constants'

const emptyForm = { geofence_id: '', vehicle_id: '', event_type: 'entry' }

export default function Alerts() {
  const [geofences, setGeofences] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    try {
      const [g, v, a] = await Promise.all([api.getGeofences(), api.getVehicles(), api.getAlerts()])
      setGeofences(g.geofences)
      setVehicles(v.vehicles)
      setRules(a.alerts)
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
    if (!form.geofence_id) return setMessage({ type: 'error', text: 'Pick a geofence.' })

    setSaving(true)
    setMessage(null)
    try {
      await api.configureAlert(form)
      setForm(emptyForm)
      setMessage({ type: 'success', text: 'Alert rule saved.' })
      await load()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4">
        <form onSubmit={submit} className={`${cardCls} space-y-3`}>
          <h2 className="font-semibold">New alert rule</h2>
          <Field label="Geofence">
            <select className={inputCls} value={form.geofence_id} onChange={setField('geofence_id')}>
              <option value="">Select a geofence</option>
              {geofences.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vehicle (optional)">
            <select className={inputCls} value={form.vehicle_id} onChange={setField('vehicle_id')}>
              <option value="">All vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicle_number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Alert on">
            <select className={inputCls} value={form.event_type} onChange={setField('event_type')}>
              <option value="entry">Entry</option>
              <option value="exit">Exit</option>
              <option value="both">Entry and exit</option>
            </select>
          </Field>
          <button className={`${btnCls} w-full`} disabled={saving}>
            {saving ? 'Saving…' : 'Save rule'}
          </button>
          <Notice message={message} />
        </form>

        <AlertFeed limit={8} />
      </div>

      <div className={`${cardCls} h-fit lg:col-span-2`}>
        <h2 className="mb-3 font-semibold">Configured rules</h2>
        {rules.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No rules yet. Create one to start getting alerts.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Geofence</th>
                  <th className="pr-3">Vehicle</th>
                  <th className="pr-3">Event</th>
                  <th className="pr-3">Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.alert_id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium">{r.geofence_name}</td>
                    <td className="pr-3">{r.vehicle_number ?? 'All vehicles'}</td>
                    <td className="pr-3 capitalize">{r.event_type}</td>
                    <td className="pr-3 capitalize">{r.status}</td>
                    <td className="text-xs text-slate-500">{formatTime(r.created_at)}</td>
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