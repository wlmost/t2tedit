import { useState } from 'react';
import type { MappingRule } from '../types';

interface RuleRowProps {
  rule: MappingRule;
  onUpdate: (rule: MappingRule) => void;
  onDelete: (id: string) => void;
}

export function RuleRow({ rule, onUpdate, onDelete }: RuleRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MappingRule>({ ...rule });

  function handleSave() {
    onUpdate(draft);
    setEditing(false);
  }

  function handleCancel() {
    setDraft({ ...rule });
    setEditing(false);
  }

  if (editing) {
    return (
      <tr className="rule-row rule-row-editing">
        <td>
          <input
            className="rule-input"
            value={draft.sourcePath}
            onChange={(e) => setDraft({ ...draft, sourcePath: e.target.value })}
            placeholder="source.path"
          />
        </td>
        <td>
          <select
            className="rule-select"
            value={draft.transform}
            onChange={(e) =>
              setDraft({ ...draft, transform: e.target.value as MappingRule['transform'] })
            }
          >
            <option value="direct">direct</option>
            <option value="groovy">groovy</option>
            <option value="template">template</option>
          </select>
          {draft.transform === 'groovy' && (
            <textarea
              className="rule-script-input"
              value={draft.groovyScript ?? ''}
              onChange={(e) => setDraft({ ...draft, groovyScript: e.target.value })}
              placeholder="Groovy script..."
              rows={3}
            />
          )}
          {draft.transform === 'template' && (
            <input
              className="rule-input"
              value={draft.template ?? ''}
              onChange={(e) => setDraft({ ...draft, template: e.target.value })}
              placeholder="Template string..."
            />
          )}
        </td>
        <td>
          <input
            className="rule-input"
            value={draft.targetPath}
            onChange={(e) => setDraft({ ...draft, targetPath: e.target.value })}
            placeholder="target.path"
          />
        </td>
        <td className="rule-actions">
          <button className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
          <button className="btn btn-sm btn-secondary" onClick={handleCancel}>Cancel</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="rule-row">
      <td className="rule-path">{rule.sourcePath || <em className="empty">—</em>}</td>
      <td>
        <span className={`transform-badge transform-${rule.transform}`}>{rule.transform}</span>
        {rule.transform === 'groovy' && rule.groovyScript && (
          <div className="rule-script-preview">{rule.groovyScript.slice(0, 60)}{rule.groovyScript.length > 60 ? '…' : ''}</div>
        )}
        {rule.transform === 'template' && rule.template && (
          <div className="rule-script-preview">{rule.template}</div>
        )}
      </td>
      <td className="rule-path">{rule.targetPath || <em className="empty">—</em>}</td>
      <td className="rule-actions">
        <button className="btn btn-sm btn-secondary" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn btn-sm btn-danger" onClick={() => onDelete(rule.id)}>Delete</button>
      </td>
    </tr>
  );
}
