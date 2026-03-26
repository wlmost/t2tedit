package models

import "time"

// MappingRule represents a single field mapping
type MappingRule struct {
	ID           string `json:"id"`
	SourcePath   string `json:"sourcePath"`
	TargetPath   string `json:"targetPath"`
	Transform    string `json:"transform"` // "direct", "groovy", "template"
	GroovyScript string `json:"groovyScript,omitempty"`
	Template     string `json:"template,omitempty"`
	Condition    string `json:"condition,omitempty"`
}

// Mapping represents a complete mapping definition
type Mapping struct {
	ID           string        `json:"id"`
	Name         string        `json:"name"`
	Description  string        `json:"description"`
	SourceSchema interface{}   `json:"sourceSchema"`
	TargetSchema interface{}   `json:"targetSchema"`
	Rules        []MappingRule `json:"rules"`
	GroovyScript string        `json:"groovyScript,omitempty"`
	ExampleData  interface{}   `json:"exampleData,omitempty"`
	CreatedAt    time.Time     `json:"createdAt"`
	UpdatedAt    time.Time     `json:"updatedAt"`
}

// TransformRequest is the request body for transformation execution
type TransformRequest struct {
	MappingID string      `json:"mappingId"`
	Mapping   *Mapping    `json:"mapping,omitempty"` // inline mapping
	InputData interface{} `json:"inputData"`
}

// TransformResult is the result of a transformation
type TransformResult struct {
	Success    bool        `json:"success"`
	OutputData interface{} `json:"outputData,omitempty"`
	Error      string      `json:"error,omitempty"`
	Logs       []string    `json:"logs,omitempty"`
	Duration   int64       `json:"durationMs"`
}

// ValidationResult holds validation results
type ValidationResult struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}

// SchemaField represents a field in a JSON schema
type SchemaField struct {
	Name     string        `json:"name"`
	Path     string        `json:"path"`
	Type     string        `json:"type"`
	Children []SchemaField `json:"children,omitempty"`
	Required bool          `json:"required"`
}
