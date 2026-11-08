package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"geofence-backend/internal/config"
	"geofence-backend/internal/db"
	"geofence-backend/internal/handlers"
	"geofence-backend/internal/middleware"
	"geofence-backend/internal/realtime"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func main() {
	// on Render there's no .env file, so a missing one is fine
	_ = godotenv.Load()
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	hub := realtime.NewHub()
	h := handlers.New(pool, hub)
	locationLimiter := middleware.NewIPRateLimiter(50, 100)

	r := chi.NewRouter()
	r.Use(chimw.RealIP, chimw.Logger, chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: cfg.AllowedOrigins,
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"*"},
		MaxAge:         300,
	}))

	r.Get("/health", h.Health)
	r.Get("/ws/alerts", hub.ServeWS)

	r.Post("/geofences", h.CreateGeofence)
	r.Get("/geofences", h.ListGeofences)

	r.Post("/vehicles", h.CreateVehicle)
	r.Get("/vehicles", h.ListVehicles)
	r.With(locationLimiter.Middleware).Post("/vehicles/location", h.UpdateLocation)
	r.Get("/vehicles/location/{vehicle_id}", h.GetVehicleLocation)

	r.Post("/alerts/configure", h.ConfigureAlert)
	r.Get("/alerts", h.ListAlerts)

	r.Get("/violations/history", h.ViolationHistory)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("server running on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("shutting down...")
	shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}