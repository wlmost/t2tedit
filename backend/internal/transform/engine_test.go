package transform_test

import (
	"testing"

	"github.com/wlmost/t2tedit/backend/internal/models"
	"github.com/wlmost/t2tedit/backend/internal/transform"
)

func TestTransform_DirectRule(t *testing.T) {
	engine := transform.NewEngine()
	mapping := &models.Mapping{
		ID:   "test-1",
		Name: "Test Mapping",
		Rules: []models.MappingRule{
			{
				ID:          "r1",
				SourcePath:  "user.firstName",
				TargetPath:  "person.name",
				Transform:   "direct",
			},
		},
	}
	input := map[string]interface{}{
		"user": map[string]interface{}{
			"firstName": "Alice",
		},
	}

	result := engine.Transform(mapping, input)

	if !result.Success {
		t.Fatalf("expected success, got error: %s", result.Error)
	}
	output, ok := result.OutputData.(map[string]interface{})
	if !ok {
		t.Fatal("expected output to be a map")
	}
	person, ok := output["person"].(map[string]interface{})
	if !ok {
		t.Fatal("expected person to be a map")
	}
	if person["name"] != "Alice" {
		t.Errorf("expected Alice, got %v", person["name"])
	}
}

func TestTransform_TemplateRule(t *testing.T) {
	engine := transform.NewEngine()
	mapping := &models.Mapping{
		ID:   "test-2",
		Name: "Template Test",
		Rules: []models.MappingRule{
			{
				ID:         "r1",
				SourcePath: "city",
				TargetPath: "label",
				Transform:  "template",
				Template:   "City: {{value}}",
			},
		},
	}
	input := map[string]interface{}{
		"city": "Berlin",
	}

	result := engine.Transform(mapping, input)

	if !result.Success {
		t.Fatalf("expected success, got error: %s", result.Error)
	}
	output, ok := result.OutputData.(map[string]interface{})
	if !ok {
		t.Fatal("expected output to be a map")
	}
	if output["label"] != "City: Berlin" {
		t.Errorf("expected 'City: Berlin', got %v", output["label"])
	}
}

func TestTransform_MissingSourcePath(t *testing.T) {
	engine := transform.NewEngine()
	mapping := &models.Mapping{
		ID:   "test-3",
		Name: "Missing Source",
		Rules: []models.MappingRule{
			{
				ID:         "r1",
				SourcePath: "nonexistent.path",
				TargetPath: "dest",
				Transform:  "direct",
			},
		},
	}
	input := map[string]interface{}{
		"other": "value",
	}

	result := engine.Transform(mapping, input)

	// Missing source path is treated as a warning, not an error.
	if !result.Success {
		t.Errorf("expected success (warning) for missing source, got error: %s", result.Error)
	}
	if len(result.Logs) == 0 {
		t.Error("expected at least one warning log")
	}
}

func TestTransform_GroovyUnavailable(t *testing.T) {
	engine := transform.NewEngine()
	mapping := &models.Mapping{
		ID:   "test-4",
		Name: "Groovy Test",
		Rules: []models.MappingRule{
			{
				ID:           "r1",
				SourcePath:   "value",
				TargetPath:   "out",
				Transform:    "groovy",
				GroovyScript: "value * 2",
			},
		},
	}
	input := map[string]interface{}{
		"value": float64(5),
	}

	result := engine.Transform(mapping, input)
	// Groovy is not available in the test environment — engine should report failure.
	if result.Success {
		// Only pass if groovy is actually installed
		t.Log("Groovy is available; skipping unavailability check")
	} else {
		if result.Error == "" {
			t.Error("expected a non-empty error message")
		}
	}
}

func TestTransform_MultipleRules(t *testing.T) {
	engine := transform.NewEngine()
	mapping := &models.Mapping{
		ID:   "test-5",
		Name: "Multi Rule",
		Rules: []models.MappingRule{
			{ID: "r1", SourcePath: "a", TargetPath: "x", Transform: "direct"},
			{ID: "r2", SourcePath: "b", TargetPath: "y", Transform: "direct"},
		},
	}
	input := map[string]interface{}{
		"a": "hello",
		"b": float64(42),
	}

	result := engine.Transform(mapping, input)

	if !result.Success {
		t.Fatalf("expected success, got: %s", result.Error)
	}
	output := result.OutputData.(map[string]interface{})
	if output["x"] != "hello" {
		t.Errorf("expected x=hello, got %v", output["x"])
	}
	if output["y"] != float64(42) {
		t.Errorf("expected y=42, got %v", output["y"])
	}
}

func TestValidateMapping_Valid(t *testing.T) {
	engine := transform.NewEngine()
	mapping := &models.Mapping{
		ID:   "v1",
		Name: "Valid Mapping",
		Rules: []models.MappingRule{
			{ID: "r1", SourcePath: "a", TargetPath: "b", Transform: "direct"},
		},
	}

	result := engine.ValidateMapping(mapping)

	if !result.Valid {
		t.Errorf("expected valid, got errors: %v", result.Errors)
	}
}

func TestValidateMapping_MissingPaths(t *testing.T) {
	engine := transform.NewEngine()
	mapping := &models.Mapping{
		Name: "Bad Mapping",
		Rules: []models.MappingRule{
			{ID: "r1", SourcePath: "", TargetPath: "", Transform: "direct"},
		},
	}

	result := engine.ValidateMapping(mapping)

	if result.Valid {
		t.Error("expected invalid mapping")
	}
	if len(result.Errors) < 2 {
		t.Errorf("expected at least 2 errors, got %d: %v", len(result.Errors), result.Errors)
	}
}

func TestValidateMapping_GroovyMissingScript(t *testing.T) {
	engine := transform.NewEngine()
	mapping := &models.Mapping{
		Name: "Groovy Missing Script",
		Rules: []models.MappingRule{
			{ID: "r1", SourcePath: "a", TargetPath: "b", Transform: "groovy", GroovyScript: ""},
		},
	}

	result := engine.ValidateMapping(mapping)

	if result.Valid {
		t.Error("expected invalid mapping when groovyScript is empty")
	}
}

func TestValidateMapping_NoName(t *testing.T) {
	engine := transform.NewEngine()
	mapping := &models.Mapping{
		Name:  "",
		Rules: []models.MappingRule{},
	}

	result := engine.ValidateMapping(mapping)

	if !result.Valid {
		t.Error("expected valid (name warning, not error)")
	}
	if len(result.Warnings) == 0 {
		t.Error("expected a warning for missing name")
	}
}
