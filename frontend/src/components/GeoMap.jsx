import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { CATEGORIES, DEFAULT_CENTER } from '../constants'

function ClickHandler({ onClick }) {
  useMapEvents({
    click: (e) => onClick?.(e.latlng.lat, e.latlng.lng),
  })
  return null
}

function Recenter({ focus }) {
  const map = useMap()
  const lat = focus?.[0]
  const lng = focus?.[1]

  useEffect(() => {
    if (lat != null && lng != null) map.setView([lat, lng], map.getZoom())
  }, [lat, lng, map])

  return null
}

export default function GeoMap({
  geofences = [],
  vehicles = [],
  draft = [],
  picked = null,
  focus = null,
  onMapClick,
  className = 'h-[28rem]',
}) {
  return (
    <MapContainer
      center={focus ?? DEFAULT_CENTER}
      zoom={13}
      className={`${className} z-0 w-full rounded-xl border border-slate-200`}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onMapClick} />
      <Recenter focus={focus} />

      {geofences.map((g) => {
        const color = CATEGORIES[g.category]?.color ?? '#64748b'
        return (
          <Polygon key={g.id} positions={g.coordinates} pathOptions={{ color, fillColor: color, fillOpacity: 0.2 }}>
            <Tooltip sticky>{g.name}</Tooltip>
          </Polygon>
        )
      })}

      {vehicles
        .filter((v) => v.location)
        .map((v) => (
          <CircleMarker
            key={v.id}
            center={[v.location.latitude, v.location.longitude]}
            radius={9}
            pathOptions={{ color: '#1e293b', fillColor: '#f59e0b', fillOpacity: 1 }}
          >
            <Tooltip>
              {v.vehicle_number} · {v.driver_name}
            </Tooltip>
          </CircleMarker>
        ))}

      {draft.length > 0 && (
        <>
          <Polyline positions={draft} pathOptions={{ color: '#7c3aed', dashArray: '6' }} />
          {draft.map((p, i) => (
            <CircleMarker key={i} center={p} radius={4} pathOptions={{ color: '#7c3aed', fillOpacity: 1 }} />
          ))}
        </>
      )}

      {picked && (
        <CircleMarker center={picked} radius={7} pathOptions={{ color: '#7c3aed', fillColor: '#c4b5fd', fillOpacity: 1 }} />
      )}
    </MapContainer>
  )
}