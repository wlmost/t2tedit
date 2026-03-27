import { useState, useMemo } from 'react';

interface HelpSection {
  id: string;
  title: string;
  content: string[];
  subsections?: { title: string; content: string[] }[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'overview',
    title: '🗺️ Übersicht',
    content: [
      'Der t2tedit Mapping Editor ermöglicht es Ihnen, Datentransformationen zwischen verschiedenen Formaten zu definieren und auszuführen. Sie legen fest, wie Felder aus einer Quelldatenstruktur (Source) auf eine Zielstruktur (Target) übertragen und umgewandelt werden.',
      'Ein Mapping besteht aus:',
      '• Quellschema (Source Schema) – die Struktur der Eingabedaten',
      '• Zielschema (Target Schema) – die gewünschte Struktur der Ausgabedaten',
      '• Transformationsregeln – Vorschriften, wie Quellfelder in Zielfelder überführt werden',
      '• Groovy-Skript (optional) – ein vollständiges Skript für komplexe Transformationen',
    ],
  },
  {
    id: 'quickstart',
    title: '🚀 Schnellstart',
    content: [
      'Führen Sie die folgenden Schritte aus, um schnell ein erstes Mapping zu erstellen:',
    ],
    subsections: [
      {
        title: 'Schritt 1 – Demo laden',
        content: [
          'Klicken Sie auf „File" → „▶ Load SA660 → IDoc Demo", um ein vollständiges Beispiel-Mapping zu laden. Es zeigt eine Transformation von einem SA660-Format in ein SAP-IDoc-Format (DELVRY03).',
        ],
      },
      {
        title: 'Schritt 2 – Neues Mapping erstellen',
        content: [
          'Klicken Sie auf „File" → „📄 New Mapping…" oder auf den Button „+ Neues Mapping" in der Seitenleiste.',
          'Geben Sie einen Namen und eine Beschreibung ein.',
          'Laden Sie optional Ihr Quell- und Zielschema als JSON, XSD, CSV oder SAP-Parser-Datei hoch.',
          'Klicken Sie auf „Erstellen", um das Mapping anzulegen.',
        ],
      },
      {
        title: 'Schritt 3 – Regeln definieren',
        content: [
          'Wählen Sie das neue Mapping in der Seitenleiste aus.',
          'Wechseln Sie zum Tab „Mapping", um Quell- und Zielfelder per Klick zuzuweisen.',
          'Oder öffnen Sie den Tab „Regeln", um Regeln direkt zu bearbeiten.',
        ],
      },
      {
        title: 'Schritt 4 – Transformation testen',
        content: [
          'Wechseln Sie zum Tab „Vorschau", geben Sie Beispieldaten ein und klicken Sie auf „Transformieren".',
        ],
      },
      {
        title: 'Schritt 5 – Speichern',
        content: [
          'Klicken Sie auf den „Speichern"-Button im Editor oder nutzen Sie „File" → „💾 Save Mapping to File", um das Mapping als Datei zu exportieren.',
        ],
      },
    ],
  },
  {
    id: 'file-menu',
    title: '📂 Datei-Menü',
    content: [
      'Das Datei-Menü befindet sich oben links in der Kopfzeile. Es enthält folgende Funktionen:',
      '• 📄 New Mapping… – Erstellt ein neues Mapping mit optionalem Schema-Import.',
      '• 📂 Open Mapping File… – Lädt ein zuvor gespeichertes Mapping aus einer .groovy-Datei.',
      '• 💾 Save Mapping to File – Exportiert das aktuell ausgewählte Mapping als .groovy-Datei (Nur aktiv, wenn ein Mapping ausgewählt ist).',
      '• ▶ Load SA660 → IDoc Demo – Lädt ein vordefiniertes Beispiel-Mapping zur Demonstration.',
    ],
  },
  {
    id: 'new-mapping',
    title: '➕ Neues Mapping erstellen',
    content: [
      'Über den Dialog „Neues Mapping" legen Sie ein neues Mapping an. Folgende Felder sind verfügbar:',
      '• Name – Ein eindeutiger Name für das Mapping (Pflichtfeld).',
      '• Beschreibung – Eine optionale Beschreibung des Zwecks oder der Quelle.',
      '• Quellschema (Source Schema) – Das JSON-Schema der Eingabedaten. Sie können es direkt eingeben oder eine Datei hochladen. Unterstützte Formate: JSON, XSD, CSV-Header, SAP-IDoc-Parser-Datei.',
      '• Zielschema (Target Schema) – Das JSON-Schema der gewünschten Ausgabestruktur. Gleiche Formate wie beim Quellschema.',
      '• Beispieldaten (optional) – Testdaten im JSON-Format für die Vorschau. Können ebenfalls aus einer Datei geladen werden.',
    ],
    subsections: [
      {
        title: 'Schema-Formate',
        content: [
          'JSON-Schema – Direkt als JSON-Objekt eingeben oder hochladen.',
          'XSD – XML Schema Definition; wird automatisch in ein JSON-Schema konvertiert.',
          'CSV – Eine Zeile mit Spaltennamen; jede Spalte wird als String-Feld übernommen.',
          'SAP-IDoc-Parser-Datei (.p, .par) – Wird in ein JSON-Schema mit Segmenten und Feldern umgewandelt.',
          't2tedit-Schema – Eigenes Format mit cfg/structure/segments-Aufbau.',
        ],
      },
    ],
  },
  {
    id: 'mapping-tab',
    title: '🔗 Tab: Mapping',
    content: [
      'Der Mapping-Tab zeigt das Quell- und Zielschema als Baumstruktur nebeneinander an. In der Mitte befinden sich die bereits definierten Regeln.',
      'So weisen Sie Felder zu:',
      '1. Klicken Sie ein Quellfeld im linken Baum an – es wird blau hervorgehoben.',
      '2. Klicken Sie ein Zielfeld im rechten Baum an – eine neue Regel wird automatisch erstellt.',
      '3. Die Regel erscheint in der Mitte als Karte mit Pfeil (Quelle → Ziel).',
      'Tipp: Halten Sie die Maus über eine Regelkarte, um Bearbeitungsoptionen zu sehen.',
    ],
  },
  {
    id: 'rules-tab',
    title: '📋 Tab: Regeln',
    content: [
      'Im Regeln-Tab werden alle Transformationsregeln tabellarisch aufgelistet. Jede Regel hat folgende Eigenschaften:',
      '• Quellpfad (sourcePath) – Der JSON-Pfad des Quellfeldes (z. B. „header.orderId").',
      '• Zielpfad (targetPath) – Der JSON-Pfad des Zielfeldes.',
      '• Transformationstyp – Wie das Feld transformiert wird (direkt, Template oder Groovy).',
    ],
    subsections: [
      {
        title: 'Transformationstypen',
        content: [
          '🔵 direkt – Der Wert des Quellfeldes wird unverändert in das Zielfeld kopiert. Geeignet für einfache 1:1-Zuweisungen.',
          '🟣 template – Der Wert wird anhand eines Ausdrucks berechnet. Verwenden Sie „${feldname}" als Platzhalter für Quellwerte. Beispiel: „Bestellung Nr. ${orderId} von ${customerName}".',
          '🟡 groovy – Ein Groovy-Skriptausdruck wird ausgewertet. Nutzen Sie dies für komplexe Transformationen wie Berechnungen, Datumsformatierungen oder bedingte Logik. Beispiel: „source.price * 1.19" für die Mehrwertsteuerberechnung.',
        ],
      },
      {
        title: 'Konstante Werte zuweisen',
        content: [
          'Um einem Zielfeld immer denselben festen Wert zuzuweisen (unabhängig vom Quellinhalt), verwenden Sie den Typ template – aber ohne den Platzhalter {{value}}:',
          '• Typ: template',
          '• Quellpfad: beliebig (z. B. das erste verfügbare Quellfeld)',
          '• Template: einfach den gewünschten Konstantwert eintragen, z. B. „EUR" oder „AKTIV"',
          'Da kein {{value}}-Platzhalter vorhanden ist, wird der Template-Text direkt als Wert übernommen – der Quellwert wird ignoriert.',
          'Alternativ kann auch der Typ groovy mit einem Literal-Ausdruck verwendet werden, z. B.: return "EUR"',
        ],
      },
      {
        title: 'Regeln bearbeiten',
        content: [
          'Klicken Sie auf „✏️ Bearbeiten" in einer Regelzeile, um die Felder zu ändern.',
          'Klicken Sie auf „🗑️ Löschen", um eine Regel zu entfernen.',
          'Neue Regeln können über die Schaltfläche „+ Regel hinzufügen" oben im Tab erstellt werden.',
        ],
      },
    ],
  },
  {
    id: 'preview-tab',
    title: '👁️ Tab: Vorschau',
    content: [
      'Der Vorschau-Tab ermöglicht es Ihnen, Ihre Transformation mit echten oder Testdaten auszuprobieren.',
      'Vorgehensweise:',
      '1. Geben Sie Beispieldaten als JSON im linken Bereich ein (oder laden Sie sie beim Erstellen des Mappings hoch).',
      '2. Klicken Sie auf „Transformieren".',
      '3. Das Ergebnis erscheint im rechten Bereich als JSON.',
      '4. Unterhalb des Ergebnisses werden Metadaten wie Transformationsdauer und eventuelle Fehler angezeigt.',
      'Hinweis: Die Transformation wird auf dem Server ausgeführt. Stellen Sie sicher, dass der Server erreichbar ist.',
    ],
  },
  {
    id: 'script-tab',
    title: '✍️ Tab: Groovy-Skript',
    content: [
      'Im Skript-Tab können Sie ein vollständiges Groovy-Skript schreiben, das die gesamte Transformation steuert. Dies ist die flexibelste Methode und eignet sich für komplexe Geschäftslogik.',
      'Die verfügbaren Variablen im Skript:',
      '• source – Das Eingabeobjekt als Map. Zugriff auf Felder: source.feldname oder source["feldname"].',
      '• target {} – Ein Builder zum Aufbau der Ausgabestruktur.',
      'Beispiel-Skript:',
      '  target {',
      '    orderId source.id',
      '    totalPrice source.price * 1.19',
      '    customerName "${source.firstName} ${source.lastName}"',
      '  }',
      'Klicken Sie auf „▶ Ausführen", um das Skript mit den Eingabedaten zu testen.',
    ],
    subsections: [
      {
        title: 'Segment-Iteration (für SAP-IDoc-Formate)',
        content: [
          'Für SAP-IDoc-Quelldaten steht eine spezielle Methode zur Verfügung:',
          'source.forEach("SEGMENTNAME") { seg -> ... }',
          'Dies iteriert über alle Segmente eines bestimmten Typs.',
          'Alle anderen Map-Operationen (get, containsKey usw.) funktionieren ebenfalls auf source.',
        ],
      },
      {
        title: 'Groovy-Verfügbarkeit',
        content: [
          'Oben rechts in der Kopfzeile sehen Sie den Groovy-Status:',
          '● Grün – Groovy ist verfügbar (Version wird angezeigt). Skript-Transformationen funktionieren.',
          '● Rot – Groovy ist nicht verfügbar. Nur direkte und Template-Transformationen stehen zur Verfügung.',
          'Groovy erfordert eine Java-Laufzeitumgebung (JRE) auf dem Server.',
        ],
      },
    ],
  },
  {
    id: 'save-load',
    title: '💾 Speichern & Laden',
    content: [
      'Mappings können auf zwei Arten gespeichert werden:',
    ],
    subsections: [
      {
        title: 'Server-Speicherung',
        content: [
          'Klicken Sie im Editor auf „Speichern". Das Mapping wird auf dem Server gespeichert und steht beim nächsten Start automatisch zur Verfügung.',
          'Gespeicherte Mappings erscheinen in der Seitenleiste.',
        ],
      },
      {
        title: 'Datei-Export/-Import',
        content: [
          'Export: „File" → „💾 Save Mapping to File" exportiert das Mapping als .groovy-Datei auf Ihren Computer.',
          'Import: „File" → „📂 Open Mapping File…" lädt eine zuvor exportierte .groovy-Datei.',
          'Die .groovy-Datei enthält alle Mapping-Informationen: Name, Beschreibung, Schemata, Regeln und das Groovy-Skript.',
        ],
      },
    ],
  },
  {
    id: 'examples',
    title: '💡 Beispiele',
    content: [],
    subsections: [
      {
        title: 'Beispiel 1: Einfache 1:1-Zuweisung',
        content: [
          'Quellfeld: customer.name',
          'Zielfeld: recipient.fullName',
          'Typ: direkt',
          'Ergebnis: Der Wert von customer.name wird direkt in recipient.fullName übertragen.',
        ],
      },
      {
        title: 'Beispiel 2: Textzusammensetzung mit Template',
        content: [
          'Quellfeld: (kein einzelnes Feld)',
          'Zielfeld: address.label',
          'Typ: template',
          'Ausdruck: ${street} ${houseNo}, ${zip} ${city}',
          'Ergebnis: Die Adresse wird aus mehreren Quellfeldern zusammengesetzt.',
        ],
      },
      {
        title: 'Beispiel 3: Berechnung mit Groovy',
        content: [
          'Quellfeld: order.netPrice',
          'Zielfeld: order.grossPrice',
          'Typ: groovy',
          'Ausdruck: source.netPrice * 1.19',
          'Ergebnis: Der Bruttopreis wird aus dem Nettopreis berechnet (19% MwSt.).',
        ],
      },
      {
        title: 'Beispiel 4: Datumsformatierung mit Groovy',
        content: [
          'Quellfeld: order.date',
          'Zielfeld: idoc.BLDAT',
          'Typ: groovy',
          'Ausdruck: source.date?.replaceAll("-", "")',
          'Ergebnis: Das Datum „2024-03-15" wird zu „20240315" (SAP-IDoc-Format) umgewandelt.',
        ],
      },
      {
        title: 'Beispiel 5: Konstanten Wert zuweisen',
        content: [
          'Quellfeld: (beliebig, z. B. order.id)',
          'Zielfeld: invoice.currency',
          'Typ: template',
          'Template: EUR',
          'Ergebnis: Das Zielfeld invoice.currency erhält immer den festen Wert „EUR", unabhängig vom Quellinhalt.',
        ],
      },
    ],
  },
  {
    id: 'tips',
    title: '🔧 Tipps & Hinweise',
    content: [
      '• JSON-Pfade: Verwenden Sie Punkt-Notation für verschachtelte Felder (z. B. „order.items.0.price").',
      '• Schemas testen: Klicken Sie im Mapping-Tab auf „Parse Schema", um das Schema erneut zu interpretieren.',
      '• Groovy-Fehler: Schauen Sie in den Ausgabebereich des Skript-Tabs für detaillierte Fehlermeldungen.',
      '• Demo-Mapping: Das Demo-Mapping (SA660 → IDoc) ist ein hervorragendes Lernbeispiel für komplexe Transformationen.',
      '• Leeres Mapping: Ein Mapping ohne ID (noch nicht gespeichert) wird mit einem grauen Eintrag in der Seitenleiste angezeigt.',
      '• Mehrere Mappings: Sie können beliebig viele Mappings anlegen und zwischen ihnen wechseln.',
    ],
  },
];

interface HelpDialogProps {
  onClose: () => void;
}

function sectionMatchesQuery(sec: HelpSection, q: string): boolean {
  return (
    sec.title.toLowerCase().includes(q) ||
    sec.content.some((line) => line.toLowerCase().includes(q)) ||
    (sec.subsections?.some(
      (sub) =>
        sub.title.toLowerCase().includes(q) ||
        sub.content.some((line) => line.toLowerCase().includes(q)),
    ) ?? false)
  );
}

export function HelpDialog({ onClose }: HelpDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string>(HELP_SECTIONS[0].id);

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return HELP_SECTIONS;
    return HELP_SECTIONS.filter((sec) => sectionMatchesQuery(sec, q));
  }, [searchQuery]);

  const currentSection =
    filteredSections.find((s) => s.id === activeSection) ?? filteredSections[0];

  function handleSectionClick(id: string) {
    setActiveSection(id);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      const first = HELP_SECTIONS.find((sec) => sectionMatchesQuery(sec, lq));
      if (first) setActiveSection(first.id);
    }
  }

  function highlight(text: string): React.ReactNode {
    const q = searchQuery.trim();
    if (!q) return text;
    const lq = q.toLowerCase();
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;
    while (remaining.length > 0) {
      const idx = remaining.toLowerCase().indexOf(lq);
      if (idx === -1) {
        parts.push(remaining);
        break;
      }
      if (idx > 0) parts.push(remaining.slice(0, idx));
      parts.push(
        <mark key={key++} className="help-highlight">
          {remaining.slice(idx, idx + q.length)}
        </mark>,
      );
      remaining = remaining.slice(idx + q.length);
    }
    return <>{parts}</>;
  }

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-label="Hilfe">
      <div className="dialog help-dialog">
        <div className="dialog-header">
          <span className="dialog-title">❓ Hilfe — Mapping Editor</span>
          <button className="dialog-close" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        <div className="help-dialog-body">
          {/* Left nav */}
          <nav className="help-nav">
            <div className="help-search-wrap">
              <input
                className="help-search"
                type="search"
                placeholder="Hilfe durchsuchen…"
                value={searchQuery}
                onChange={handleSearchChange}
                aria-label="Hilfe durchsuchen"
                autoFocus
              />
            </div>
            <ul className="help-nav-list" role="menu">
              {filteredSections.length === 0 ? (
                <li className="help-nav-empty">Keine Ergebnisse</li>
              ) : (
                filteredSections.map((sec) => (
                  <li key={sec.id} role="menuitem">
                    <button
                      className={`help-nav-item${currentSection?.id === sec.id ? ' help-nav-item-active' : ''}`}
                      onClick={() => handleSectionClick(sec.id)}
                    >
                      {sec.title}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </nav>

          {/* Content area */}
          <article className="help-content">
            {currentSection ? (
              <>
                <h2 className="help-section-title">{currentSection.title}</h2>
                {currentSection.content.map((line, i) => (
                  <p key={i} className="help-paragraph">
                    {highlight(line)}
                  </p>
                ))}
                {currentSection.subsections?.map((sub) => (
                  <div key={sub.title} className="help-subsection">
                    <h3 className="help-subsection-title">{highlight(sub.title)}</h3>
                    {sub.content.map((line, i) => (
                      <p key={i} className="help-paragraph">
                        {highlight(line)}
                      </p>
                    ))}
                  </div>
                ))}
              </>
            ) : (
              <p className="help-paragraph">Keine Ergebnisse für „{searchQuery}".</p>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
