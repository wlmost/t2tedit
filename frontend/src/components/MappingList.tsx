import type { Mapping } from '../types';

interface MappingListProps {
  mappings: Mapping[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onLoadDemo: () => void;
  onDelete: (id: string) => void;
}

export function MappingList({ mappings, selectedId, onSelect, onCreate, onLoadDemo, onDelete }: MappingListProps) {
  return (
    <div className="mapping-list">
      <div className="mapping-list-header">
        <button className="btn btn-primary btn-full" onClick={onCreate}>+ New Mapping</button>
        <button className="btn btn-secondary btn-full mapping-demo-btn" onClick={onLoadDemo} title="Load SA660 → IDoc DELVRY03 demo">
          ▶ Load SA660 → IDoc Demo
        </button>
      </div>
      {mappings.length === 0 ? (
        <div className="mapping-list-empty">No mappings yet</div>
      ) : (
        <ul className="mapping-list-items">
          {mappings.map((m) => (
            <li
              key={m.id}
              className={`mapping-list-item${m.id === selectedId ? ' mapping-list-item-selected' : ''}`}
            >
              <span
                className="mapping-list-item-name"
                onClick={() => onSelect(m.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(m.id)}
              >
                {m.name || 'Untitled'}
              </span>
              <button
                className="btn btn-sm btn-danger mapping-list-delete"
                onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
                title="Delete mapping"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
