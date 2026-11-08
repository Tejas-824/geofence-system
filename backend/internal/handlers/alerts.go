package handlers

import (
	"net/http"
	"time"

	"geofence-backend/internal/models"
)

var validEventTypes = map[string]bool{"entry": true, "exit": true, "both": true}

type configureAlertRequest struct {
	GeofenceID string `json:"geofence_id"`
	VehicleID string `json:"vehicle_id"`
	EventType string `json:"event_type"`
}

func (h *Handler) ConfigureAlert(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req configureAlertRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, start, err.Error())
		return
	}
	if req.GeofenceID == "" {
		writeError(w, http.StatusBadRequest, start, "geofence_id is required")
		return
	}
	if !validEventTypes[req.EventType] {
		writeError(w, http.StatusBadRequest, start, "event_type must be one of: entry, exit, both")
		return
	}

	// no vehicle_id means the rule applies to every vehicle
	var vehicleID any
	if req.VehicleID != "" {
		vehicleID = req.VehicleID
	}

	id := newID("alert")
	_, err := h.db.Exec(r.Context(),
		`INSERT INTO alert_rules (id, geofence_id, vehicle_id, event_type) VALUES ($1, $2, $3, $4)`,
		id, req.GeofenceID, vehicleID, req.EventType,
	)
	if isForeignKeyViolation(err) {
		writeError(w, http.StatusNotFound, start, "geofence or vehicle not found")
		return
	}
	if err != nil {
		serverError(w, start, err, "could not save alert rule")
		return
	}

	writeJSON(w, http.StatusCreated, start, map[string]any{
		"alert_id": id,
		"geofence_id": req.GeofenceID,
		"vehicle_id": vehicleID,
		"event_type": req.EventType,
		"status": "active",
	})
}

func (h *Handler) ListAlerts(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	q := r.URL.Query()

	rows, err := h.db.Query(r.Context(),
		`SELECT a.id, a.geofence_id, g.name, a.vehicle_id, v.vehicle_number, a.event_type, a.status, a.created_at
		 FROM alert_rules a
		 JOIN geofences g ON g.id = a.geofence_id
		 LEFT JOIN vehicles v ON v.id = a.vehicle_id
		 WHERE ($1 = '' OR a.geofence_id = $1)
		   AND ($2 = '' OR a.vehicle_id = $2)
		 ORDER BY a.created_at DESC`,
		q.Get("geofence_id"), q.Get("vehicle_id"),
	)
	if err != nil {
		serverError(w, start, err, "could not load alerts")
		return
	}
	defer rows.Close()

	alerts := []models.AlertRule{}
	for rows.Next() {
		var a models.AlertRule
		if err := rows.Scan(&a.AlertID, &a.GeofenceID, &a.GeofenceName, &a.VehicleID, &a.VehicleNumber, &a.EventType, &a.Status, &a.CreatedAt); err != nil {
			serverError(w, start, err, "could not read alerts")
			return
		}
		alerts = append(alerts, a)
	}
	if err := rows.Err(); err != nil {
		serverError(w, start, err, "could not read alerts")
		return
	}

	writeJSON(w, http.StatusOK, start, map[string]any{"alerts": alerts})
}