export const CATEGORIES = {
  delivery_zone: { label: 'Delivery zone', color: '#2563eb' },
  restricted_zone: { label: 'Restricted zone', color: '#dc2626' },
  toll_zone: { label: 'Toll zone', color: '#d97706' },
  customer_area: { label: 'Customer area', color: '#16a34a' },
}

export const DEFAULT_CENTER = [28.6139, 77.2090]

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
export const btnCls =
  'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
export const cardCls = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'

export const formatTime = (iso) => new Date(iso).toLocaleString()

// value for <input type="datetime-local"> in the user's own timezone
export const toLocalInput = (date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)