package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"geofence-backend/internal/models"
)

var validCategories = map[string]bool{
	"delivery_zone": true,
	"restricted_zone": true,
	"toll_zone": true,
	"customer_area": true,
}

type createGeofenceRequest struct {
	Name string `json:"name"`
	Description string `json:"description"`
	Coordinates [][]float64 `json:"coordinates"`
	Category string `json:"category"`
}

func validateCoordinates(coords [][]float64) error {
	if len(coords) < 4 {
		return errors.New("a polygon needs at least 4 points (3 unique + the closing point)")
	}
	for i, p := range coords {
		if len(p) != 2 {
			return fmt.Errorf("point %d must be [latitude, longitude]", i+1)
		}
		if p[0] < -90 || p[0] > 90 {
			return fmt.Errorf("point %d: latitude must be between -90 and 90", i+1)
		}
		if p[1] < -180 || p[1] > 180 {
			return fmt.Errorf("point %d: longitude must be between -180 and 180", i+1)
		}
	}
	first, last := coords[0], coords[len(coords)-1]
	if first[0] != last[0] || first[1] != last[1] {
		return errors.New("first and last coordinates must be the same (polygon must be closed)")
	}
	return nil
}

// polygonWKT turns [lat, lng] pairs into PostGIS text. PostGIS wants longitude first.
func polygonWKT(coords [][]float64) string {
	num := func(v float64) string { return strconv.FormatFloat(v, 'f', -1, 64) }

	points := make([]string, len(coords))
	for i, p := range coords {
		points[i] = num(p[1]) + " " + num(p[0])
	}
	return "POLYGON((" + strings.Join(points, ", ") + "))"
}

func (h *Handler) CreateGeofence(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	ctx := r.Context()

	var req createGeofenceRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, start, err.Error())
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, start, "name is required")
		return
	}
	if !validCategories[req.Category] {
		writeError(w, http.StatusBadRequest, start, "category must be one of: delivery_zone, restricted_zone, toll_zone, customer_area")
		return
	}
	if err := validateCoordinates(req.Coordinates); err != nil {
		writeError(w, http.StatusBadRequest, start, err.Error())
		return
	}

	wkt := polygonWKT(req.Coordinates)

	// catches bow-tie shapes and other broken polygons before they get saved
	var valid bool
	err := h.db.QueryRow(ctx, `SELECT ST_IsValid(ST_GeomFromText($1, 4326))`, wkt).Scan(&valid)
	if err != nil || !valid {
		writeError(w, http.StatusBadRequest, start, "polygon shape is invalid (edges may be crossing each other)")
		return
	}

	id := newID("geo")
	_, err = h.db.Exec(ctx,
		`INSERT INTO geofences (id, name, description, category, coordinates, boundary)
		 VALUES ($1, $2, $3, $4, $5, ST_GeomFromText($6, 4326))`,
		id, req.Name, req.Description, req.Category, req.Coordinates, wkt,
	)
	if err != nil {
		serverError(w, start, err, "could not create geofence")
		return
	}

	writeJSON(w, http.StatusCreated, start, map[string]any{
		"id": id,
		"name": req.Name,
		"status": "active",
	})
}

func (h *Handler) ListGeofences(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	query := `SELECT id, name, description, coordinates, category, created_at FROM geofences`
	args := []any{}

	if category := r.URL.Query().Get("category"); category != "" {
		if !validCategories[category] {
			writeError(w, http.StatusBadRequest, start, "unknown category filter")
			return
		}
		query += ` WHERE category = $1`
		args = append(args, category)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		serverError(w, start, err, "could not load geofences")
		return
	}
	defer rows.Close()

	geofences := []models.Geofence{}
	for rows.Next() {
		var g models.Geofence
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.Coordinates, &g.Category, &g.CreatedAt); err != nil {
			serverError(w, start, err, "could not read geofences")
			return
		}
		geofences = append(geofences, g)
	}
	if err := rows.Err(); err != nil {
		serverError(w, start, err, "could not read geofences")
		return
	}

	writeJSON(w, http.StatusOK, start, map[string]any{"geofences": geofences})
}