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
 *  - XML actual data (.xml)   → converts element hierarchy to a JSON object
 *  - CSV (.csv)               → first row (header) becomes a flat JSON object
 *                               with empty-string field values
 *  - SAP flat-file parser files (.p, .par, .txt, .csv with SAP field notation)
 *      Recognised patterns:
 *        1. SAP IDoc parser files (BEGIN_RECORD_SECTION / BEGIN_CONTROL_RECORD /
 *             BEGIN_DATA_RECORD blocks with NAME / TYPE / CHARACTER_FIRST /
 *             CHARACTER_LAST field attributes).  Field positions are stored in a
 *             `_positions` meta-key so that convertDataFile() can extract values
 *             from fixed-length IDoc data files.
 *        2. Semicolon/pipe-delimited field lists:
 *             fieldName;dataType;length  (e.g. SAP BODS / Data Services)
 *             fieldName|length|type|description
 *        3. INI-style segment blocks:
 *             [SegmentName]
 *             FieldName=Type(Length)
 *        4. SAP fixed-width positional format:
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

  // 4. SAP IDoc parser format (BEGIN_RECORD_SECTION / BEGIN_CONTROL_RECORD)
  if (isSAPIdocParser(content)) {
    return convertSAPIdocParser(content);
  }

  // 5. SAP INI-style segment definition
  if (isSAPINI(content)) {
    return convertSAPINI(content);
  }

  // 6. SAP fixed-width positional format  (segments with numeric IDs as first token)
  if (isSAPPositional(content)) {
    return convertSAPPositional(content);
  }

  // 7. Delimiter-based (SAP BODS / CSV)
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
// SAP IDoc parser file format
// BEGIN_RECORD_SECTION / BEGIN_CONTROL_RECORD / BEGIN_DATA_RECORD <name>
//   BEGIN_FIELDS
//     NAME                TABNAM
//     TEXT                Name der Tabellenstruktur
//     TYPE                CHARACTER
//     LENGTH              000010
//     FIELD_POS           0001
//     CHARACTER_FIRST     000001
//     CHARACTER_LAST      000010
//   END_FIELDS
// END_CONTROL_RECORD / END_DATA_RECORD
// END_RECORD_SECTION
//
// The control record is always stored under the key "EDI_DC40".
// Data records use the name from BEGIN_DATA_RECORD or the SEGMENTTYPE attribute.
// Character positions (1-indexed) are stored in a `_positions` meta-key so that
// convertDataFile() can later extract values from fixed-length IDoc data files.
// ---------------------------------------------------------------------------

function isSAPIdocParser(content: string): boolean {
  return (
    /^\s*BEGIN_RECORD_SECTION\s*$/m.test(content) ||
    /^\s*BEGIN_CONTROL_RECORD\s*$/m.test(content) ||
    /^\s*BEGIN_DATA_RECORD\b/m.test(content)
  );
}

function convertSAPIdocParser(content: string): ConversionResult {
  // schema:    segmentName → { fieldName → defaultValue }
  // positions: segmentName → { fieldName → [charFirst, charLast] }  (1-indexed)
  const schema: Record<string, Record<string, unknown>> = {};
  const positions: Record<string, Record<string, [number, number]>> = {};

  let currentRecord: string | null = null;
  let pendingSegType = false; // true when BEGIN_DATA_RECORD had no inline name
  let inFields = false;
  let currentFieldAttrs: Record<string, string> = {};

  const flushField = () => {
    if (!currentFieldAttrs.NAME || !currentRecord) {
      currentFieldAttrs = {};
      return;
    }
    const fieldName = currentFieldAttrs.NAME;
    const fieldType = currentFieldAttrs.TYPE ?? 'CHARACTER';

    if (!schema[currentRecord]) schema[currentRecord] = {};
    schema[currentRecord][fieldName] = idocTypeDefault(fieldType);

    const charFirst = parseInt(currentFieldAttrs.CHARACTER_FIRST ?? '0', 10);
    const charLast = parseInt(currentFieldAttrs.CHARACTER_LAST ?? '0', 10);
    if (charFirst > 0 && charLast > 0) {
      if (!positions[currentRecord]) positions[currentRecord] = {};
      positions[currentRecord][fieldName] = [charFirst, charLast];
    }

    currentFieldAttrs = {};
  };

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (!line) {
      // Blank line signals end of a field block
      if (inFields) flushField();
      continue;
    }

    if (line === 'BEGIN_RECORD_SECTION' || line === 'END_RECORD_SECTION') continue;

    if (line === 'BEGIN_CONTROL_RECORD') {
      currentRecord = 'EDI_DC40';
      pendingSegType = false;
      inFields = false;
      currentFieldAttrs = {};
      continue;
    }

    if (line.startsWith('END_CONTROL_RECORD')) {
      if (inFields) flushField();
      currentRecord = null;
      inFields = false;
      continue;
    }

    const dataRecordMatch = line.match(/^BEGIN_DATA_RECORD(?:\s+(\S+))?/);
    if (dataRecordMatch) {
      if (dataRecordMatch[1]) {
        currentRecord = dataRecordMatch[1];
        pendingSegType = false;
      } else {
        // Name will come from a SEGMENTTYPE attribute
        currentRecord = null;
        pendingSegType = true;
      }
      inFields = false;
      currentFieldAttrs = {};
      continue;
    }

    if (line.startsWith('END_DATA_RECORD')) {
      if (inFields) flushField();
      currentRecord = null;
      pendingSegType = false;
      inFields = false;
      continue;
    }

    if (line === 'BEGIN_FIELDS') {
      inFields = true;
      currentFieldAttrs = {};
      continue;
    }

    if (line === 'END_FIELDS') {
      if (inFields) flushField();
      inFields = false;
      continue;
    }

    // Attribute line: "NAME    TABNAM", "TYPE    CHARACTER", "SEGMENTTYPE  E1EDL20" …
    const attrMatch = line.match(/^([A-Z_]+)\s+(.*)/);
    if (!attrMatch) continue;

    const attrKey = attrMatch[1];
    const attrValue = attrMatch[2].trim();

    // SEGMENTTYPE sets the record name when BEGIN_DATA_RECORD had no inline name
    if (attrKey === 'SEGMENTTYPE' && pendingSegType && !inFields) {
      currentRecord = attrValue;
      pendingSegType = false;
      continue;
    }

    if (!inFields) continue; // Skip non-field attributes outside BEGIN_FIELDS

    if (attrKey === 'NAME') {
      flushField(); // flush previous field before starting a new one
      currentFieldAttrs = { NAME: attrValue };
    } else if (attrKey !== 'VALUE' && attrKey !== 'VALUE_TEXT') {
      // Skip VALUE / VALUE_TEXT (enum value metadata with duplicate keys)
      currentFieldAttrs[attrKey] = attrValue;
    }
  }

  // Flush any trailing field
  if (inFields) flushField();

  const recordNames = Object.keys(schema);
  if (recordNames.length === 0) {
    return { ok: false, error: 'No records found in SAP IDoc parser file' };
  }

  // Build the result object; attach positions as a meta-key for data conversion
  const result: Record<string, unknown> = {};
  for (const [name, fields] of Object.entries(schema)) {
    result[name] = fields;
  }
  if (Object.keys(positions).length > 0) {
    result['_positions'] = positions;
  }

  return { ok: true, json: result, format: 'SAP IDoc' };
}

/** Default value for an SAP IDoc field based on its TYPE attribute. */
function idocTypeDefault(type: string): unknown {
  const t = type.toUpperCase().trim();
  if (['NUMERIC', 'N', 'INTEGER', 'INT'].includes(t)) return 0;
  if (['DATE', 'D', 'DATS'].includes(t)) return '20000101';
  if (['TIME', 'T', 'TIMS'].includes(t)) return '000000';
  return ''; // CHARACTER and everything else
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
// Data file converter (for example input data, preserves actual values)
// ---------------------------------------------------------------------------

/**
 * Converts various data file formats into a JSON value suitable for use as
 * example input data in t2tedit.  Unlike {@link convertSchemaFile}, this
 * function preserves actual field values from the file and converts
 * multi-row CSV files to arrays of objects.
 *
 * When a `schema` (the already-converted source schema JSON) is provided it
 * is used to guide field-name resolution for non-self-describing formats
 * (CSV, SAP flat-files, fixed-length text).  XML and JSON are self-describing
 * and therefore ignore the schema.
 *
 * Supported formats:
 *  - JSON  → pass-through (schema not needed)
 *  - XML   → element hierarchy converted to a JSON object (schema not needed)
 *  - CSV   → data rows mapped to JSON objects; schema field names used when
 *            the file has no header row
 *  - SAP delimiter / flat-file → lines whose first token matches a schema
 *            segment key are mapped to that segment's field names
 *  - Other → falls back to {@link convertSchemaFile} (schema-style conversion)
 */
export function convertDataFile(filename: string, content: string, schema?: unknown): ConversionResult {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  // 1. Explicit JSON
  if (ext === 'json') return convertJSON(content);

  // 2. XML actual data (not XSD schema)
  if (
    ext === 'xml' ||
    (content.trimStart().startsWith('<?xml') && !isXSD(content))
  ) {
    return convertXMLData(content);
  }

  // 3. Try JSON anyway (e.g. .txt that happens to contain JSON)
  const jsonTry = tryJSON(content);
  if (jsonTry !== null) return { ok: true, json: jsonTry, format: 'JSON' };

  // 4. Schema-guided conversion (CSV, SAP delimiter, flat-file)
  if (schema) {
    const guided = convertDataWithSchema(content, schema);
    if (guided.ok) return guided;
  }

  // 5. CSV with all rows as array of objects (no schema)
  if (ext === 'csv') return convertCSVData(content);

  // 6. Fall back to schema-style conversion for SAP parser and other formats
  return convertSchemaFile(filename, content);
}

// ---------------------------------------------------------------------------
// Schema-guided data conversion
// ---------------------------------------------------------------------------

/**
 * Uses a pre-parsed source schema (the JSON representation produced by
 * {@link convertSchemaFile}) to map raw delimited or CSV data values to the
 * correct field names.
 *
 * Three patterns are handled:
 *
 * 1. **IDoc fixed-length** — schema contains a `_positions` meta-key (produced
 *    by {@link convertSAPIdocParser}).  Each data line is matched to a segment
 *    by reading the first field's character range; remaining fields are
 *    extracted by their character ranges.
 *
 * 2. **Segmented schema** — schema has segment-ID keys whose values are field
 *    objects (e.g. `{ "660": { "Satzart":"", "NL-Nummer":"" }, "661": {...} }`).
 *    Each data line whose first delimited token is a known segment ID is parsed
 *    by mapping subsequent tokens to that segment's field names in order.
 *    Multiple lines with the same segment ID become an array.
 *
 * 3. **Flat schema** — schema is a plain field→value object
 *    (e.g. `{ "Name":"", "Age":0, "City":"" }`).
 *    Used as fallback column headers when the CSV/flat file has no header row
 *    (detected by checking whether the first line is entirely non-numeric).
 */
function convertDataWithSchema(content: string, schema: unknown): ConversionResult {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { ok: false, error: 'Schema is not a plain object' };
  }

  const schemaObj = schema as Record<string, unknown>;

  // Strip internal meta-keys (prefixed with '_') from schema for generic processing
  const filteredSchema = Object.fromEntries(
    Object.entries(schemaObj).filter(([k]) => !k.startsWith('_')),
  );

  // 1. IDoc fixed-length format — try positional extraction first
  if ('_positions' in schemaObj) {
    const positions = schemaObj['_positions'] as Record<string, Record<string, [number, number]>>;
    const idocResult = convertIdocDataWithPositions(content, filteredSchema, positions);
    if (idocResult.ok) return idocResult;
    // Fall through on failure (data may be delimited instead of fixed-length)
  }

  const schemaKeys = Object.keys(filteredSchema);
  if (schemaKeys.length === 0) return { ok: false, error: 'Empty schema' };

  // 2. Segmented schema: all values are plain objects
  const isSegmented = schemaKeys.every(
    (k) =>
      filteredSchema[k] !== null &&
      typeof filteredSchema[k] === 'object' &&
      !Array.isArray(filteredSchema[k]),
  );

  if (isSegmented) {
    return convertSegmentedDataWithSchema(
      content,
      filteredSchema as Record<string, Record<string, unknown>>,
    );
  }

  // 3. Flat schema — use field names as fallback column headers for CSV-style data.
  return convertFlatDataWithSchema(content, filteredSchema);
}

/**
 * Extracts field values from fixed-length SAP IDoc data lines using the
 * character-range positions produced by {@link convertSAPIdocParser}.
 *
 * Each line's segment type is identified by reading the `TABNAM` or `SEGNAM`
 * field value (the standard SAP IDoc segment-identifier fields) from its
 * character range; if neither is present the first defined field is used as
 * a fallback.
 *
 * Character positions are 1-indexed (as stored in the parser file).
 */
function convertIdocDataWithPositions(
  content: string,
  schema: Record<string, unknown>,
  positions: Record<string, Record<string, [number, number]>>,
): ConversionResult {
  const result: Record<string, unknown> = {};
  let matched = 0;

  for (const rawLine of content.split('\n')) {
    // Preserve spaces (fixed-length), only strip trailing newline
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim()) continue;

    // Identify segment by reading the identifier field's character range.
    // Prefer well-known segment-identifier field names (TABNAM in EDI_DC40,
    // SEGNAM in data records) over purely positional first-field detection.
    const IDOC_ID_FIELDS = ['TABNAM', 'SEGNAM', 'SEGMENT'];
    for (const [segName, segPositions] of Object.entries(positions)) {
      const idFieldName =
        IDOC_ID_FIELDS.find((f) => f in segPositions) ?? Object.keys(segPositions)[0];
      if (!idFieldName) continue;

      const [charFirst, charLast] = segPositions[idFieldName];
      const extractedId = line.substring(charFirst - 1, charLast).trim();
      if (extractedId !== segName) continue;

      // Found a matching segment — extract all fields
      const segSchema = schema[segName] as Record<string, unknown> | undefined;
      const row: Record<string, unknown> = {};

      for (const [fieldName, [cFirst, cLast]] of Object.entries(segPositions)) {
        const rawVal = line.substring(cFirst - 1, cLast).trimEnd();
        const schemaDefault = segSchema?.[fieldName];
        if (typeof schemaDefault === 'number') {
          const trimmed = rawVal.trim();
          const n = Number(trimmed);
          row[fieldName] = trimmed !== '' && !isNaN(n) ? n : rawVal;
        } else {
          row[fieldName] = rawVal;
        }
      }

      matched++;
      if (!(segName in result)) {
        result[segName] = row;
      } else if (Array.isArray(result[segName])) {
        (result[segName] as unknown[]).push(row);
      } else {
        result[segName] = [result[segName] as unknown, row];
      }
      break; // stop checking other segment types for this line
    }
  }

  if (matched === 0) return { ok: false, error: 'No IDoc records matched schema positions' };
  return { ok: true, json: result, format: 'SAP IDoc Data' };
}

/**
 * Parses delimited data whose first column is a segment ID matching a key in
 * `schema`.  Each matched line is mapped to that segment's field names.
 */
function convertSegmentedDataWithSchema(
  content: string,
  schema: Record<string, Record<string, unknown>>,
): ConversionResult {
  const delim = detectDelimiter(content);
  const result: Record<string, unknown> = {};
  let matched = 0;

  const parseValue = (v: string): unknown => {
    if (v !== '' && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (v.toLowerCase() === 'true') return true;
    if (v.toLowerCase() === 'false') return false;
    return v;
  };

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('/')) continue;

    const parts = line.split(delim).map((p) => p.trim());
    const segId = parts[0];
    if (!segId || !(segId in schema)) continue;

    matched++;
    const fieldNames = Object.keys(schema[segId]);
    const row: Record<string, unknown> = {};
    fieldNames.forEach((name, i) => {
      row[name] = parseValue(parts[i] ?? '');
    });

    if (!(segId in result)) {
      result[segId] = row;
    } else if (Array.isArray(result[segId])) {
      (result[segId] as unknown[]).push(row);
    } else {
      result[segId] = [result[segId] as unknown, row];
    }
  }

  if (matched === 0) return { ok: false, error: 'No segment IDs from schema found in data' };
  return { ok: true, json: result, format: 'SAP Data' };
}

/**
 * Uses schema field names as column headers when the CSV/flat file has no
 * header row (i.e. the first line is all non-text tokens).  Falls back to
 * normal CSV parsing when a header row is detected.
 */
function convertFlatDataWithSchema(
  content: string,
  schema: Record<string, unknown>,
): ConversionResult {
  const lines = content.split('\n').filter((l) => { const t = l.trim(); return t && !t.startsWith('#'); });
  if (lines.length === 0) return { ok: false, error: 'Empty file' };

  const delim = detectDelimiter(content);
  const firstParts = lines[0].split(delim).map((p) => p.trim().replace(/^["']|["']$/g, ''));
  const fieldNames = Object.keys(schema);

  // If the first line looks like a header (contains non-numeric tokens), fall
  // back to normal CSV parsing so we don't override real headers.
  const firstLineIsHeader = firstParts.some((p) => p !== '' && isNaN(Number(p)));
  if (firstLineIsHeader) return convertCSVData(content);

  // No header row — use schema field names.
  const parseValue = (v: string): unknown => {
    if (v !== '' && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (v.toLowerCase() === 'true') return true;
    if (v.toLowerCase() === 'false') return false;
    return v;
  };

  const rows = lines.map((line) => {
    const vals = line.split(delim).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, unknown> = {};
    fieldNames.forEach((name, i) => {
      row[name] = parseValue(vals[i] ?? '');
    });
    return row;
  });

  if (rows.length === 1) return { ok: true, json: rows[0], format: 'CSV' };
  return { ok: true, json: rows, format: 'CSV' };
}

// ---------------------------------------------------------------------------
// XML actual data (not XSD)
// ---------------------------------------------------------------------------

function convertXMLData(content: string): ConversionResult {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return {
        ok: false,
        error: `XML parse error: ${parseError.textContent?.trim().slice(0, 120) ?? 'unknown'}`,
      };
    }
    const json = xmlElementToJSON(doc.documentElement);
    return { ok: true, json: { [doc.documentElement.localName ?? doc.documentElement.nodeName]: json }, format: 'XML' };
  } catch (e: unknown) {
    return {
      ok: false,
      error: `XML conversion failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

function xmlElementToJSON(el: Element): unknown {
  const result: Record<string, unknown> = {};

  // Preserve attributes
  for (const attr of Array.from(el.attributes)) {
    result[`@${attr.name}`] = attr.value;
  }

  const childElements = Array.from(el.children);

  if (childElements.length === 0) {
    // Leaf node — return the text value (with conservative type coercion)
    const text = el.textContent?.trim() ?? '';
    if (Object.keys(result).length === 0) {
      if (text !== '' && /^-?\d+(\.\d+)?$/.test(text)) return Number(text);
      if (text.toLowerCase() === 'true') return true;
      if (text.toLowerCase() === 'false') return false;
      return text;
    }
    if (text) result['#text'] = text;
    return result;
  }

  // Group children by tag name so repeated elements become arrays
  const groups: Record<string, Element[]> = {};
  for (const child of childElements) {
    const name = child.localName ?? child.nodeName;
    if (!groups[name]) groups[name] = [];
    groups[name].push(child);
  }

  for (const [name, children] of Object.entries(groups)) {
    result[name] =
      children.length === 1
        ? xmlElementToJSON(children[0])
        : children.map(xmlElementToJSON);
  }

  return result;
}

// ---------------------------------------------------------------------------
// CSV data (all rows as array of objects)
// ---------------------------------------------------------------------------

function convertCSVData(content: string): ConversionResult {
  const lines = content.split('\n').filter((l) => { const t = l.trim(); return t && !t.startsWith('#'); });
  if (lines.length === 0) return { ok: false, error: 'Empty file' };

  const delim = detectDelimiter(content);
  const headers = lines[0].split(delim).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  if (headers.length < 1 || headers.every((h) => !h)) {
    return { ok: false, error: 'No columns found' };
  }

  if (lines.length === 1) {
    // Header only — return a single empty-value object
    const obj: Record<string, unknown> = {};
    for (const h of headers) {
      if (h) obj[h] = '';
    }
    return { ok: true, json: obj, format: 'CSV' };
  }

  const parseValue = (v: string): unknown => {
    if (v !== '' && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (v.toLowerCase() === 'true') return true;
    if (v.toLowerCase() === 'false') return false;
    return v;
  };

  const rows = lines.slice(1).map((line) => {
    const vals = line.split(delim).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) row[h] = parseValue(vals[i] ?? '');
    });
    return row;
  });

  // Single data row → return as plain object (no wrapping array)
  if (rows.length === 1) return { ok: true, json: rows[0], format: 'CSV' };
  return { ok: true, json: rows, format: 'CSV' };
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
