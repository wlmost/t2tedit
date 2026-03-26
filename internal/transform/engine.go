package transform

import (
	"fmt"
	"strings"
	"time"

	"github.com/wlmost/t2tedit/internal/groovy"
	"github.com/wlmost/t2tedit/internal/models"
	"github.com/wlmost/t2tedit/internal/parser"
)

// Engine applies mapping rules to transform input data.
type Engine struct {
	groovyBridge *groovy.GroovyBridge
}

// NewEngine creates a new transformation Engine.
func NewEngine() *Engine {
	return &Engine{groovyBridge: groovy.NewGroovyBridge()}
}

// Transform applies all rules in the mapping to inputData and returns the result.
func (e *Engine) Transform(mapping *models.Mapping, inputData interface{}) *models.TransformResult {
	start := time.Now()
	logs := []string{}
	output := map[string]interface{}{}

	for _, rule := range mapping.Rules {
		log, err := e.applyRule(rule, inputData, output)
		if log != "" {
			logs = append(logs, log)
		}
		if err != nil {
			return &models.TransformResult{
				Success:  false,
				Error:    err.Error(),
				Logs:     logs,
				Duration: time.Since(start).Milliseconds(),
			}
		}
	}

	return &models.TransformResult{
		Success:    true,
		OutputData: output,
		Logs:       logs,
		Duration:   time.Since(start).Milliseconds(),
	}
}

func (e *Engine) applyRule(rule models.MappingRule, inputData interface{}, output map[string]interface{}) (string, error) {
	sourceVal, err := parser.ExtractValue(inputData, rule.SourcePath)
	if err != nil {
		return fmt.Sprintf("[WARN] rule %s: could not extract %q: %v", rule.ID, rule.SourcePath, err), nil
	}

	var targetVal interface{}

	switch rule.Transform {
	case "direct", "":
		targetVal = sourceVal

	case "groovy":
		if rule.GroovyScript == "" {
			return "", fmt.Errorf("rule %s: groovyScript must not be empty for groovy transform", rule.ID)
		}
		result, err := e.groovyBridge.Execute(rule.GroovyScript, map[string]interface{}{
			"source": inputData,
			"value":  sourceVal,
		})
		if err != nil {
			return "", fmt.Errorf("rule %s: groovy execution failed: %w", rule.ID, err)
		}
		targetVal = result

	case "template":
		tmpl := rule.Template
		if tmpl == "" {
			tmpl = "{{value}}"
		}
		strVal := fmt.Sprintf("%v", sourceVal)
		targetVal = strings.ReplaceAll(tmpl, "{{value}}", strVal)

	default:
		return "", fmt.Errorf("rule %s: unknown transform type %q", rule.ID, rule.Transform)
	}

	if err := parser.SetValue(output, rule.TargetPath, targetVal); err != nil {
		return "", fmt.Errorf("rule %s: could not set target %q: %w", rule.ID, rule.TargetPath, err)
	}

	return fmt.Sprintf("[INFO] rule %s: %q -> %q", rule.ID, rule.SourcePath, rule.TargetPath), nil
}

// ValidateMapping validates the mapping rules and returns a ValidationResult.
func (e *Engine) ValidateMapping(mapping *models.Mapping) *models.ValidationResult {
	result := &models.ValidationResult{
		Valid:    true,
		Errors:   []string{},
		Warnings: []string{},
	}

	if mapping.Name == "" {
		result.Warnings = append(result.Warnings, "mapping has no name")
	}

	for i, rule := range mapping.Rules {
		prefix := fmt.Sprintf("rule[%d]", i)
		if rule.ID != "" {
			prefix = fmt.Sprintf("rule %q", rule.ID)
		}

		if rule.SourcePath == "" {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: sourcePath must not be empty", prefix))
			result.Valid = false
		}
		if rule.TargetPath == "" {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: targetPath must not be empty", prefix))
			result.Valid = false
		}
		if rule.Transform == "groovy" && rule.GroovyScript == "" {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: groovyScript must not be empty for groovy transform", prefix))
			result.Valid = false
		}
	}

	return result
}
