/**
 * idocFormatter.ts
 *
 * Converts a JSON object (result of a Groovy script execution) to a
 * human-readable SAP IDoc flat-file text representation.
 *
 * - If the targetSchema contains a `_positions` meta-key (produced by
 *   convertSAPIdocParser), the output is a proper fixed-width IDoc flat file.
 * - Otherwise, a readable segment/field text format is produced.
 */

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
