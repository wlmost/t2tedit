import { useRef, useState } from 'react';
import type { Mapping } from '../types';

interface NewMappingDialogProps {
  onClose: () => void;
  onCreate: (mapping: Omit<Mapping, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

type FieldError = { source?: string; target?: string; example?: string };

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function NewMappingDialog({ onClose, onCreate }: NewMappingDialogProps) {
  const [name, setName] = useState('New Mapping');
  const [description, setDescription] = useState('');
  const [sourceJson, setSourceJson] = useState('');
  const [targetJson, setTargetJson] = useState('');
  const [exampleJson, setExampleJson] = useState('');
  const [errors, setErrors] = useState<FieldError>({});

  const sourceFileRef = useRef<HTMLInputElement>(null);
  const targetFileRef = useRef<HTMLInputElement>(null);
  const exampleFileRef = useRef<HTMLInputElement>(null);

  async function handleFileLoad(
    file: File,
    setter: (v: string) => void,
    key: keyof FieldError,
  ) {
    try {
      const text = await readFileAsText(file);
      setter(text);
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    } catch {
      setErrors((prev) => ({ ...prev, [key]: 'Failed to read file' }));
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

          <div className="dialog-field">
            <label className="dialog-label">
              Source Schema JSON <span className="dialog-optional">(optional)</span>
            </label>
            <div className="dialog-file-row">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => sourceFileRef.current?.click()}
              >
                📂 Load JSON File
              </button>
              <input
                ref={sourceFileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileLoad(f, setSourceJson, 'source');
                  e.target.value = '';
                }}
              />
            </div>
            <textarea
              className="dialog-textarea"
              value={sourceJson}
              onChange={(e) => setSourceJson(e.target.value)}
              placeholder={'{\n  "field": "value"\n}'}
              rows={4}
              spellCheck={false}
            />
            {errors.source && <div className="error-text">{errors.source}</div>}
          </div>

          <div className="dialog-field">
            <label className="dialog-label">
              Target Schema JSON <span className="dialog-optional">(optional)</span>
            </label>
            <div className="dialog-file-row">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => targetFileRef.current?.click()}
              >
                📂 Load JSON File
              </button>
              <input
                ref={targetFileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileLoad(f, setTargetJson, 'target');
                  e.target.value = '';
                }}
              />
            </div>
            <textarea
              className="dialog-textarea"
              value={targetJson}
              onChange={(e) => setTargetJson(e.target.value)}
              placeholder={'{\n  "field": "value"\n}'}
              rows={4}
              spellCheck={false}
            />
            {errors.target && <div className="error-text">{errors.target}</div>}
          </div>

          <div className="dialog-field">
            <label className="dialog-label">
              Example Source Data <span className="dialog-optional">(optional — pre-fills input panels)</span>
            </label>
            <div className="dialog-file-row">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => exampleFileRef.current?.click()}
              >
                📂 Load JSON File
              </button>
              <input
                ref={exampleFileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileLoad(f, setExampleJson, 'example');
                  e.target.value = '';
                }}
              />
            </div>
            <textarea
              className="dialog-textarea"
              value={exampleJson}
              onChange={(e) => setExampleJson(e.target.value)}
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
