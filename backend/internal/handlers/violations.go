package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"geofence-backend/internal/models"
)

func (h *Handler) ViolationHistory(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	ctx := r.Context()
	q := r.URL.Query()

	var conds []string
	var args []any
	add := func(cond string, value any) {
		args = append(args, value)
		conds = append(conds, fmt.Sprintf(cond, len(args)))
	}

	if v := q.Get("vehicle_id"); v != "" {
		add("v.vehicle_id = $%d", v)
	}
	if g := q.Get("geofence_id"); g != "" {
		add("v.geofence_id = $%d", g)
	}
	if raw := q.Get("start_date"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, start, "start_date must be ISO 8601, e.g. 2025-01-01T00:00:00Z")
			return
		}
		add("v.event_time >= $%d", t)
	}
	if raw := q.Get("end_date"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, start, "end_date must be ISO 8601, e.g. 2025-01-31T23:59:59Z")
			return
		}
		add("v.event_time <= $%d", t)
	}

	limit := 50
	if raw := q.Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 {
			writeError(w, http.StatusBadRequest, start, "limit must be a positive number")
			return
		}
		limit = min(n, 500)
	}
	offset := 0
	if raw := q.Get("offset"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 0 {
			writeError(w, http.StatusBadRequest, start, "offset must be zero or more")
			return
		}
		offset = n
	}

	where := ""
	if len(conds) > 0 {
		where = " WHERE " + strings.Join(conds, " AND ")
	}

	var total int
	if err := h.db.QueryRow(ctx, "SELECT COUNT(*) FROM violations v"+where, args...).Scan(&total); err != nil {
		serverError(w, start, err, "could not count history")
		return
	}

	pageArgs := append(append([]any{}, args...), limit, offset)
	rows, err := h.db.Query(ctx,
		`SELECT v.id, v.vehicle_id, ve.vehicle_number, v.geofence_id, g.name,
		        v.event_type, v.latitude, v.longitude, v.event_time
		 FROM violations v
		 JOIN vehicles ve ON ve.id = v.vehicle_id
		 JOIN geofences g ON g.id = v.geofence_id`+where+
			fmt.Sprintf(" ORDER BY v.event_time DESC LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2),
		pageArgs...,
	)
	if err != nil {
		serverError(w, start, err, "could not load history")
		return
	}
	defer rows.Close()

	violations := []models.Violation{}
	for rows.Next() {
		var v models.Violation
		if err := rows.Scan(&v.ID, &v.VehicleID, &v.VehicleNumber, &v.GeofenceID, &v.GeofenceName,
			&v.EventType, &v.Latitude, &v.Longitude, &v.Timestamp); err != nil {
			serverError(w, start, err, "could not read history")
			return
		}
		violations = append(violations, v)
	}
	if err := rows.Err(); err != nil {
		serverError(w, start, err, "could not read history")
		return
	}

	writeJSON(w, http.StatusOK, start, map[string]any{
		"violations": violations,
		"total_count": total,
	})
}