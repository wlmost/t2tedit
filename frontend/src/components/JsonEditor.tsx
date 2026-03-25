import { useState } from 'react';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  height?: number;
}

export function JsonEditor({ value, onChange, label, height = 200 }: JsonEditorProps) {
  const [error, setError] = useState<string | null>(null);

  function handleBlur() {
    if (!value.trim()) {
      setError(null);
      return;
    }
    try {
      const formatted = JSON.stringify(JSON.parse(value), null, 2);
      onChange(formatted);
      setError(null);
    } catch {
      setError('Invalid JSON');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    if (error) {
      try {
        JSON.parse(e.target.value);
        setError(null);
      } catch {
        // keep existing error until blur
      }
    }
  }

  return (
    <div className="json-editor">
      {label && <label className="json-editor-label">{label}</label>}
      <textarea
        className={`json-editor-textarea${error ? ' json-editor-error' : ''}`}
        style={{ height }}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        spellCheck={false}
      />
      {error && <span className="json-editor-error-msg">{error}</span>}
    </div>
  );
}
