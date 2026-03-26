package parser

import (
	"fmt"
	"strings"

	"github.com/wlmost/t2tedit/backend/internal/models"
)

// ParseSchema recursively parses a JSON object into a SchemaField tree.
func ParseSchema(data interface{}) []models.SchemaField {
	return parseValue(data, "", "")
}

func parseValue(data interface{}, name, parentPath string) []models.SchemaField {
	path := name
	if parentPath != "" && name != "" {
		path = parentPath + "." + name
	} else if parentPath != "" {
		path = parentPath
	}

	switch v := data.(type) {
	case map[string]interface{}:
		field := models.SchemaField{
			Name: name,
			Path: path,
			Type: "object",
		}
		for key, val := range v {
			children := parseValue(val, key, path)
			field.Children = append(field.Children, children...)
		}
		if name == "" {
			return field.Children
		}
		return []models.SchemaField{field}

	case []interface{}:
		field := models.SchemaField{
			Name: name,
			Path: path,
			Type: "array",
		}
		if len(v) > 0 {
			children := parseValue(v[0], "[]", path)
			field.Children = append(field.Children, children...)
		}
		return []models.SchemaField{field}

	case string:
		return []models.SchemaField{{Name: name, Path: path, Type: "string"}}
	case float64:
		return []models.SchemaField{{Name: name, Path: path, Type: "number"}}
	case bool:
		return []models.SchemaField{{Name: name, Path: path, Type: "boolean"}}
	case nil:
		return []models.SchemaField{{Name: name, Path: path, Type: "null"}}
	default:
		return []models.SchemaField{{Name: name, Path: path, Type: "unknown"}}
	}
}

// ExtractValue extracts a value from data using a dot-notation path (e.g., "user.address.city").
func ExtractValue(data interface{}, path string) (interface{}, error) {
	if path == "" {
		return data, nil
	}
	parts := strings.SplitN(path, ".", 2)
	key := parts[0]

	m, ok := data.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("expected object at path segment %q, got %T", key, data)
	}
	val, exists := m[key]
	if !exists {
		return nil, fmt.Errorf("key %q not found", key)
	}
	if len(parts) == 1 {
		return val, nil
	}
	return ExtractValue(val, parts[1])
}

// SetValue sets a value in data at the given dot-notation path, creating intermediate maps as needed.
func SetValue(data map[string]interface{}, path string, value interface{}) error {
	if path == "" {
		return fmt.Errorf("path must not be empty")
	}
	parts := strings.SplitN(path, ".", 2)
	key := parts[0]

	if len(parts) == 1 {
		data[key] = value
		return nil
	}
	child, exists := data[key]
	if !exists {
		child = map[string]interface{}{}
		data[key] = child
	}
	childMap, ok := child.(map[string]interface{})
	if !ok {
		childMap = map[string]interface{}{}
		data[key] = childMap
	}
	return SetValue(childMap, parts[1], value)
}
