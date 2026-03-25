import { useState, useCallback } from 'react';
import { api } from '../api';
import type { Mapping, MappingRule, SchemaField, TransformResult, ValidationResult } from '../types';
import { JsonEditor } from './JsonEditor';
import { SchemaTree } from './SchemaTree';
import { RuleRow } from './RuleRow';

type Tab = 'mapping' | 'rules' | 'preview';

interface MappingEditorProps {
  mapping: Mapping;
  onSave: (mapping: Mapping) => void;
}

function generateId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function MappingEditor({ mapping, onSave }: MappingEditorProps) {
  const [draft, setDraft] = useState<Mapping>(mapping);
  const [activeTab, setActiveTab] = useState<Tab>('mapping');

  const [sourceJson, setSourceJson] = useState('');
  const [targetJson, setTargetJson] = useState('');
  const [sourceFields, setSourceFields] = useState<SchemaField[]>([]);
  const [targetFields, setTargetFields] = useState<SchemaField[]>([]);
  const [selectedSource, setSelectedSource] = useState<SchemaField | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<SchemaField | null>(null);

  const [inputJson, setInputJson] = useState('{}');
  const [transformResult, setTransformResult] = useState<TransformResult | null>(null);

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<{ source?: string; target?: string }>({});

  // Reset state when mapping prop changes
  const [lastMappingId, setLastMappingId] = useState(mapping.id);
  if (mapping.id !== lastMappingId) {
    setLastMappingId(mapping.id);
    setDraft(mapping);
    setSourceJson('');
    setTargetJson('');
    setSourceFields([]);
    setTargetFields([]);
    setSelectedSource(null);
    setSelectedTarget(null);
    setTransformResult(null);
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
      await onSave(draft);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    setError(null);
    try {
      const result = await api.validate(draft);
      setValidation(result);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleTransform() {
    setError(null);
    try {
      const inputData = JSON.parse(inputJson);
      const result = await api.transform({ mapping: draft, inputData });
      setTransformResult(result);
    } catch (err: any) {
      setError(err.message);
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
        {(['mapping', 'rules', 'preview'] as Tab[]).map((tab) => (
          <button
            key={tab}
            className={`tab-btn${activeTab === tab ? ' tab-btn-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

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
              <div className="rule-hint">✔ Target: <code>{selectedTarget.path}</code> — now click a source field</div>
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
