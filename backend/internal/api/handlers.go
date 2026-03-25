package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/wlmost/t2tedit/backend/internal/groovy"
	"github.com/wlmost/t2tedit/backend/internal/models"
	"github.com/wlmost/t2tedit/backend/internal/parser"
	"github.com/wlmost/t2tedit/backend/internal/transform"
)

// Handlers holds shared dependencies for all HTTP handlers.
type Handlers struct {
	engine       *transform.Engine
	groovyBridge *groovy.GroovyBridge

	mu       sync.RWMutex
	mappings map[string]*models.Mapping
}

// NewHandlers creates a Handlers instance with the provided engine and groovy bridge.
func NewHandlers(engine *transform.Engine, bridge *groovy.GroovyBridge) *Handlers {
	return &Handlers{
		engine:       engine,
		groovyBridge: bridge,
		mappings:     make(map[string]*models.Mapping),
	}
}

// writeJSON writes v as JSON with the given status code.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// Health returns a simple health check response.
func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// CreateMapping creates a new mapping and stores it in memory.
func (h *Handlers) CreateMapping(w http.ResponseWriter, r *http.Request) {
	var m models.Mapping
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	now := time.Now()
	m.ID = fmt.Sprintf("%d", now.UnixNano())
	m.CreatedAt = now
	m.UpdatedAt = now

	h.mu.Lock()
	h.mappings[m.ID] = &m
	h.mu.Unlock()

	writeJSON(w, http.StatusCreated, &m)
}

// ListMappings returns all stored mappings.
func (h *Handlers) ListMappings(w http.ResponseWriter, r *http.Request) {
	h.mu.RLock()
	list := make([]*models.Mapping, 0, len(h.mappings))
	for _, m := range h.mappings {
		list = append(list, m)
	}
	h.mu.RUnlock()

	writeJSON(w, http.StatusOK, list)
}

// GetMapping returns a single mapping by ID.
func (h *Handlers) GetMapping(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	h.mu.RLock()
	m, ok := h.mappings[id]
	h.mu.RUnlock()

	if !ok {
		writeError(w, http.StatusNotFound, "mapping not found")
		return
	}
	writeJSON(w, http.StatusOK, m)
}

// UpdateMapping replaces an existing mapping by ID.
func (h *Handlers) UpdateMapping(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	h.mu.RLock()
	existing, ok := h.mappings[id]
	h.mu.RUnlock()

	if !ok {
		writeError(w, http.StatusNotFound, "mapping not found")
		return
	}

	var m models.Mapping
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	m.ID = id
	m.CreatedAt = existing.CreatedAt
	m.UpdatedAt = time.Now()

	h.mu.Lock()
	h.mappings[id] = &m
	h.mu.Unlock()

	writeJSON(w, http.StatusOK, &m)
}

// DeleteMapping removes a mapping by ID.
func (h *Handlers) DeleteMapping(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	h.mu.Lock()
	_, ok := h.mappings[id]
	if ok {
		delete(h.mappings, id)
	}
	h.mu.Unlock()

	if !ok {
		writeError(w, http.StatusNotFound, "mapping not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"deleted": id})
}

// ExecuteTransform runs a transformation using an inline or stored mapping.
func (h *Handlers) ExecuteTransform(w http.ResponseWriter, r *http.Request) {
	var req models.TransformRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	mapping := req.Mapping
	if mapping == nil && req.MappingID != "" {
		h.mu.RLock()
		mapping = h.mappings[req.MappingID]
		h.mu.RUnlock()
		if mapping == nil {
			writeError(w, http.StatusNotFound, "mapping not found: "+req.MappingID)
			return
		}
	}
	if mapping == nil {
		writeError(w, http.StatusBadRequest, "either mappingId or mapping must be provided")
		return
	}

	result := h.engine.Transform(mapping, req.InputData)
	writeJSON(w, http.StatusOK, result)
}

// ValidateMapping validates the provided mapping definition.
func (h *Handlers) ValidateMapping(w http.ResponseWriter, r *http.Request) {
	var m models.Mapping
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	result := h.engine.ValidateMapping(&m)
	writeJSON(w, http.StatusOK, result)
}

// ParseSchema accepts arbitrary JSON under "data" and returns the schema tree.
func (h *Handlers) ParseSchema(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Data interface{} `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	fields := parser.ParseSchema(body.Data)
	writeJSON(w, http.StatusOK, map[string]interface{}{"fields": fields})
}

// GroovyExecute executes an arbitrary Groovy script with the provided input data.
// Request: {"script": "...", "input": <any JSON>}
// Response: {"success": true/false, "result": <any>, "error": "...", "durationMs": 0}
func (h *Handlers) GroovyExecute(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Script string      `json:"script"`
		Input  interface{} `json:"input"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if body.Script == "" {
		writeError(w, http.StatusBadRequest, "script must not be empty")
		return
	}

	start := time.Now()
	result, err := h.groovyBridge.EvaluateScript(body.Script, body.Input)
	duration := time.Since(start).Milliseconds()

	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":    false,
			"error":      err.Error(),
			"durationMs": duration,
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":    true,
		"result":     result,
		"durationMs": duration,
	})
}

func (h *Handlers) GroovyStatus(w http.ResponseWriter, r *http.Request) {
	resp := map[string]interface{}{
		"available": h.groovyBridge.Available,
		"version":   "",
	}
	if h.groovyBridge.Available {
		out, err := exec.Command("groovy", "--version").Output()
		if err == nil {
			resp["version"] = strings.TrimSpace(string(out))
		}
	}
	writeJSON(w, http.StatusOK, resp)
}
