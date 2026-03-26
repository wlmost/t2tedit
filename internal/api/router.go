package api

import (
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"github.com/wlmost/t2tedit/internal/groovy"
	"github.com/wlmost/t2tedit/internal/transform"
)

// NewRouter creates and returns the configured HTTP router with CORS support.
// Allowed origins are read from the CORS_ORIGINS environment variable (comma-separated).
// Defaults to "*" (all origins) when not set.
func NewRouter() http.Handler {
	r := mux.NewRouter()

	h := NewHandlers(transform.NewEngine(), groovy.NewGroovyBridge())

	r.HandleFunc("/api/health", h.Health).Methods(http.MethodGet)

	r.HandleFunc("/api/mappings", h.CreateMapping).Methods(http.MethodPost)
	r.HandleFunc("/api/mappings", h.ListMappings).Methods(http.MethodGet)
	r.HandleFunc("/api/mappings/{id}", h.GetMapping).Methods(http.MethodGet)
	r.HandleFunc("/api/mappings/{id}", h.UpdateMapping).Methods(http.MethodPut)
	r.HandleFunc("/api/mappings/{id}", h.DeleteMapping).Methods(http.MethodDelete)

	r.HandleFunc("/api/transform", h.ExecuteTransform).Methods(http.MethodPost)
	r.HandleFunc("/api/validate", h.ValidateMapping).Methods(http.MethodPost)
	r.HandleFunc("/api/parse-schema", h.ParseSchema).Methods(http.MethodPost)
	r.HandleFunc("/api/groovy/execute", h.GroovyExecute).Methods(http.MethodPost)
	r.HandleFunc("/api/groovy/status", h.GroovyStatus).Methods(http.MethodGet)

	allowedOrigins := []string{"*"}
	if envOrigins := os.Getenv("CORS_ORIGINS"); envOrigins != "" {
		allowedOrigins = strings.Split(envOrigins, ",")
	}

	c := cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: false,
	})

	return c.Handler(r)
}
