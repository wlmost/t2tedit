import { useState, useEffect } from 'react';
import { api } from './api';
import type { Mapping } from './types';
import { MappingList } from './components/MappingList';
import { MappingEditor } from './components/MappingEditor';
import './App.css';

function newBlankMapping(): Mapping {
  return {
    id: '',
    name: 'New Mapping',
    description: '',
    sourceSchema: null,
    targetSchema: null,
    rules: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function App() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [groovyStatus, setGroovyStatus] = useState<{ available: boolean; version?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.listMappings().then(setMappings).catch(() => setLoadError('Failed to load mappings')),
      api.groovyStatus().then(setGroovyStatus).catch(() => setGroovyStatus({ available: false })),
    ]).finally(() => setLoading(false));
  }, []);

  const selectedMapping = mappings.find((m) => m.id === selectedId);

  function handleCreate() {
    const blank = newBlankMapping();
    setMappings((prev) => [blank, ...prev]);
    setSelectedId('');
  }

  function handleSelect(id: string) {
    setSelectedId(id);
  }

  async function handleDelete(id: string) {
    if (!id) {
      setMappings((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) setSelectedId(undefined);
      return;
    }
    try {
      await api.deleteMapping(id);
      setMappings((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) setSelectedId(undefined);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  async function handleSave(updated: Mapping) {
    if (!updated.id) {
      const created = await api.createMapping(updated);
      setMappings((prev) => [created, ...prev.filter((m) => m.id !== '')]);
      setSelectedId(created.id);
    } else {
      const saved = await api.updateMapping(updated.id, updated);
      setMappings((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">t2tedit — Mapping Editor</span>
        <div className="groovy-status">
          {groovyStatus === null ? (
            <span className="groovy-loading">Checking Groovy…</span>
          ) : groovyStatus.available ? (
            <span className="groovy-ok">● Groovy {groovyStatus.version ?? ''}</span>
          ) : (
            <span className="groovy-unavailable">● Groovy unavailable</span>
          )}
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          {loading ? (
            <div className="loading">Loading…</div>
          ) : (
            <MappingList
              mappings={mappings}
              selectedId={selectedId}
              onSelect={handleSelect}
              onCreate={handleCreate}
              onDelete={handleDelete}
            />
          )}
          {loadError && <div className="error-text">{loadError}</div>}
        </aside>

        <main className="app-main">
          {selectedMapping !== undefined ? (
            <MappingEditor key={selectedMapping.id} mapping={selectedMapping} onSave={handleSave} />
          ) : (
            <div className="no-selection">
              <p>Select a mapping from the sidebar or create a new one.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
