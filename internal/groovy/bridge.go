package groovy

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	_ "embed"
)

//go:embed jar/groovy-all-3.0.25.jar
var groovyAllJar []byte

// GroovyBridge executes Groovy scripts via subprocess using the embedded groovy-all.jar.
type GroovyBridge struct {
	Available bool

	jarOnce sync.Once
	jarPath string
	jarErr  error
}

// NewGroovyBridge creates a GroovyBridge and checks whether the java command is available.
// The embedded groovy-all.jar is extracted to a temporary file on first use.
func NewGroovyBridge() *GroovyBridge {
	_, err := exec.LookPath("java")
	return &GroovyBridge{Available: err == nil}
}

// jarFilePath returns the path to the extracted groovy-all.jar, extracting it on first call.
// The extracted file lives for the process lifetime and is cleaned up by the OS on process exit.
func (g *GroovyBridge) jarFilePath() (string, error) {
	g.jarOnce.Do(func() {
		f, err := os.CreateTemp("", "groovy-all-3.0.25-*.jar")
		if err != nil {
			g.jarErr = fmt.Errorf("failed to create temp jar file: %w", err)
			return
		}
		_, err = f.Write(groovyAllJar)
		f.Close()
		if err != nil {
			os.Remove(f.Name())
			g.jarErr = fmt.Errorf("failed to write groovy-all.jar: %w", err)
			return
		}
		g.jarPath = f.Name()
	})
	return g.jarPath, g.jarErr
}

// Execute runs a Groovy script with the provided variable bindings.
// Bindings are serialised to JSON and written to a separate bindings file that is loaded via
// JsonSlurper, avoiding injection through binding values.
// The script must produce a value that is printed as JSON via JsonOutput.toJson().
func (g *GroovyBridge) Execute(script string, bindings map[string]interface{}) (interface{}, error) {
	if !g.Available {
		return nil, fmt.Errorf("Groovy runtime not available (java not found)")
	}

	jarPath, err := g.jarFilePath()
	if err != nil {
		return nil, fmt.Errorf("failed to prepare groovy-all.jar: %w", err)
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

	// target{} builder DSL: provides a ySE-compatible way to define the target structure
	// without using Groovy array/map literal syntax.
	sb.WriteString(`
class __MapBuilder {
    private def __data = [:]
    def methodMissing(String name, args) {
        if (args && args.length > 0 && args[0] instanceof Closure) {
            def sub = new __MapBuilder()
            def cl = args[0]
            cl.delegate = sub
            cl.resolveStrategy = Closure.DELEGATE_FIRST
            cl()
            __data[name] = sub.__data
        } else {
            __data[name] = (args && args.length > 0) ? args[0] : null
        }
    }
    def getResult() { __data }
}
def target = { Closure c ->
    def __builder = new __MapBuilder()
    c.delegate = __builder
    c.resolveStrategy = Closure.DELEGATE_FIRST
    c()
    return __builder.result
}
`)

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

	out, err := exec.Command("java", "-jar", jarPath, absPath).Output()
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

