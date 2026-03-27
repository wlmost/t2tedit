import { useRef, useState } from 'react';
import type { Mapping } from '../types';
import { convertSchemaFile, convertDataFile } from '../schemaConverter';

interface NewMappingDialogProps {
  onClose: () => void;
  onCreate: (mapping: Omit<Mapping, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

type FieldError = { source?: string; target?: string; example?: string };

/** All schema file types we accept in the "Load Schema File" pickers. */
const SCHEMA_FILE_ACCEPT = '.json,.xsd,.csv,.p,.par,.txt,application/json,text/xml,application/xml,text/csv,text/plain';

/** All data file types for the example data picker. */
const DATA_FILE_ACCEPT = '.json,.xml,.csv,.p,.par,.txt,application/json,text/xml,application/xml,text/csv,text/plain';

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/** Loads a data file, auto-converts from XML / CSV / SAP / JSON to JSON, and
 *  returns the pretty-printed JSON string or throws an error string.
 *  An optional `schema` (already-parsed source schema JSON) guides field-name
 *  resolution for non-self-describing formats. */
async function loadDataFile(file: File, schema?: unknown): Promise<{ json: string; format: string }> {
  const content = await readFileAsText(file);
  const result = convertDataFile(file.name, content, schema);
  if (!result.ok) throw new Error(result.error);
  return { json: JSON.stringify(result.json, null, 2), format: result.format };
}

/** Loads a schema file, auto-converts from XSD / SAP / CSV to JSON, and
 *  returns the pretty-printed JSON string or throws an error string. */
async function loadSchemaFile(file: File): Promise<{ json: string; format: string }> {
  const content = await readFileAsText(file);
  const result = convertSchemaFile(file.name, content);
  if (!result.ok) throw new Error(result.error);
  return { json: JSON.stringify(result.json, null, 2), format: result.format };
}

export function NewMappingDialog({ onClose, onCreate }: NewMappingDialogProps) {
  const [name, setName] = useState('New Mapping');
  const [description, setDescription] = useState('');
  const [sourceJson, setSourceJson] = useState('');
  const [targetJson, setTargetJson] = useState('');
  const [exampleJson, setExampleJson] = useState('');
  const [sourceFormat, setSourceFormat] = useState<string | null>(null);
  const [targetFormat, setTargetFormat] = useState<string | null>(null);
  const [exampleFormat, setExampleFormat] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldError>({});

  const sourceFileRef = useRef<HTMLInputElement>(null);
  const targetFileRef = useRef<HTMLInputElement>(null);
  const exampleFileRef = useRef<HTMLInputElement>(null);

  async function handleSchemaFileLoad(
    file: File,
    setter: (v: string) => void,
    formatSetter: (f: string | null) => void,
    key: keyof FieldError,
  ) {
    try {
      const { json, format } = await loadSchemaFile(file);
      setter(json);
      formatSetter(format);
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    } catch (err: unknown) {
      setErrors((prev) => ({ ...prev, [key]: err instanceof Error ? err.message : String(err) }));
    }
  }

  async function handleDataFileLoad(
    file: File,
    setter: (v: string) => void,
    formatSetter: (f: string | null) => void,
    key: keyof FieldError,
  ) {
    try {
      // Pass the already-loaded source schema so non-JSON/non-XML formats can
      // use its field names to map raw data values correctly.
      let schema: unknown;
      try { schema = sourceJson.trim() ? JSON.parse(sourceJson) : undefined; } catch { /* ignore */ }
      const { json, format } = await loadDataFile(file, schema);
      setter(json);
      formatSetter(format);
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    } catch (err: unknown) {
      setErrors((prev) => ({ ...prev, [key]: err instanceof Error ? err.message : String(err) }));
    }
  }

  function validate(): boolean {
    const errs: FieldError = {};
    if (sourceJson.trim()) {
      try { JSON.parse(sourceJson); } catch { errs.source = 'Invalid JSON'; }
    }
    if (targetJson.trim()) {
      try { JSON.parse(targetJson); } catch { errs.target = 'Invalid JSON'; }
    }
    if (exampleJson.trim()) {
      try { JSON.parse(exampleJson); } catch { errs.example = 'Invalid JSON'; }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleCreate() {
    if (!validate()) return;
    onCreate({
      name: name.trim() || 'New Mapping',
      description,
      sourceSchema: sourceJson.trim() ? JSON.parse(sourceJson) : null,
      targetSchema: targetJson.trim() ? JSON.parse(targetJson) : null,
      exampleData: exampleJson.trim() ? JSON.parse(exampleJson) : null,
      rules: [],
      groovyScript: '',
    });
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="dialog-overlay" onClick={onClose} onKeyDown={handleKeyDown} role="presentation">
      <div
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="dialog-header">
          <h2 className="dialog-title" id="dialog-title">New Mapping</h2>
          <button className="dialog-close btn btn-secondary btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="dialog-body">
          <div className="dialog-field">
            <label className="dialog-label" htmlFor="dlg-name">Name</label>
            <input
              id="dlg-name"
              className="dialog-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mapping name…"
            />
          </div>

          <div className="dialog-field">
            <label className="dialog-label" htmlFor="dlg-desc">Description</label>
            <input
              id="dlg-desc"
              className="dialog-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
            />
          </div>

          {/* Source Schema */}
          <div className="dialog-field">
            <label className="dialog-label">
              Source Schema <span className="dialog-optional">(optional — JSON, XSD, SAP parser file, CSV)</span>
            </label>
            <div className="dialog-file-row">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => sourceFileRef.current?.click()}
              >
                📂 Load Schema File
              </button>
              {sourceFormat && (
                <span className="dialog-format-badge">Detected: {sourceFormat}</span>
              )}
              <input
                ref={sourceFileRef}
                type="file"
                accept={SCHEMA_FILE_ACCEPT}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSchemaFileLoad(f, setSourceJson, setSourceFormat, 'source');
                  e.target.value = '';
                }}
              />
            </div>
            <textarea
              className="dialog-textarea"
              value={sourceJson}
              onChange={(e) => { setSourceJson(e.target.value); setSourceFormat(null); }}
              placeholder={'{\n  "field": "value"\n}'}
              rows={4}
              spellCheck={false}
            />
            {errors.source && <div className="error-text">{errors.source}</div>}
          </div>

          {/* Target Schema */}
          <div className="dialog-field">
            <label className="dialog-label">
              Target Schema <span className="dialog-optional">(optional — JSON, XSD, SAP parser file, CSV)</span>
            </label>
            <div className="dialog-file-row">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => targetFileRef.current?.click()}
              >
                📂 Load Schema File
              </button>
              {targetFormat && (
                <span className="dialog-format-badge">Detected: {targetFormat}</span>
              )}
              <input
                ref={targetFileRef}
                type="file"
                accept={SCHEMA_FILE_ACCEPT}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSchemaFileLoad(f, setTargetJson, setTargetFormat, 'target');
                  e.target.value = '';
                }}
              />
            </div>
            <textarea
              className="dialog-textarea"
              value={targetJson}
              onChange={(e) => { setTargetJson(e.target.value); setTargetFormat(null); }}
              placeholder={'{\n  "field": "value"\n}'}
              rows={4}
              spellCheck={false}
            />
            {errors.target && <div className="error-text">{errors.target}</div>}
          </div>

          {/* Example Source Data */}
          <div className="dialog-field">
            <label className="dialog-label">
              Example Source Data <span className="dialog-optional">(optional — JSON, XML, CSV, SAP parser file — auto-converted to JSON)</span>
            </label>
            <div className="dialog-file-row">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => exampleFileRef.current?.click()}
              >
                📂 Load Data File
              </button>
              {exampleFormat && (
                <span className="dialog-format-badge">Detected: {exampleFormat}</span>
              )}
              <input
                ref={exampleFileRef}
                type="file"
                accept={DATA_FILE_ACCEPT}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleDataFileLoad(f, setExampleJson, setExampleFormat, 'example');
                  e.target.value = '';
                }}
              />
            </div>
            <textarea
              className="dialog-textarea"
              value={exampleJson}
              onChange={(e) => { setExampleJson(e.target.value); setExampleFormat(null); }}
              placeholder={'{\n  "field": "value"\n}'}
              rows={4}
              spellCheck={false}
            />
            {errors.example && <div className="error-text">{errors.example}</div>}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate}>Create Mapping</button>
        </div>
      </div>
    </div>
  );
}
