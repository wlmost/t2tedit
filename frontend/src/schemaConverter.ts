/**
 * schemaConverter.ts
 *
 * Converts various schema file formats into a plain JSON object suitable for
 * use as a source or target schema in t2tedit.  The resulting object mirrors
 * the structure of the actual data (field names → representative values) so
 * that it can be passed to the backend's /api/parse-schema endpoint.
 *
 * Supported formats:
 *  - JSON (.json)             → pass-through
 *  - XSD / XML Schema (.xsd)  → builds a representative JSON object from
 *                               xs:element / xs:complexType definitions
 *  - CSV (.csv)               → first row (header) becomes a flat JSON object
 *                               with empty-string field values
 *  - SAP flat-file parser files (.p, .par, .txt, .csv with SAP field notation)
 *      Recognised patterns:
 *        1. Semicolon/pipe-delimited field lists:
 *             fieldName;dataType;length  (e.g. SAP BODS / Data Services)
 *             fieldName|length|type|description
 *        2. INI-style segment blocks:
 *             [SegmentName]
 *             FieldName=Type(Length)
 *        3. SAP fixed-width positional format:
 *             segId;fieldName;start;length;type
 *             (e.g. SA660 parser file with one line per field)
 */

export type ConversionResult =
  | { ok: true; json: unknown; format: string }
  | { ok: false; error: string };

/**
 * Auto-detect the file format and convert to a plain JSON object.
 * @param filename  Original filename (used for extension hint).
 * @param content   Raw text content of the file.
 */
export function convertSchemaFile(filename: string, content: string): ConversionResult {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  // 1. Explicit JSON
  if (ext === 'json') {
    return convertJSON(content);
  }

  // 2. XSD
  if (ext === 'xsd' || content.trimStart().startsWith('<?xml') || isXSD(content)) {
    return convertXSD(content);
  }

  // 3. Try JSON anyway (no extension or .txt that happens to be JSON)
  const jsonTry = tryJSON(content);
  if (jsonTry !== null) {
    return { ok: true, json: jsonTry, format: 'JSON' };
  }

  // 4. SAP INI-style segment definition
  if (isSAPINI(content)) {
    return convertSAPINI(content);
  }

  // 5. SAP fixed-width positional format  (segments with numeric IDs as first token)
  if (isSAPPositional(content)) {
    return convertSAPPositional(content);
  }

  // 6. Delimiter-based (SAP BODS / CSV)
  return convertDelimited(content);
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

function convertJSON(content: string): ConversionResult {
  const json = tryJSON(content);
  if (json === null) return { ok: false, error: 'Invalid JSON' };
  return { ok: true, json, format: 'JSON' };
}

function tryJSON(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// XSD
// ---------------------------------------------------------------------------

function isXSD(content: string): boolean {
  return (
    content.includes('xs:schema') ||
    content.includes('xsd:schema') ||
    content.includes('XMLSchema')
  );
}

/**
 * Converts an XSD (XML Schema Definition) to a representative JSON object.
 * Simple elements are given empty-string or 0 placeholder values; complex
 * elements become nested objects.
 */
export function convertXSD(content: string): ConversionResult {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return { ok: false, error: `XML parse error: ${parseError.textContent?.trim().slice(0, 120) ?? 'unknown'}` };
    }

    // Resolve the XSD namespace prefix (xs: or xsd: or no prefix)
    const schemaEl = doc.documentElement;
    const nsPrefix = resolveXSPrefix(schemaEl);

    // Build a lookup for named complex types so we can resolve $ref-like references
    const namedTypes = new Map<string, Element>();
    for (const ct of Array.from(doc.getElementsByTagNameNS('*', 'complexType'))) {
      const name = ct.getAttribute('name');
      if (name) namedTypes.set(name, ct);
    }

    // Process top-level elements
    const result: Record<string, unknown> = {};
    const topElements = Array.from(schemaEl.children).filter(
      (c) => localName(c) === 'element',
    );

    if (topElements.length === 1) {
      // Single root element: unwrap it
      const child = xsdElementToJSON(topElements[0], nsPrefix, namedTypes, 0);
      const elName = topElements[0].getAttribute('name') ?? 'root';
      if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
        return { ok: true, json: { [elName]: child }, format: 'XSD' };
      }
      return { ok: true, json: { [elName]: child ?? '' }, format: 'XSD' };
    }

    for (const el of topElements) {
      const name = el.getAttribute('name');
      if (!name) continue;
      result[name] = xsdElementToJSON(el, nsPrefix, namedTypes, 0) ?? '';
    }

    if (Object.keys(result).length === 0) {
      return { ok: false, error: 'No elements found in XSD' };
    }
    return { ok: true, json: result, format: 'XSD' };
  } catch (e: unknown) {
    return { ok: false, error: `XSD conversion failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function localName(el: Element): string {
  return el.localName ?? el.nodeName.replace(/^.*:/, '');
}

function resolveXSPrefix(schemaEl: Element): string {
  // Try namespace-aware approach first
  const attrs = Array.from(schemaEl.attributes);
  for (const attr of attrs) {
    if (
      attr.value === 'http://www.w3.org/2001/XMLSchema' &&
      attr.name.startsWith('xmlns:')
    ) {
      return attr.name.slice(6) + ':';
    }
    if (attr.value === 'http://www.w3.org/2001/XMLSchema' && attr.name === 'xmlns') {
      return '';
    }
  }
  // Fallback: detect from element names in document
  if (schemaEl.nodeName.startsWith('xs:')) return 'xs:';
  if (schemaEl.nodeName.startsWith('xsd:')) return 'xsd:';
  return 'xs:';
}

function xsdElementToJSON(
  el: Element,
  nsPrefix: string,
  namedTypes: Map<string, Element>,
  depth: number,
): unknown {
  if (depth > 20) return '';

  // Resolve type reference
  const typeRef = el.getAttribute('type');
  if (typeRef) {
    const stripped = typeRef.includes(':') ? typeRef.split(':')[1] : typeRef;
    // Primitive types
    if (isXSDPrimitive(stripped)) return xsdPrimitiveDefault(stripped);
    // Named complex type reference
    const named = namedTypes.get(stripped) ?? namedTypes.get(typeRef);
    if (named) return xsdComplexTypeToJSON(named, nsPrefix, namedTypes, depth + 1);
  }

  // Inline complex type
  const complexChildren = Array.from(el.children).filter(
    (c) => localName(c) === 'complexType',
  );
  if (complexChildren.length > 0) {
    return xsdComplexTypeToJSON(complexChildren[0], nsPrefix, namedTypes, depth + 1);
  }

  // Inline simple type
  const simpleChildren = Array.from(el.children).filter(
    (c) => localName(c) === 'simpleType',
  );
  if (simpleChildren.length > 0) {
    return '';
  }

  // Default: treat as string
  return '';
}

function xsdComplexTypeToJSON(
  ct: Element,
  nsPrefix: string,
  namedTypes: Map<string, Element>,
  depth: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Walk sequence / all / choice
  const containers = ['sequence', 'all', 'choice', 'complexContent', 'simpleContent'];
  const queue: Element[] = [ct];
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const child of Array.from(node.children)) {
      const ln = localName(child);
      if (ln === 'element') {
        const name = child.getAttribute('name');
        if (name) {
          result[name] = xsdElementToJSON(child, nsPrefix, namedTypes, depth + 1);
        }
      } else if (ln === 'attribute') {
        const name = child.getAttribute('name');
        if (name) result[`@${name}`] = '';
      } else if (ln === 'extension' || ln === 'restriction') {
        queue.push(child);
      } else if (containers.includes(ln)) {
        queue.push(child);
      }
    }
  }

  return result;
}

function isXSDPrimitive(typeName: string): boolean {
  return [
    'string', 'normalizedString', 'token', 'language', 'Name', 'NCName',
    'ID', 'IDREF', 'ENTITY', 'NMTOKEN', 'anyURI', 'base64Binary', 'hexBinary',
    'integer', 'long', 'int', 'short', 'byte', 'nonNegativeInteger',
    'positiveInteger', 'unsignedLong', 'unsignedInt', 'unsignedShort', 'unsignedByte',
    'nonPositiveInteger', 'negativeInteger', 'decimal', 'float', 'double',
    'boolean', 'date', 'time', 'dateTime', 'duration', 'gYear', 'gYearMonth',
    'gMonth', 'gMonthDay', 'gDay', 'QName', 'NOTATION', 'anyType',
  ].includes(typeName);
}

function xsdPrimitiveDefault(typeName: string): unknown {
  if (['integer', 'long', 'int', 'short', 'byte', 'decimal', 'float', 'double',
       'nonNegativeInteger', 'positiveInteger', 'unsignedLong', 'unsignedInt',
       'unsignedShort', 'unsignedByte', 'nonPositiveInteger', 'negativeInteger'].includes(typeName)) {
    return 0;
  }
  if (typeName === 'boolean') return false;
  if (typeName === 'date') return '2000-01-01';
  if (typeName === 'dateTime') return '2000-01-01T00:00:00Z';
  return '';
}

// ---------------------------------------------------------------------------
// SAP INI-style segment definition
// Example:
//   [SA660]
//   Satzart=Char(3)
//   NL-Nummer=Numc(3)
// ---------------------------------------------------------------------------

function isSAPINI(content: string): boolean {
  return /^\[.+\]/m.test(content) && /^[A-Za-z_][\w\- ]*\s*=\s*\S/m.test(content);
}

function convertSAPINI(content: string): ConversionResult {
  const result: Record<string, Record<string, unknown>> = {};
  let currentSegment = '_root';

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSegment = sectionMatch[1].trim();
      if (!result[currentSegment]) result[currentSegment] = {};
      continue;
    }

    const fieldMatch = line.match(/^([^=]+)=(.*)$/);
    if (fieldMatch) {
      const name = fieldMatch[1].trim();
      const typeDef = fieldMatch[2].trim();
      if (!result[currentSegment]) result[currentSegment] = {};
      result[currentSegment][name] = sapTypeDefault(typeDef);
    }
  }

  const segments = Object.keys(result);
  if (segments.length === 0) return { ok: false, error: 'No fields found in SAP INI file' };

  // If there's only _root segment, flatten it
  if (segments.length === 1 && segments[0] === '_root') {
    return { ok: true, json: result['_root'], format: 'SAP INI' };
  }
  return { ok: true, json: result, format: 'SAP INI' };
}

// ---------------------------------------------------------------------------
// SAP fixed-width positional format
// Line format: segmentId;fieldName;start;length;type
// e.g.: 660;Satzart;1;3;C
// ---------------------------------------------------------------------------

function isSAPPositional(content: string): boolean {
  // Lines with pattern: number;word;number;number;letter (at least 3 such lines)
  const matches = content.split('\n').filter((l) =>
    /^\d+[;|,\t]\S+[;|,\t]\d+[;|,\t]\d+/.test(l.trim()),
  );
  return matches.length >= 2;
}

function convertSAPPositional(content: string): ConversionResult {
  const result: Record<string, Record<string, unknown>> = {};
  const delim = detectDelimiter(content);

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('/')) continue;

    const parts = line.split(delim).map((p) => p.trim());
    if (parts.length < 4) continue;
    if (!/^\d+$/.test(parts[0])) continue; // first token must be segment ID

    const segId = parts[0];
    const fieldName = parts[1];
    const typeStr = parts[4] ?? parts[3] ?? 'C';

    if (!fieldName) continue;
    if (!result[segId]) result[segId] = {};
    result[segId][fieldName] = sapTypeDefault(typeStr);
  }

  if (Object.keys(result).length === 0) {
    return { ok: false, error: 'No fields parsed from positional format' };
  }
  // Single segment → unwrap
  const segs = Object.keys(result);
  if (segs.length === 1) return { ok: true, json: result[segs[0]], format: 'SAP Positional' };
  return { ok: true, json: result, format: 'SAP Positional' };
}

// ---------------------------------------------------------------------------
// Delimiter-based (CSV or SAP BODS-style field list)
// Handles:
//   - Standard CSV (first row = headers → flat JSON with empty string values)
//   - SAP BODS: fieldName;dataType;length;nullable
//   - fieldName|length|type|description
// ---------------------------------------------------------------------------

function convertDelimited(content: string): ConversionResult {
  const lines = content.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (lines.length === 0) return { ok: false, error: 'Empty file' };

  const delim = detectDelimiter(content);
  const headers = lines[0].split(delim).map((h) => h.trim().replace(/^["']|["']$/g, ''));

  if (headers.length < 1) return { ok: false, error: 'No columns found' };

  // SAP BODS style: fieldName;dataType;length[;nullable]
  // Detect: second column looks like a type name (Char, Varchar, Numc, Dec, Int, Date…)
  const isBODS =
    lines.length > 1 &&
    headers.length >= 2 &&
    /^(Char|Varchar|Numc|Dec|Dec\.|Integer|Int|Float|Date|Time|DateTime|String|Boolean|Byte)/i.test(
      lines[1].split(delim)[1]?.trim() ?? '',
    );

  if (isBODS) {
    const result: Record<string, unknown> = {};
    for (const line of lines) {
      const parts = line.split(delim).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) continue;
      const fieldName = parts[0];
      const typeName = parts[1];
      if (!fieldName) continue;
      result[fieldName] = sapTypeDefault(typeName);
    }
    if (Object.keys(result).length === 0) return { ok: false, error: 'No fields parsed' };
    return { ok: true, json: result, format: 'SAP BODS field list' };
  }

  // Plain CSV: header row defines fields
  const result: Record<string, unknown> = {};
  for (const h of headers) {
    if (h) result[h] = '';
  }

  // If there's a data row, use its values to infer types
  if (lines.length > 1) {
    const vals = lines[1].split(delim).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    headers.forEach((h, i) => {
      if (!h) return;
      const v = vals[i] ?? '';
      if (v !== '' && !isNaN(Number(v))) result[h] = Number(v);
      else if (v.toLowerCase() === 'true' || v.toLowerCase() === 'false') result[h] = v.toLowerCase() === 'true';
      else result[h] = v || '';
    });
  }

  return { ok: true, json: result, format: 'CSV' };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0] ?? '';
  const counts: Record<string, number> = { ';': 0, '|': 0, '\t': 0, ',': 0 };
  for (const ch of firstLine) {
    if (ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ',';
}

function sapTypeDefault(typeDef: string): unknown {
  const t = typeDef.toUpperCase().replace(/\(.*\)/, '').trim();
  if (['N', 'NUMC', 'INT', 'INTEGER', 'LONG', 'FLOAT', 'DEC', 'DEC.', 'DECIMAL',
       'DOUBLE', 'NUMERIC', 'NUMBER'].includes(t)) return 0;
  if (['D', 'DATE'].includes(t)) return '2000-01-01';
  if (['T', 'TIME'].includes(t)) return '00:00:00';
  if (['DATS', 'TIMS'].includes(t)) return t === 'DATS' ? '20000101' : '000000';
  if (['BOOLEAN', 'BOOL'].includes(t)) return false;
  return '';
}
