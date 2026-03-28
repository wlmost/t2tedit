/**
 * idocFormatter.ts
 *
 * Converts a JSON object (result of a Groovy script execution) to a
 * human-readable representation of the target format.
 *
 * Supported target formats (auto-detected from the schema):
 *  - SAP IDoc (`_positions` meta-key present): fixed-width IDoc flat-file text.
 *  - t2tedit segment format (`_cfg` meta-key present): delimiter-separated text.
 *  - All others: pretty-printed JSON.
 */

/**
 * Detects the target data format based on schema meta-keys.
 *
 * @param schema  The target schema object.
 * @returns       `'idoc'` for SAP IDoc, `'t2t'` for t2tedit segment format,
 *                `'json'` for everything else.
 */
export function detectTargetFormat(schema: unknown): 'idoc' | 't2t' | 'json' {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return 'json';
  const s = schema as Record<string, unknown>;
  if ('_positions' in s) return 'idoc';
  if ('_cfg' in s) return 't2t';
  return 'json';
}

/**
 * Returns a short human-readable label for the target data format.
 *
 * @param schema  The target schema object.
 * @returns       A label such as `'IDoc'`, `'T2T Format'`, or `'JSON'`.
 */
export function targetFormatLabel(schema: unknown): string {
  switch (detectTargetFormat(schema)) {
    case 'idoc': return 'IDoc';
    case 't2t':  return 'T2T Format';
    default:     return 'JSON';
  }
}

/**
 * Formats the result of a Groovy script execution according to the target
 * schema format.  Dispatches to the appropriate formatter based on the
 * schema type detected by {@link detectTargetFormat}.
 *
 * @param result       The JSON value returned by the Groovy script.
 * @param targetSchema The target schema object (may contain meta-keys).
 * @returns            A formatted string ready to display to the user.
 */
export function formatScriptResult(result: unknown, targetSchema: unknown): string {
  switch (detectTargetFormat(targetSchema)) {
    case 'idoc': return jsonResultToIdocText(result, targetSchema);
    case 't2t':  return jsonResultToT2TText(result, targetSchema);
    default:
      if (result === null || result === undefined) return '';
      return typeof result === 'object'
        ? JSON.stringify(result, null, 2)
        : String(result);
  }
}

/**
 * Converts a Groovy script result JSON to IDoc flat-file text.
 *
 * @param result       The JSON object returned by the Groovy script execution.
 * @param targetSchema The target schema, optionally with `_positions` metadata.
 * @returns            The formatted IDoc text.
 */
export function jsonResultToIdocText(result: unknown, targetSchema: unknown): string {
  if (result === null || result === undefined) return '';
  if (typeof result !== 'object' || Array.isArray(result)) {
    return JSON.stringify(result, null, 2);
  }

  const resultObj = result as Record<string, unknown>;
  const positions = extractPositions(targetSchema);
  const lines: string[] = [];

  for (const [segName, segData] of Object.entries(resultObj)) {
    if (segName.startsWith('_')) continue;

    const segList = Array.isArray(segData) ? segData : [segData];

    for (const seg of segList) {
      if (seg === null || typeof seg !== 'object' || Array.isArray(seg)) continue;
      const segFields = seg as Record<string, unknown>;
      const segPositions = positions?.[segName];

      if (segPositions && Object.keys(segPositions).length > 0) {
        // Fixed-width IDoc flat-file line
        lines.push(buildFixedWidthLine(segFields, segPositions));
      } else {
        // Readable segment / field format (no positional schema available)
        lines.push(segName);
        for (const [fieldName, value] of Object.entries(segFields)) {
          const strValue = value === null || value === undefined ? '' : String(value);
          lines.push(`  ${fieldName.padEnd(FIELD_NAME_COLUMN_WIDTH)}${strValue}`);
        }
      }
    }
  }

  return lines.join('\n');
}

/** Column width used to pad field names in the readable (non-positional) output format. */
const FIELD_NAME_COLUMN_WIDTH = 24;

/** Extracts the `_positions` meta-key from a schema object, if present. */
function extractPositions(
  schema: unknown,
): Record<string, Record<string, [number, number]>> | null {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return null;
  const s = schema as Record<string, unknown>;
  if (!('_positions' in s)) return null;
  return s['_positions'] as Record<string, Record<string, [number, number]>>;
}

/**
 * Builds a single fixed-width IDoc data line by placing each field value at
 * its character range (1-indexed, as stored in the parser file).
 * Values are left-aligned within their field width; values longer than their
 * defined range are truncated.
 *
 * Note: padding is calculated by JavaScript string length (UTF-16 code units).
 * SAP IDoc flat-file data is expected to contain only ASCII / single-byte
 * characters, which aligns with this assumption.
 */
function buildFixedWidthLine(
  fields: Record<string, unknown>,
  positions: Record<string, [number, number]>,
): string {
  // Determine total line length from the highest charLast value
  let lineLength = 0;
  for (const pos of Object.values(positions)) {
    lineLength = Math.max(lineLength, pos[1]);
  }

  const chars = new Array<string>(lineLength).fill(' ');

  for (const [fieldName, [charFirst, charLast]] of Object.entries(positions)) {
    const fieldLength = charLast - charFirst + 1;
    const rawValue = fields[fieldName];
    const strValue = rawValue === null || rawValue === undefined ? '' : String(rawValue);
    const padded = strValue.padEnd(fieldLength).slice(0, fieldLength);
    for (let i = 0; i < fieldLength; i++) {
      chars[charFirst - 1 + i] = padded[i];
    }
  }

  return chars.join('');
}

// ---------------------------------------------------------------------------
// t2tedit segment format renderer
// ---------------------------------------------------------------------------

/** Default field separator used when no separator is configured in `_cfg`. */
const DEFAULT_T2T_SEPARATOR = '@';

/**
 * Converts a Groovy script result JSON to delimiter-separated text matching
 * the t2tedit segment format described by the `_cfg` meta-key in the schema.
 *
 * Each segment in the result is emitted as one line (or multiple lines when
 * the value is an array).  Field values are separated by the configured
 * separator character.  The field order follows the schema definition so that
 * the output matches the expected column order.
 *
 * @param result       The JSON object returned by the Groovy script execution.
 * @param targetSchema The target schema with a `_cfg` meta-key.
 * @returns            The formatted delimited text.
 */
function jsonResultToT2TText(result: unknown, targetSchema: unknown): string {
  if (result === null || result === undefined) return '';
  if (typeof result !== 'object' || Array.isArray(result)) {
    return JSON.stringify(result, null, 2);
  }

  const resultObj = result as Record<string, unknown>;
  const schema =
    targetSchema && typeof targetSchema === 'object' && !Array.isArray(targetSchema)
      ? (targetSchema as Record<string, unknown>)
      : {};
  const cfg =
    schema['_cfg'] && typeof schema['_cfg'] === 'object' && !Array.isArray(schema['_cfg'])
      ? (schema['_cfg'] as Record<string, unknown>)
      : {};
  const separator = typeof cfg['separator'] === 'string' && cfg['separator'].length > 0
    ? cfg['separator']
    : DEFAULT_T2T_SEPARATOR;

  const lines: string[] = [];

  for (const [segName, segData] of Object.entries(resultObj)) {
    if (segName.startsWith('_')) continue;

    const segList = Array.isArray(segData) ? segData : [segData];
    const segSchemaObj =
      schema[segName] && typeof schema[segName] === 'object' && !Array.isArray(schema[segName])
        ? (schema[segName] as Record<string, unknown>)
        : null;
    // Use schema key order so field columns match the defined layout.
    // Fall back to the result object's own key order when no schema is available.
    const fieldOrder: string[] = segSchemaObj ? Object.keys(segSchemaObj) : [];

    for (const seg of segList) {
      if (seg === null || typeof seg !== 'object' || Array.isArray(seg)) continue;
      const segFields = seg as Record<string, unknown>;

      const keys = fieldOrder.length > 0 ? fieldOrder : Object.keys(segFields);
      const values = keys.map((f) =>
        segFields[f] === null || segFields[f] === undefined ? '' : String(segFields[f]),
      );

      lines.push(values.join(separator));
    }
  }

  return lines.join('\n');
}
