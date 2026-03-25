package groovy

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// GroovyBridge executes Groovy scripts via subprocess.
type GroovyBridge struct {
	Available bool
}

// NewGroovyBridge creates a GroovyBridge and checks whether the groovy command is available.
func NewGroovyBridge() *GroovyBridge {
	_, err := exec.LookPath("groovy")
	return &GroovyBridge{Available: err == nil}
}

// Execute runs a Groovy script with the provided variable bindings.
// Bindings are serialised to JSON and written to a separate bindings file that is loaded via
// JsonSlurper, avoiding injection through binding values.
// The script must produce a value that is printed as JSON via JsonOutput.toJson().
func (g *GroovyBridge) Execute(script string, bindings map[string]interface{}) (interface{}, error) {
	if !g.Available {
		return nil, fmt.Errorf("Groovy runtime not available")
	}

	// Write bindings to a separate JSON file to avoid injection through binding values.
	bindingsData, err := json.Marshal(bindings)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal bindings: %w", err)
	}

	tmpDir := os.TempDir()
	bindingsFile, err := os.CreateTemp(tmpDir, "t2tedit-bindings-*.json")
	if err != nil {
		return nil, fmt.Errorf("failed to create bindings file: %w", err)
	}
	defer os.Remove(bindingsFile.Name())
	if _, err := bindingsFile.Write(bindingsData); err != nil {
		bindingsFile.Close()
		return nil, fmt.Errorf("failed to write bindings: %w", err)
	}
	bindingsFile.Close()

	bindingsPath, err := filepath.Abs(bindingsFile.Name())
	if err != nil {
		return nil, fmt.Errorf("failed to resolve bindings path: %w", err)
	}

	var sb strings.Builder
	sb.WriteString("import groovy.json.JsonOutput\nimport groovy.json.JsonSlurper\n\n")
	sb.WriteString("def slurper = new JsonSlurper()\n")
	sb.WriteString(fmt.Sprintf("def __bindings = slurper.parse(new File(%q))\n", bindingsPath))
	for name := range bindings {
		sb.WriteString(fmt.Sprintf("def %s = __bindings.%s\n", name, name))
	}

	sb.WriteString("\ndef result = { \n")
	sb.WriteString(script)
	sb.WriteString("\n}()\n")
	sb.WriteString("println JsonOutput.toJson(result)\n")

	tmpFile, err := os.CreateTemp(tmpDir, "t2tedit-*.groovy")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp script file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(sb.String()); err != nil {
		tmpFile.Close()
		return nil, fmt.Errorf("failed to write temp script: %w", err)
	}
	tmpFile.Close()

	absPath, err := filepath.Abs(tmpFile.Name())
	if err != nil {
		return nil, fmt.Errorf("failed to resolve script path: %w", err)
	}

	out, err := exec.Command("groovy", absPath).Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("groovy script failed: %s", string(exitErr.Stderr))
		}
		return nil, fmt.Errorf("groovy execution error: %w", err)
	}

	output := strings.TrimSpace(string(out))
	var result interface{}
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		// Return raw string when output is not valid JSON
		return output, nil
	}
	return result, nil
}

// EvaluateScript is a convenience method that executes a Groovy script with `input` bound to the
// provided value.
func (g *GroovyBridge) EvaluateScript(script string, input interface{}) (interface{}, error) {
	return g.Execute(script, map[string]interface{}{"input": input})
}

