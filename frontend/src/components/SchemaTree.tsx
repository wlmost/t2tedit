import type { SchemaField } from '../types';

const TYPE_ICONS: Record<string, string> = {
  string: '📝',
  number: '🔢',
  integer: '🔢',
  boolean: '🔘',
  array: '📋',
  object: '📦',
};

interface SchemaTreeProps {
  fields: SchemaField[];
  onSelect: (field: SchemaField) => void;
  selectedPath?: string;
  title: string;
}

interface FieldNodeProps {
  field: SchemaField;
  onSelect: (field: SchemaField) => void;
  selectedPath?: string;
  depth: number;
}

function FieldNode({ field, onSelect, selectedPath, depth }: FieldNodeProps) {
  const isSelected = field.path === selectedPath;
  const icon = TYPE_ICONS[field.type] ?? '❓';

  return (
    <div className="schema-field-node">
      <div
        className={`schema-field-row${isSelected ? ' schema-field-selected' : ''}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onSelect(field)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect(field)}
      >
        <span className="schema-field-icon">{icon}</span>
        <span className="schema-field-name">{field.name}</span>
        <span className={`schema-field-type type-${field.type}`}>{field.type}</span>
        {field.required && <span className="schema-field-required">*</span>}
      </div>
      {field.children?.map((child) => (
        <FieldNode
          key={child.path}
          field={child}
          onSelect={onSelect}
          selectedPath={selectedPath}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function SchemaTree({ fields, onSelect, selectedPath, title }: SchemaTreeProps) {
  return (
    <div className="schema-tree">
      <div className="schema-tree-title">{title}</div>
      {fields.length === 0 ? (
        <div className="schema-tree-empty">No fields. Paste JSON above and parse schema.</div>
      ) : (
        <div className="schema-tree-list">
          {fields.map((field) => (
            <FieldNode
              key={field.path}
              field={field}
              onSelect={onSelect}
              selectedPath={selectedPath}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
