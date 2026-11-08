CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS geofences (
id TEXT PRIMARY KEY,
name TEXT NOT NULL,
description TEXT NOT NULL DEFAULT '',
category TEXT NOT NULL CHECK (category IN ('delivery_zone', 'restricted_zone', 'toll_zone', 'customer_area')),
coordinates JSONB NOT NULL,
boundary geometry(Polygon, 4326) NOT NULL,
status TEXT NOT NULL DEFAULT 'active',
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofences_boundary ON geofences USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_geofences_category ON geofences (category);
CREATE TABLE IF NOT EXISTS vehicles (
id TEXT PRIMARY KEY,
vehicle_number TEXT NOT NULL UNIQUE,
driver_name TEXT NOT NULL,
vehicle_type TEXT NOT NULL,
phone TEXT NOT NULL,
status TEXT NOT NULL DEFAULT 'active',
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_locations (
id BIGSERIAL PRIMARY KEY,
vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
latitude DOUBLE PRECISION NOT NULL,
longitude DOUBLE PRECISION NOT NULL,
recorded_at TIMESTAMPTZ NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_vehicle_time ON vehicle_locations (vehicle_id, recorded_at DESC);
-- which geofences a vehicle is inside right now (used to spot entry/exit)
CREATE TABLE IF NOT EXISTS vehicle_geofence_state (
vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
geofence_id TEXT NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
PRIMARY KEY (vehicle_id, geofence_id)
);

CREATE TABLE IF NOT EXISTS alert_rules (
id TEXT PRIMARY KEY,
geofence_id TEXT NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
vehicle_id TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
event_type TEXT NOT NULL CHECK (event_type IN ('entry', 'exit', 'both')),
status TEXT NOT NULL DEFAULT 'active',
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_geofence ON alert_rules (geofence_id);
-- every entry/exit event; "alerted" says whether a rule matched and an alert went out
CREATE TABLE IF NOT EXISTS violations (
id TEXT PRIMARY KEY,
vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
geofence_id TEXT NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
event_type TEXT NOT NULL CHECK (event_type IN ('entry', 'exit')),
latitude DOUBLE PRECISION NOT NULL,
longitude DOUBLE PRECISION NOT NULL,
event_time TIMESTAMPTZ NOT NULL,
alerted BOOLEAN NOT NULL DEFAULT false,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_violations_vehicle_time ON violations (vehicle_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_violations_geofence_time ON violations (geofence_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_violations_time ON violations (event_time DESC);