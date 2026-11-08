import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Field, Loading, Notice } from '../components/ui'
import { btnCls, cardCls, formatTime, inputCls } from '../constants'

const PAGE_SIZE = 10
const emptyFilters = { vehicle_id: '', geofence_id: '', start: '', end: '' }

export default function History() {
  const [vehicles, setVehicles] = useState([])
  const [geofences, setGeofences] = useState([])
  const [form, setForm] = useState(emptyFilters)
  const [applied, setApplied] = useState(emptyFilters)
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    Promise.all([api.getVehicles(), api.getGeofences()])
      .then(([v, g]) => {
        setVehicles(v.vehicles)
        setGeofences(g.geofences)
      })
      .catch((err) => setMessage({ type: 'error', text: err.message }))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    api
      .getHistory({
        vehicle_id: applied.vehicle_id,
        geofence_id: applied.geofence_id,
        start_date: applied.start ? new Date(applied.start).toISOString() : '',
        end_date: applied.end ? new Date(applied.end).toISOString() : '',
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      .then((data) => {
        if (cancelled) return
        setRows(data.violations)
        setTotal(data.total_count)
        setMessage(null)
      })
      .catch((err) => !cancelled && setMessage({ type: 'error', text: err.message }))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [applied, page])

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const apply = (e) => {
    e.preventDefault()
    setPage(0)
    setApplied(form)
  }

  const reset = () => {
    setForm(emptyFilters)
    setApplied(emptyFilters)
    setPage(0)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <form onSubmit={apply} className={`${cardCls} grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end`}>
        <Field label="Vehicle">
          <select className={inputCls} value={form.vehicle_id} onChange={setField('vehicle_id')}>
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vehicle_number}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Geofence">
          <select className={inputCls} value={form.geofence_id} onChange={setField('geofence_id')}>
            <option value="">All geofences</option>
            {geofences.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input className={inputCls} type="datetime-local" value={form.start} onChange={setField('start')} />
        </Field>
        <Field label="To">
          <input className={inputCls} type="datetime-local" value={form.end} onChange={setField('end')} />
        </Field>
        <div className="flex gap-2">
          <button className={btnCls}>Apply</button>
          <button type="button" onClick={reset} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Reset
          </button>
        </div>
      </form>

      <Notice message={message} />

      <div className={cardCls}>
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No events found for these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Time</th>
                  <th className="pr-3">Vehicle</th>
                  <th className="pr-3">Geofence</th>
                  <th className="pr-3">Event</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{formatTime(r.timestamp)}</td>
                    <td className="pr-3 font-medium">{r.vehicle_number}</td>
                    <td className="pr-3">{r.geofence_name}</td>
                    <td className="pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.event_type === 'entry' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {r.event_type}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">
                      {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">{total} events</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 0} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
              Previous
            </button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}