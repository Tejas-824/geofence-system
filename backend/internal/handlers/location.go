package handlers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"geofence-backend/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

var errVehicleNotFound = errors.New("vehicle not found")

type updateLocationRequest struct {
	VehicleID string `json:"vehicle_id"`
	Latitude *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
	Timestamp string `json:"timestamp"`
}

type locationResult struct {
	current []models.GeofenceRef
	alerts []models.AlertEvent
}

type insideGeofence struct {
	models.GeofenceRef
	Status string `json:"status"`
}

type currentLocation struct {
	Latitude float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Timestamp time.Time `json:"timestamp"`
}

// anything we can run a Query on: a pool or a transaction
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func (h *Handler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	req, ts, err := parseLocationRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, start, err.Error())
		return
	}

	result, err := h.applyLocation(r.Context(), req, ts)
	if errors.Is(err, errVehicleNotFound) {
		writeError(w, http.StatusNotFound, start, "vehicle not found")
		return
	}
	if err != nil {
		serverError(w, start, err, "could not update location")
		return
	}

	// alerts go out in the background so the response never waits on websocket clients
	for _, alert := range result.alerts {
		go h.hub.Broadcast(alert)
	}

	inside := make([]insideGeofence, 0, len(result.current))
	for _, g := range result.current {
		inside = append(inside, insideGeofence{GeofenceRef: g, Status: "inside"})
	}

	writeJSON(w, http.StatusOK, start, map[string]any{
		"vehicle_id": req.VehicleID,
		"location_updated": true,
		"current_geofences": inside,
	})
}

func parseLocationRequest(r *http.Request) (updateLocationRequest, time.Time, error) {
	var req updateLocationRequest
	if err := decodeJSON(r, &req); err != nil {
		return req, time.Time{}, err
	}
	if req.VehicleID == "" {
		return req, time.Time{}, errors.New("vehicle_id is required")
	}
	if req.Latitude == nil || *req.Latitude < -90 || *req.Latitude > 90 {
		return req, time.Time{}, errors.New("latitude is required and must be between -90 and 90")
	}
	if req.Longitude == nil || *req.Longitude < -180 || *req.Longitude > 180 {
		return req, time.Time{}, errors.New("longitude is required and must be between -180 and 180")
	}
	ts, err := time.Parse(time.RFC3339, req.Timestamp)
	if err != nil {
		return req, time.Time{}, errors.New("timestamp must be ISO 8601, e.g. 2025-01-15T10:35:00Z")
	}
	return req, ts.UTC(), nil
}

// applyLocation does all the database work in one transaction. The vehicle row is
// locked, so two updates for the same vehicle can't fire duplicate events.
func (h *Handler) applyLocation(ctx context.Context, req updateLocationRequest, ts time.Time) (*locationResult, error) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var vehicle models.AlertVehicle
	err = tx.QueryRow(ctx,
		`SELECT id, vehicle_number, driver_name FROM vehicles WHERE id = $1 FOR UPDATE`,
		req.VehicleID,
	).Scan(&vehicle.VehicleID, &vehicle.VehicleNumber, &vehicle.DriverName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errVehicleNotFound
	}
	if err != nil {
		return nil, err
	}

	lat, lng := *req.Latitude, *req.Longitude

	if _, err := tx.Exec(ctx,
		`INSERT INTO vehicle_locations (vehicle_id, latitude, longitude, recorded_at) VALUES ($1, $2, $3, $4)`,
		vehicle.VehicleID, lat, lng, ts,
	); err != nil {
		return nil, err
	}

	previous, err := geofencesFromState(ctx, tx, vehicle.VehicleID)
	if err != nil {
		return nil, err
	}
	current, err := geofencesContaining(ctx, tx, lat, lng)
	if err != nil {
		return nil, err
	}

	entered, exited := diffGeofences(previous, current)
	alerts := []models.AlertEvent{}

	for _, g := range exited {
		if _, err := tx.Exec(ctx,
			`DELETE FROM vehicle_geofence_state WHERE vehicle_id = $1 AND geofence_id = $2`,
			vehicle.VehicleID, g.ID,
		); err != nil {
			return nil, err
		}
		alert, err := recordEvent(ctx, tx, vehicle, g, "exit", lat, lng, ts)
		if err != nil {
			return nil, err
		}
		if alert != nil {
			alerts = append(alerts, *alert)
		}
	}

	for _, g := range entered {
		if _, err := tx.Exec(ctx,
			`INSERT INTO vehicle_geofence_state (vehicle_id, geofence_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			vehicle.VehicleID, g.ID,
		); err != nil {
			return nil, err
		}
		alert, err := recordEvent(ctx, tx, vehicle, g, "entry", lat, lng, ts)
		if err != nil {
			return nil, err
		}
		if alert != nil {
			alerts = append(alerts, *alert)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &locationResult{current: current, alerts: alerts}, nil
}

// recordEvent saves the entry/exit event. It returns an alert only if a rule matches.
func recordEvent(ctx context.Context, tx pgx.Tx, vehicle models.AlertVehicle, g models.GeofenceRef, eventType string, lat, lng float64, ts time.Time) (*models.AlertEvent, error) {
	var alerted bool
	err := tx.QueryRow(ctx,
		`SELECT EXISTS (
			SELECT 1 FROM alert_rules
			WHERE status = 'active'
			  AND geofence_id = $1
			  AND (vehicle_id IS NULL OR vehicle_id = $2)
			  AND event_type IN ($3, 'both')
		)`,
		g.ID, vehicle.VehicleID, eventType,
	).Scan(&alerted)
	if err != nil {
		return nil, err
	}

	eventID := newID("viol")
	if _, err := tx.Exec(ctx,
		`INSERT INTO violations (id, vehicle_id, geofence_id, event_type, latitude, longitude, event_time, alerted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		eventID, vehicle.VehicleID, g.ID, eventType, lat, lng, ts, alerted,
	); err != nil {
		return nil, err
	}

	if !alerted {
		return nil, nil
	}
	return &models.AlertEvent{
		EventID: eventID,
		EventType: eventType,
		Timestamp: ts,
		Vehicle: vehicle,
		Geofence: g,
		Location: models.LatLng{Latitude: lat, Longitude: lng},
	}, nil
}

func diffGeofences(previous, current []models.GeofenceRef) (entered, exited []models.GeofenceRef) {
	prevSet := idSet(previous)
	currSet := idSet(current)

	for _, g := range current {
		if !prevSet[g.ID] {
			entered = append(entered, g)
		}
	}
	for _, g := range previous {
		if !currSet[g.ID] {
			exited = append(exited, g)
		}
	}
	return entered, exited
}

func idSet(refs []models.GeofenceRef) map[string]bool {
	set := make(map[string]bool, len(refs))
	for _, g := range refs {
		set[g.ID] = true
	}
	return set
}

// geofencesContaining is the point-in-polygon check, done by PostGIS with the spatial index.
func geofencesContaining(ctx context.Context, q querier, lat, lng float64) ([]models.GeofenceRef, error) {
	return queryRefs(ctx, q,
		`SELECT id, name, category FROM geofences
		 WHERE status = 'active'
		   AND ST_Covers(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
		 ORDER BY name`,
		lng, lat,
	)
}

func geofencesFromState(ctx context.Context, q querier, vehicleID string) ([]models.GeofenceRef, error) {
	return queryRefs(ctx, q,
		`SELECT g.id, g.name, g.category
		 FROM vehicle_geofence_state s
		 JOIN geofences g ON g.id = s.geofence_id
		 WHERE s.vehicle_id = $1
		 ORDER BY g.name`,
		vehicleID,
	)
}

func queryRefs(ctx context.Context, q querier, sql string, args ...any) ([]models.GeofenceRef, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	refs := []models.GeofenceRef{}
	for rows.Next() {
		var g models.GeofenceRef
		if err := rows.Scan(&g.ID, &g.Name, &g.Category); err != nil {
			return nil, err
		}
		refs = append(refs, g)
	}
	return refs, rows.Err()
}

func (h *Handler) GetVehicleLocation(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	ctx := r.Context()
	vehicleID := chi.URLParam(r, "vehicle_id")

	var vehicleNumber string
	err := h.db.QueryRow(ctx, `SELECT vehicle_number FROM vehicles WHERE id = $1`, vehicleID).Scan(&vehicleNumber)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, start, "vehicle not found")
		return
	}
	if err != nil {
		serverError(w, start, err, "could not load vehicle")
		return
	}

	// stays nil (JSON null) if the vehicle has never sent a location
	var location *currentLocation
	var l currentLocation
	err = h.db.QueryRow(ctx,
		`SELECT latitude, longitude, recorded_at FROM vehicle_locations
		 WHERE vehicle_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
		vehicleID,
	).Scan(&l.Latitude, &l.Longitude, &l.Timestamp)
	switch {
	case err == nil:
		location = &l
	case errors.Is(err, pgx.ErrNoRows):
	default:
		serverError(w, start, err, "could not load location")
		return
	}

	geofences, err := geofencesFromState(ctx, h.db, vehicleID)
	if err != nil {
		serverError(w, start, err, "could not load geofence status")
		return
	}

	writeJSON(w, http.StatusOK, start, map[string]any{
		"vehicle_id": vehicleID,
		"vehicle_number": vehicleNumber,
		"current_location": location,
		"current_geofences": geofences,
	})
}