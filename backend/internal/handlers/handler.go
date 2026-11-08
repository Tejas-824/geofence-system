package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"geofence-backend/internal/realtime"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db *pgxpool.Pool
	hub *realtime.Hub
}

func New(db *pgxpool.Pool, hub *realtime.Hub) *Handler {
	return &Handler{db: db, hub: hub}
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	writeJSON(w, http.StatusOK, start, map[string]any{"status": "ok"})
}

// writeJSON adds time_ns (time since the handler started) to every response.
func writeJSON(w http.ResponseWriter, status int, start time.Time, body map[string]any) {
	body["time_ns"] = strconv.FormatInt(time.Since(start).Nanoseconds(), 10)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("could not write response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, start time.Time, msg string) {
	writeJSON(w, status, start, map[string]any{"error": msg})
}

func serverError(w http.ResponseWriter, start time.Time, err error, msg string) {
	log.Printf("%s: %v", msg, err)
	writeError(w, http.StatusInternalServerError, start, msg)
}

func decodeJSON(r *http.Request, dst any) error {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		return errors.New("request body is not valid JSON")
	}
	return nil
}

func newID(prefix string) string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}

func hasPgCode(err error, code string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == code
}

func isUniqueViolation(err error) bool { return hasPgCode(err, "23505") }
func isForeignKeyViolation(err error) bool { return hasPgCode(err, "23503") }