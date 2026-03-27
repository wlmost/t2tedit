import { useState, useEffect, useRef } from 'react';
import { api } from './api';
import type { Mapping } from './types';
import { MappingList } from './components/MappingList';
import { MappingEditor } from './components/MappingEditor';
import { NewMappingDialog } from './components/NewMappingDialog';
import { HelpDialog } from './components/HelpDialog';
import { mappingToGroovyFile, parseGroovyFile, downloadTextFile, mappingFilename } from './mappingFile';
import {
  SA660_SOURCE,
  IDOC_DC40_TARGET,
  DEMO_MAPPING_NAME,
  DEMO_MAPPING_DESCRIPTION,
  DEMO_RULES,
  DEMO_GROOVY_SCRIPT,
} from './sampleData';
import './App.css';

function App() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [groovyStatus, setGroovyStatus] = useState<{ available: boolean; version?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api.listMappings().then(setMappings).catch(() => setLoadError('Failed to load mappings')),
      api.groovyStatus().then(setGroovyStatus).catch(() => setGroovyStatus({ available: false })),
    ]).finally(() => setLoading(false));
  }, []);

  // Close file menu when clicking outside it
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    }
    if (fileMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fileMenuOpen]);

  const selectedMapping = mappings.find((m) => m.id === selectedId);

  function handleCreate() {
    setShowNewDialog(true);
    setFileMenuOpen(false);
  }

  function handleCreateWithSchemas(partial: Omit<Mapping, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const blank: Mapping = { id: '', createdAt: now, updatedAt: now, ...partial };
    setMappings((prev) => [blank, ...prev]);
    setSelectedId('');
  }

  function handleLoadDemo() {
    const demo: Mapping = {
      id: '',
      name: DEMO_MAPPING_NAME,
      description: DEMO_MAPPING_DESCRIPTION,
      sourceSchema: SA660_SOURCE,
      targetSchema: IDOC_DC40_TARGET,
      rules: DEMO_RULES,
      groovyScript: DEMO_GROOVY_SCRIPT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMappings((prev) => [demo, ...prev.filter((m) => m.id !== '' || m.name !== DEMO_MAPPING_NAME)]);
    setSelectedId('');
    setFileMenuOpen(false);
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
    } catch (err: unknown) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
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

  /** Export the currently selected mapping as a .groovy file (browser download). */
  function handleSaveToFile() {
    if (!selectedMapping) return;
    const content = mappingToGroovyFile(selectedMapping);
    downloadTextFile(mappingFilename(selectedMapping.name), content);
    setFileMenuOpen(false);
  }

  /** Load a mapping from an uploaded .groovy file. */
  function handleOpenFile() {
    fileInputRef.current?.click();
    setFileMenuOpen(false);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const parsed = parseGroovyFile(text);
      const now = new Date().toISOString();
      const loaded: Mapping = {
        id: '',
        name: parsed.name,
        description: parsed.description,
        sourceSchema: parsed.sourceSchema,
        targetSchema: parsed.targetSchema,
        exampleData: parsed.exampleData,
        groovyScript: parsed.groovyScript,
        rules: [],
        createdAt: now,
        updatedAt: now,
      };
      setMappings((prev) => [loaded, ...prev]);
      setSelectedId('');
    } catch (err: unknown) {
      alert(`Failed to load file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">t2tedit — Mapping Editor</span>

        {/* File menu */}
        <div className="file-menu" ref={fileMenuRef}>
          <button
            className="btn file-menu-btn"
            onClick={() => setFileMenuOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={fileMenuOpen}
          >
            File ▾
          </button>
          {fileMenuOpen && (
            <ul className="file-menu-dropdown" role="menu">
              <li role="menuitem">
                <button className="file-menu-item" onClick={handleCreate}>
                  📄 New Mapping…
                </button>
              </li>
              <li role="menuitem">
                <button className="file-menu-item" onClick={handleOpenFile}>
                  📂 Open Mapping File…
                </button>
              </li>
              <li role="menuitem">
                <button
                  className="file-menu-item"
                  onClick={handleSaveToFile}
                  disabled={!selectedMapping}
                  title={!selectedMapping ? 'No mapping selected' : undefined}
                >
                  💾 Save Mapping to File
                </button>
              </li>
              <li className="file-menu-separator" role="separator" />
              <li role="menuitem">
                <button className="file-menu-item" onClick={handleLoadDemo}>
                  ▶ Load SA660 → IDoc Demo
                </button>
              </li>
            </ul>
          )}
          {/* Hidden file input for opening mapping files */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".groovy,.txt"
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />
        </div>

        <div className="header-right">
          <div className="groovy-status">
            {groovyStatus === null ? (
              <span className="groovy-loading">Checking Groovy…</span>
            ) : groovyStatus.available ? (
              <span className="groovy-ok">● Groovy {groovyStatus.version ?? ''}</span>
            ) : (
              <span className="groovy-unavailable">● Groovy unavailable</span>
            )}
          </div>

          <button
            className="btn help-btn"
            onClick={() => setShowHelpDialog(true)}
            aria-label="Hilfe öffnen"
            title="Hilfe"
          >
            ❓ Hilfe
          </button>
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
              onLoadDemo={handleLoadDemo}
              onDelete={handleDelete}
            />
          )}
          {loadError && <div className="error-text">{loadError}</div>}
        </aside>

        <main className="app-main">
          {selectedMapping !== undefined ? (
            <MappingEditor
              key={selectedMapping.id}
              mapping={selectedMapping}
              onSave={handleSave}
            />
          ) : (
            <div className="no-selection">
              <p>Select a mapping from the sidebar, or use <strong>File → New Mapping…</strong> to create one.</p>
            </div>
          )}
        </main>
      </div>

      {showNewDialog && (
        <NewMappingDialog
          onClose={() => setShowNewDialog(false)}
          onCreate={handleCreateWithSchemas}
        />
      )}

      {showHelpDialog && <HelpDialog onClose={() => setShowHelpDialog(false)} />}
    </div>
  );
}

export default App;

