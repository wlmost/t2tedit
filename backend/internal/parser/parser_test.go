package parser_test

import (
	"testing"

	"github.com/wlmost/t2tedit/backend/internal/parser"
)

func TestExtractValue_TopLevel(t *testing.T) {
	data := map[string]interface{}{
		"name": "Alice",
		"age":  float64(25),
	}
	val, err := parser.ExtractValue(data, "name")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if val != "Alice" {
		t.Errorf("expected Alice, got %v", val)
	}
}

func TestExtractValue_Nested(t *testing.T) {
	data := map[string]interface{}{
		"user": map[string]interface{}{
			"address": map[string]interface{}{
				"city": "Berlin",
			},
		},
	}
	val, err := parser.ExtractValue(data, "user.address.city")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if val != "Berlin" {
		t.Errorf("expected Berlin, got %v", val)
	}
}

func TestExtractValue_MissingKey(t *testing.T) {
	data := map[string]interface{}{"a": "b"}
	_, err := parser.ExtractValue(data, "missing")
	if err == nil {
		t.Fatal("expected error for missing key")
	}
}

func TestExtractValue_EmptyPath(t *testing.T) {
	data := map[string]interface{}{"x": 1}
	val, err := parser.ExtractValue(data, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if val == nil {
		t.Error("expected non-nil value for empty path")
	}
}

func TestSetValue_TopLevel(t *testing.T) {
	data := map[string]interface{}{}
	if err := parser.SetValue(data, "name", "Bob"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["name"] != "Bob" {
		t.Errorf("expected Bob, got %v", data["name"])
	}
}

func TestSetValue_Nested(t *testing.T) {
	data := map[string]interface{}{}
	if err := parser.SetValue(data, "person.address.city", "Hamburg"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	person, ok := data["person"].(map[string]interface{})
	if !ok {
		t.Fatal("expected person to be a map")
	}
	addr, ok := person["address"].(map[string]interface{})
	if !ok {
		t.Fatal("expected address to be a map")
	}
	if addr["city"] != "Hamburg" {
		t.Errorf("expected Hamburg, got %v", addr["city"])
	}
}

func TestSetValue_EmptyPath(t *testing.T) {
	data := map[string]interface{}{}
	err := parser.SetValue(data, "", "value")
	if err == nil {
		t.Fatal("expected error for empty path")
	}
}

func TestParseSchema_FlatObject(t *testing.T) {
	data := map[string]interface{}{
		"name":  "Alice",
		"age":   float64(30),
		"admin": true,
	}
	fields := parser.ParseSchema(data)
	if len(fields) != 3 {
		t.Fatalf("expected 3 fields, got %d", len(fields))
	}
	types := map[string]string{}
	for _, f := range fields {
		types[f.Name] = f.Type
	}
	if types["name"] != "string" {
		t.Errorf("expected name to be string, got %s", types["name"])
	}
	if types["age"] != "number" {
		t.Errorf("expected age to be number, got %s", types["age"])
	}
	if types["admin"] != "boolean" {
		t.Errorf("expected admin to be boolean, got %s", types["admin"])
	}
}

func TestParseSchema_NestedObject(t *testing.T) {
	data := map[string]interface{}{
		"user": map[string]interface{}{
			"firstName": "John",
		},
	}
	fields := parser.ParseSchema(data)
	if len(fields) != 1 {
		t.Fatalf("expected 1 top-level field, got %d", len(fields))
	}
	userField := fields[0]
	if userField.Name != "user" || userField.Type != "object" {
		t.Errorf("unexpected user field: %+v", userField)
	}
	if len(userField.Children) != 1 {
		t.Fatalf("expected 1 child, got %d", len(userField.Children))
	}
	if userField.Children[0].Name != "firstName" {
		t.Errorf("expected firstName child, got %s", userField.Children[0].Name)
	}
	if userField.Children[0].Path != "user.firstName" {
		t.Errorf("expected path user.firstName, got %s", userField.Children[0].Path)
	}
}

func TestParseSchema_Array(t *testing.T) {
	data := map[string]interface{}{
		"items": []interface{}{
			map[string]interface{}{"id": "1"},
		},
	}
	fields := parser.ParseSchema(data)
	if len(fields) != 1 {
		t.Fatalf("expected 1 field, got %d", len(fields))
	}
	if fields[0].Type != "array" {
		t.Errorf("expected array type, got %s", fields[0].Type)
	}
}
