# Geofence Tracker

A small app to draw zones on a map, track vehicles, and get a live alert when a vehicle enters or leaves a zone.

# Tech Stack
Backend: Go
Database: PostgreSQL with PostGIS for storing and handling location data.
Frontend: React and Tailwind CSS
Maps: Leaflet with OpenStreetMap
Real-time alerts: WebSocket (/ws/alerts)

## What you need

- Go 1.22 or newer
- Node.js 20 or newer
- PostgreSQL with the PostGIS extension (or a free Neon database, PostGIS is already available there)
- Docker (only if you want to use docker compose)

## Run it locally

### 1. Database
Make an empty database called `geofence`. The app creates all the tables itself when it starts.
If you use your own Postgres, PostGIS must be installed.

### 2. Backend
Go to the `backend` folder and make a `.env` file:
```
PORT=8080
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/geofence
ALLOWED_ORIGINS=http://localhost:5173
```

Then:
```
cd backend
go mod tidy
go run ./cmd/server
```

Check it: open http://localhost:8080/health. You should see `{"status":"ok", ...}`.

### 3. Frontend
Make `frontend/.env`:

```
VITE_API_URL=http://localhost:8080
```
Then:

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Run with Docker Compose

From the main folder:
```
docker compose up --build
```
This starts a PostGIS database (on port 5433) and the backend (on port 8080). The frontend is still run with `npm run dev`.

## Testing the API with curl

These work in Git Bash, Mac and Linux. In Windows PowerShell, use `curl.exe` instead of `curl` and put the JSON in a file (`-d "@body.json"`), because PowerShell messes up the quotes.

Every response has a `time_ns` field (how long the request took, in nanoseconds).

**1. Create a geofence**

```
curl -X POST http://localhost:8080/geofences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Connaught Place Restricted Zone",
    "description": "No trucks allowed here",
    "category": "restricted_zone",
    "coordinates": [
      [28.6280, 77.2060],
      [28.6280, 77.2200],
      [28.6350, 77.2200],
      [28.6350, 77.2060],
      [28.6280, 77.2060]
    ]
  }'
```

Copy the `id` from the response (like `geo_ab12cd34ef56`).

**2. List geofences** (the category filter is optional)

```
curl http://localhost:8080/geofences
curl "http://localhost:8080/geofences?category=restricted_zone"
```

**3. Register a vehicle**

```
curl -X POST http://localhost:8080/vehicles \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_number": "DL-01-AB-1234",
    "driver_name": "Rahul Sharma",
    "vehicle_type": "truck",
    "phone": "+919876543210"
  }'
```

Copy the vehicle `id` (like `veh_ab12cd34ef56`).

**4. List vehicles**

```
curl http://localhost:8080/vehicles
```

**5. Set up an alert rule**

Leave out `vehicle_id` if you want the rule to work for all vehicles. `event_type` can be `entry`, `exit` or `both`.

```
curl -X POST http://localhost:8080/alerts/configure \
  -H "Content-Type: application/json" \
  -d '{
    "geofence_id": "GEOFENCE_ID",
    "vehicle_id": "VEHICLE_ID",
    "event_type": "both"
  }'
```

**6. List alert rules**

```
curl http://localhost:8080/alerts
curl "http://localhost:8080/alerts?geofence_id=GEOFENCE_ID"
```

**7. Send a vehicle location**

This point is inside the Connaught Place zone from step 1, so it counts as an entry:

```
curl -X POST http://localhost:8080/vehicles/location \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "VEHICLE_ID",
    "latitude": 28.6315,
    "longitude": 77.2130,
    "timestamp": "2026-11-11T10:35:00Z"
  }'
```

Now send a point outside the zone to cause an exit:

```
curl -X POST http://localhost:8080/vehicles/location \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "VEHICLE_ID",
    "latitude": 28.5500,
    "longitude": 77.2500,
    "timestamp": "2026-11-11T10:40:00Z"
  }'
```

**8. Get a vehicle's current location**

```
curl http://localhost:8080/vehicles/location/VEHICLE_ID
```

**9. Violation history**

All filters are optional. `limit` is 50 by default and 500 at most. `offset` is for paging.

```
curl "http://localhost:8080/violations/history?vehicle_id=VEHICLE_ID&limit=20"
curl "http://localhost:8080/violations/history?start_date=2026-01-01T00:00:00Z&end_date=2026-12-31T23:59:59Z"
```

### Testing the live alerts

Before step 7, either keep the website open (any page) or run this in another terminal:

```
npx wscat -c ws://localhost:8080/ws/alerts
```

When you send the location, the alert shows up right away. It only appears if an alert rule matches (step 5).

## Using the website

- **Dashboard**: the map with all zones and vehicles. Click on the map to fill in a location, pick a vehicle and press "Update location". The live alerts feed is on the right.
- **Geofences**: click on the map to add the corners of a new zone, or type latitude and longitude and press Add. Fill the name, description and category, then create it. The list on the right can be filtered by category.
- **Vehicles**: register a new vehicle and see where each one is and which zones it is inside.
- **Alerts**: make alert rules (zone, optional vehicle, entry/exit/both) and see all existing rules.
- **History**: past entry and exit events. Filter by vehicle, zone and dates. Use Previous and Next to move between pages.
- **Live alerts**: a small box pops up in the top right when an alert comes in. The "Live" dot in the top bar shows the connection is working. If the connection drops, it reconnects on its own.

## Deploying

- Backend on Render: create a Web Service from the `backend` folder using its Dockerfile. Add the env vars `DATABASE_URL` (your Neon connection string) and `ALLOWED_ORIGINS` (your Vercel URL).
- Frontend on Vercel: set the root folder to `frontend` and add the env var `VITE_API_URL` with your Render URL.