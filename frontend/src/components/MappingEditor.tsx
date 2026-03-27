import { useState, useCallback, useEffect } from 'react';
import { api } from '../api';
import type { Mapping, MappingRule, SchemaField, TransformResult, ValidationResult } from '../types';
import { JsonEditor } from './JsonEditor';
import { SchemaTree } from './SchemaTree';
import { RuleRow } from './RuleRow';
import { mappingToGroovyFile, downloadTextFile, mappingFilename } from '../mappingFile';
import { jsonResultToIdocText } from '../idocFormatter';

type Tab = 'script' | 'mapping' | 'rules' | 'preview';

interface MappingEditorProps {
  mapping: Mapping;
  onSave: (mapping: Mapping) => void;
}

function generateId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Recursively removes any key starting with "_" from a plain object.
 * These are internal meta-keys (e.g. _positions, _cfg) used by the
 * data-conversion layer and must not be displayed to the user.
 */
function stripMetaKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripMetaKeys);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!k.startsWith('_')) out[k] = stripMetaKeys(v);
  }
  return out;
}

function schemaToDisplayJson(schema: unknown): string {
  return JSON.stringify(stripMetaKeys(schema), null, 2);
}

export function MappingEditor({ mapping, onSave }: MappingEditorProps) {
  const [draft, setDraft] = useState<Mapping>(mapping);
  const [activeTab, setActiveTab] = useState<Tab>('script');

  const [sourceJson, setSourceJson] = useState(
    mapping.sourceSchema ? schemaToDisplayJson(mapping.sourceSchema) : ''
  );
  const [targetJson, setTargetJson] = useState(
    mapping.targetSchema ? schemaToDisplayJson(mapping.targetSchema) : ''
  );
  const [sourceFields, setSourceFields] = useState<SchemaField[]>([]);
  const [targetFields, setTargetFields] = useState<SchemaField[]>([]);
  const [selectedSource, setSelectedSource] = useState<SchemaField | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<SchemaField | null>(null);

  const [inputJson, setInputJson] = useState(
    mapping.exampleData
      ? JSON.stringify(mapping.exampleData, null, 2)
      : mapping.sourceSchema ? JSON.stringify(mapping.sourceSchema, null, 2) : '{}'
  );
  const [transformResult, setTransformResult] = useState<TransformResult | null>(null);

  // Groovy Script tab state
  const [groovyScript, setGroovyScript] = useState(mapping.groovyScript ?? '');
  const [scriptInputJson, setScriptInputJson] = useState(
    mapping.exampleData
      ? JSON.stringify(mapping.exampleData, null, 2)
      : mapping.sourceSchema ? JSON.stringify(mapping.sourceSchema, null, 2) : '{}'
  );
  const [scriptResult, setScriptResult] = useState<{ success: boolean; result?: any; error?: string; durationMs: number } | null>(null);
  const [scriptRunning, setScriptRunning] = useState(false);

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<{ source?: string; target?: string }>({});

  // Reset state when mapping prop changes
  const [lastMappingId, setLastMappingId] = useState(mapping.id);
  if (mapping.id !== lastMappingId) {
    setLastMappingId(mapping.id);
    setDraft(mapping);
    setSourceJson(mapping.sourceSchema ? schemaToDisplayJson(mapping.sourceSchema) : '');
    setTargetJson(mapping.targetSchema ? schemaToDisplayJson(mapping.targetSchema) : '');
    setSourceFields([]);
    setTargetFields([]);
    setSelectedSource(null);
    setSelectedTarget(null);
    setInputJson(
      mapping.exampleData
        ? JSON.stringify(mapping.exampleData, null, 2)
        : mapping.sourceSchema ? JSON.stringify(mapping.sourceSchema, null, 2) : '{}'
    );
    setTransformResult(null);
    setGroovyScript(mapping.groovyScript ?? '');
    setScriptInputJson(
      mapping.exampleData
        ? JSON.stringify(mapping.exampleData, null, 2)
        : mapping.sourceSchema ? JSON.stringify(mapping.sourceSchema, null, 2) : '{}'
    );
    setScriptResult(null);
    setValidation(null);
    setError(null);
    setParseError({});
  }

  const parseSource = useCallback(async () => {
    try {
      const parsed = JSON.parse(sourceJson);
      const result = await api.parseSchema(parsed);
      setSourceFields(result.fields);
      setDraft((d) => ({ ...d, sourceSchema: parsed }));
      setParseError((e) => ({ ...e, source: undefined }));
    } catch (err: any) {
      setParseError((e) => ({ ...e, source: err.message }));
    }
  }, [sourceJson]);

  const parseTarget = useCallback(async () => {
    try {
      const parsed = JSON.parse(targetJson);
      const result = await api.parseSchema(parsed);
      setTargetFields(result.fields);
      setDraft((d) => ({ ...d, targetSchema: parsed }));
      setParseError((e) => ({ ...e, target: undefined }));
    } catch (err: any) {
      setParseError((e) => ({ ...e, target: err.message }));
    }
  }, [targetJson]);

  // Auto-parse schemas when a mapping is loaded with pre-populated schemas.
  // We depend on id+schemas so re-parsing fires if schemas are updated on the same mapping.
  useEffect(() => {
    async function autoParse() {
      if (mapping.sourceSchema) {
        try {
          const result = await api.parseSchema(mapping.sourceSchema);
          setSourceFields(result.fields);
        } catch { /* ignore — user can click Parse Schema manually */ }
      }
      if (mapping.targetSchema) {
        try {
          const result = await api.parseSchema(mapping.targetSchema);
          setTargetFields(result.fields);
        } catch { /* ignore */ }
      }
    }
    autoParse();
  }, [mapping.id, mapping.sourceSchema, mapping.targetSchema]);

  async function handleRunScript() {
    setScriptRunning(true);
    setScriptResult(null);
    try {
      const input = JSON.parse(scriptInputJson);
      const result = await api.groovyExecute(groovyScript, input);
      setScriptResult(result);
    } catch (err: any) {
      setScriptResult({ success: false, error: err.message, durationMs: 0 });
    } finally {
      setScriptRunning(false);
    }
  }

  function handleSourceSelect(field: SchemaField) {
    setSelectedSource(field);
    if (selectedTarget) {
      addRule(field, selectedTarget);
      setSelectedSource(null);
      setSelectedTarget(null);
    }
  }

  function handleTargetSelect(field: SchemaField) {
    setSelectedTarget(field);
    if (selectedSource) {
      addRule(selectedSource, field);
      setSelectedSource(null);
      setSelectedTarget(null);
    }
  }

  function addRule(src: SchemaField, tgt: SchemaField) {
    const rule: MappingRule = {
      id: generateId(),
      sourcePath: src.path,
      targetPath: tgt.path,
      transform: 'direct',
    };
    setDraft((d) => ({ ...d, rules: [...d.rules, rule] }));
  }

  function addRuleWithTargetOnly(tgt: SchemaField) {
    const rule: MappingRule = {
      id: generateId(),
      sourcePath: '',
      targetPath: tgt.path,
      transform: 'template',
      template: '',
    };
    setDraft((d) => ({ ...d, rules: [...d.rules, rule] }));
  }

  function addBlankRule() {
    const rule: MappingRule = {
      id: generateId(),
      sourcePath: '',
      targetPath: '',
      transform: 'direct',
    };
    setDraft((d) => ({ ...d, rules: [...d.rules, rule] }));
  }

  function updateRule(updated: MappingRule) {
    setDraft((d) => ({
      ...d,
      rules: d.rules.map((r) => (r.id === updated.id ? updated : r)),
    }));
  }

  function deleteRule(id: string) {
    setDraft((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== id) }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...draft, groovyScript });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleExportToFile() {
    const merged: Mapping = { ...draft, groovyScript };
    const content = mappingToGroovyFile(merged);
    downloadTextFile(mappingFilename(merged.name), content);
  }

  async function handleValidate() {
    setError(null);
    try {
      const result = await api.validate(draft);
      setValidation(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleTransform() {
    setError(null);
    try {
      const inputData = JSON.parse(inputJson);
      const result = await api.transform({ mapping: draft, inputData });
      setTransformResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const outputJson = transformResult?.outputData
    ? JSON.stringify(transformResult.outputData, null, 2)
    : '';

  return (
    <div className="mapping-editor">
      {/* Header bar */}
      <div className="editor-header">
        <div className="editor-header-fields">
          <input
            className="editor-name-input"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Mapping name..."
          />
          <input
            className="editor-desc-input"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Description..."
          />
        </div>
        <div className="editor-header-actions">
          <button className="btn btn-secondary" onClick={handleValidate}>Validate</button>
          <button className="btn btn-secondary" onClick={handleExportToFile} title="Export mapping as .groovy file">
            💾 Export
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {validation && (
        <div className={`validation-banner ${validation.valid ? 'validation-ok' : 'validation-fail'}`}>
          {validation.valid ? '✔ Valid' : '✖ Invalid'}
          {validation.errors.map((e, i) => <div key={i} className="validation-msg validation-error">Error: {e}</div>)}
          {validation.warnings.map((w, i) => <div key={i} className="validation-msg validation-warning">Warning: {w}</div>)}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {(['script', 'mapping', 'rules', 'preview'] as Tab[]).map((tab) => (
          <button
            key={tab}
            className={`tab-btn${activeTab === tab ? ' tab-btn-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'script' ? 'Groovy Script' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ─── Groovy Script Tab ─────────────────────────────────────────── */}
      {activeTab === 'script' && (
        <div className="tab-content script-tab">
          {/* LEFT: Groovy editor */}
          <div className="script-left">
            <div className="script-panel-header">
              <span className="panel-title">Groovy Script — Target Structure</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleRunScript}
                disabled={scriptRunning || !groovyScript.trim()}
              >
                {scriptRunning ? '⏳ Running…' : '▶ Execute'}
              </button>
            </div>
            <textarea
              className="groovy-editor"
              value={groovyScript}
              onChange={(e) => setGroovyScript(e.target.value)}
              spellCheck={false}
              placeholder={`// Write a Groovy script that transforms source into the target format.\n// The 'source' binding contains the full source JSON.\n// Segments are accessed with quoted keys, e.g. source.'660'.fieldName\n// Use the target{} builder DSL for ySE-compatible output (no array literals).\n\nreturn target {\n  targetField(source.'660'.sourceField)\n}`}
            />
          </div>

          {/* RIGHT: input structure (top) + output (bottom) */}
          <div className="script-right">
            <div className="script-right-top">
              <div className="script-panel-header">
                <span className="panel-title">Input Data Structure</span>
              </div>
              <JsonEditor
                label=""
                value={scriptInputJson}
                onChange={setScriptInputJson}
              />
            </div>

            <div className="script-right-bottom">
              <div className="script-panel-header">
                <span className="panel-title">Resulting Target Format (IDoc)</span>
                {scriptResult && (
                  <span className={scriptResult.success ? 'meta-ok' : 'meta-error'}>
                    {scriptResult.success ? `✔ ${scriptResult.durationMs}ms` : `✖ Error`}
                  </span>
                )}
              </div>
              {scriptResult ? (
                scriptResult.success ? (
                  <pre className="script-output">
                    {jsonResultToIdocText(scriptResult.result, draft.targetSchema)}
                  </pre>
                ) : (
                  <div className="script-error-box">
                    <div className="script-error-label">Execution error</div>
                    <pre className="script-error-msg">{scriptResult.error}</pre>
                  </div>
                )
              ) : (
                <div className="script-output-placeholder">
                  Press ▶ Execute to see the transformed IDoc output here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mapping Tab */}
      {activeTab === 'mapping' && (
        <div className="tab-content mapping-tab">
          <div className="schema-panel">
            <h3 className="panel-title">Source Schema</h3>
            <JsonEditor
              label="Source JSON"
              value={sourceJson}
              onChange={setSourceJson}
              height={150}
            />
            {parseError.source && <div className="error-text">{parseError.source}</div>}
            <button className="btn btn-secondary btn-sm parse-btn" onClick={parseSource}>
              Parse Schema
            </button>
            <SchemaTree
              title="Source Fields"
              fields={sourceFields}
              onSelect={handleSourceSelect}
              selectedPath={selectedSource?.path}
            />
          </div>

          <div className="rules-panel-center">
            <h3 className="panel-title">Rules ({draft.rules.length})</h3>
            {selectedSource && !selectedTarget && (
              <div className="rule-hint">✔ Source: <code>{selectedSource.path}</code> — now click a target field</div>
            )}
            {!selectedSource && selectedTarget && (
              <div className="rule-hint">
                ✔ Target: <code>{selectedTarget.path}</code> — click a source field, or{' '}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    addRuleWithTargetOnly(selectedTarget);
                    setSelectedTarget(null);
                  }}
                >
                  add constant rule (no source)
                </button>
              </div>
            )}
            <button className="btn btn-primary btn-sm" onClick={addBlankRule}>+ Add Rule</button>
            {draft.rules.length === 0 ? (
              <div className="rules-empty">No rules yet. Click a source field then a target field to create one.</div>
            ) : (
              <div className="rules-center-list">
                {draft.rules.map((rule) => (
                  <div key={rule.id} className="rule-card">
                    <div className="rule-card-paths">
                      <span className="rule-src">{rule.sourcePath || '—'}</span>
                      <span className="rule-arrow">→</span>
                      <span className="rule-tgt">{rule.targetPath || '—'}</span>
                    </div>
                    <span className={`transform-badge transform-${rule.transform}`}>{rule.transform}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="schema-panel">
            <h3 className="panel-title">Target Schema</h3>
            <JsonEditor
              label="Target JSON"
              value={targetJson}
              onChange={setTargetJson}
              height={150}
            />
            {parseError.target && <div className="error-text">{parseError.target}</div>}
            <button className="btn btn-secondary btn-sm parse-btn" onClick={parseTarget}>
              Parse Schema
            </button>
            <SchemaTree
              title="Target Fields"
              fields={targetFields}
              onSelect={handleTargetSelect}
              selectedPath={selectedTarget?.path}
            />
          </div>
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="tab-content rules-tab">
          <div className="rules-tab-header">
            <button className="btn btn-primary btn-sm" onClick={addBlankRule}>+ Add Rule</button>
          </div>
          {draft.rules.length === 0 ? (
            <div className="rules-empty">No rules yet.</div>
          ) : (
            <table className="rules-table">
              <thead>
                <tr>
                  <th>Source Path</th>
                  <th>Transform</th>
                  <th>Target Path</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {draft.rules.map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    onUpdate={updateRule}
                    onDelete={deleteRule}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div className="tab-content preview-tab">
          <div className="preview-panel">
            <JsonEditor
              label="Input JSON"
              value={inputJson}
              onChange={setInputJson}
              height={300}
            />
            <button className="btn btn-primary transform-btn" onClick={handleTransform}>
              ▶ Transform
            </button>
          </div>
          <div className="preview-panel">
            <label className="json-editor-label">Output JSON</label>
            <pre className="preview-output">{outputJson || '(no result yet)'}</pre>
            {transformResult && (
              <div className="transform-meta">
                <span className={transformResult.success ? 'meta-ok' : 'meta-error'}>
                  {transformResult.success ? '✔ Success' : '✖ Failed'}
                </span>
                {' '}&mdash; {transformResult.durationMs}ms
                {transformResult.error && (
                  <div className="error-text">{transformResult.error}</div>
                )}
                {transformResult.logs && transformResult.logs.length > 0 && (
                  <details>
                    <summary>Logs ({transformResult.logs.length})</summary>
                    <pre className="transform-logs">{transformResult.logs.join('\n')}</pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
