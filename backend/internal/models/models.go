package models

import "time"

type Geofence struct {
	ID string `json:"id"`
	Name string `json:"name"`
	Description string `json:"description"`
	Coordinates [][]float64 `json:"coordinates"`
	Category string `json:"category"`
	CreatedAt time.Time `json:"created_at"`
}

// GeofenceRef is the short version of a geofence used in alerts and "current geofences" lists.
type GeofenceRef struct {
	ID string `json:"geofence_id"`
	Name string `json:"geofence_name"`
	Category string `json:"category"`
}

type Vehicle struct {
	ID string `json:"id"`
	VehicleNumber string `json:"vehicle_number"`
	DriverName string `json:"driver_name"`
	VehicleType string `json:"vehicle_type"`
	Phone string `json:"phone"`
	Status string `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type AlertRule struct {
	AlertID string `json:"alert_id"`
	GeofenceID string `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	VehicleID *string `json:"vehicle_id"`
	VehicleNumber *string `json:"vehicle_number"`
	EventType string `json:"event_type"`
	Status string `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type Violation struct {
	ID string `json:"id"`
	VehicleID string `json:"vehicle_id"`
	VehicleNumber string `json:"vehicle_number"`
	GeofenceID string `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	EventType string `json:"event_type"`
	Latitude float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Timestamp time.Time `json:"timestamp"`
}

type AlertVehicle struct {
	VehicleID string `json:"vehicle_id"`
	VehicleNumber string `json:"vehicle_number"`
	DriverName string `json:"driver_name"`
}

type LatLng struct {
	Latitude float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// AlertEvent is exactly what gets pushed over the websocket.
type AlertEvent struct {
	EventID string `json:"event_id"`
	EventType string `json:"event_type"`
	Timestamp time.Time `json:"timestamp"`
	Vehicle AlertVehicle `json:"vehicle"`
	Geofence GeofenceRef `json:"geofence"`
	Location LatLng `json:"location"`
}