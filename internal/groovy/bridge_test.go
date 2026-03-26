package groovy_test

import (
	"testing"

	"github.com/wlmost/t2tedit/internal/groovy"
)

func TestNewGroovyBridge_Available(t *testing.T) {
	bridge := groovy.NewGroovyBridge()
	// java must be present in the test environment
	if !bridge.Available {
		t.Skip("java not available in test environment")
	}
}

func TestGroovyBridge_Execute_Simple(t *testing.T) {
	bridge := groovy.NewGroovyBridge()
	if !bridge.Available {
		t.Skip("java not available in test environment")
	}

	result, err := bridge.Execute("value * 2", map[string]interface{}{"value": float64(5)})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// JSON numbers unmarshal as float64
	if result != float64(10) {
		t.Errorf("expected 10, got %v (%T)", result, result)
	}
}

func TestGroovyBridge_Execute_String(t *testing.T) {
	bridge := groovy.NewGroovyBridge()
	if !bridge.Available {
		t.Skip("java not available in test environment")
	}

	result, err := bridge.Execute(`value.toUpperCase()`, map[string]interface{}{"value": "hello"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "HELLO" {
		t.Errorf("expected HELLO, got %v", result)
	}
}

func TestGroovyBridge_Execute_InputBinding(t *testing.T) {
	bridge := groovy.NewGroovyBridge()
	if !bridge.Available {
		t.Skip("java not available in test environment")
	}

	input := map[string]interface{}{
		"user": map[string]interface{}{"firstName": "Alice"},
	}
	result, err := bridge.EvaluateScript(`source.user.firstName.toLowerCase()`, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "alice" {
		t.Errorf("expected alice, got %v", result)
	}
}

func TestGroovyBridge_Execute_Ternary(t *testing.T) {
	bridge := groovy.NewGroovyBridge()
	if !bridge.Available {
		t.Skip("java not available in test environment")
	}

	result, err := bridge.Execute(
		`value >= 90 ? "A" : value >= 80 ? "B" : "C"`,
		map[string]interface{}{"value": float64(92)},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "A" {
		t.Errorf("expected A, got %v", result)
	}
}

func TestGroovyBridge_Execute_InvalidScript(t *testing.T) {
	bridge := groovy.NewGroovyBridge()
	if !bridge.Available {
		t.Skip("java not available in test environment")
	}

	_, err := bridge.Execute(`this is not valid groovy !!!`, map[string]interface{}{})
	if err == nil {
		t.Error("expected error for invalid Groovy script")
	}
}

func TestGroovyBridge_Execute_TargetBuilderDSL(t *testing.T) {
	bridge := groovy.NewGroovyBridge()
	if !bridge.Available {
		t.Skip("java not available in test environment")
	}

	script := `
def header = source.'660'
return target {
  EDI_DC40 {
    DOCNUM(header.Belegnummer)
    STATUS('30')
  }
}
`
	input := map[string]interface{}{
		"660": map[string]interface{}{"Belegnummer": "1009378"},
	}
	result, err := bridge.EvaluateScript(script, input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T: %v", result, result)
	}
	edi, ok := m["EDI_DC40"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected EDI_DC40 map, got %T", m["EDI_DC40"])
	}
	if edi["DOCNUM"] != "1009378" {
		t.Errorf("expected DOCNUM=1009378, got %v", edi["DOCNUM"])
	}
	if edi["STATUS"] != "30" {
		t.Errorf("expected STATUS=30, got %v", edi["STATUS"])
	}
}
