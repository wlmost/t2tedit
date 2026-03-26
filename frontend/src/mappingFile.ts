import type { Mapping } from './types';

const HEADER_MARKER = 't2tedit-mapping';

function encodeField(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function decodeField(encoded: string): unknown {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

/**
 * Serialises a mapping to a Groovy script file.
 * Metadata (schemas, example data, name, description) is embedded in the
 * opening block comment so that the file can be loaded back later.
 */
export function mappingToGroovyFile(mapping: Mapping): string {
  const lines: string[] = [
    '/*',
    ` * ${HEADER_MARKER}`,
    ` * name: ${mapping.name}`,
    ` * description: ${mapping.description ?? ''}`,
  ];

  if (mapping.sourceSchema !== null && mapping.sourceSchema !== undefined) {
    lines.push(` * source-schema: base64:${encodeField(mapping.sourceSchema)}`);
  }
  if (mapping.targetSchema !== null && mapping.targetSchema !== undefined) {
    lines.push(` * target-schema: base64:${encodeField(mapping.targetSchema)}`);
  }
  if (mapping.exampleData !== null && mapping.exampleData !== undefined) {
    lines.push(` * example-data: base64:${encodeField(mapping.exampleData)}`);
  }

  lines.push(' */');
  lines.push('');
  lines.push(mapping.groovyScript ?? '// Write your Groovy transformation script here\n');

  return lines.join('\n');
}

export interface ParsedMappingFile {
  name: string;
  description: string;
  sourceSchema: unknown | null;
  targetSchema: unknown | null;
  exampleData: unknown | null;
  groovyScript: string;
}

/**
 * Parses a Groovy script file produced by {@link mappingToGroovyFile}.
 * Extracts metadata from the header block comment and the script from the body.
 */
export function parseGroovyFile(content: string): ParsedMappingFile {
  const result: ParsedMappingFile = {
    name: 'Imported Mapping',
    description: '',
    sourceSchema: null,
    targetSchema: null,
    exampleData: null,
    groovyScript: '',
  };

  // Extract the leading block comment
  const headerMatch = content.match(/^\/\*([\s\S]*?)\*\//);
  if (headerMatch) {
    for (const raw of headerMatch[1].split('\n')) {
      const line = raw.replace(/^\s*\*\s?/, '').trim();
      if (line.startsWith(`${HEADER_MARKER}`)) continue;
      if (line.startsWith('name:')) {
        result.name = line.slice(5).trim();
      } else if (line.startsWith('description:')) {
        result.description = line.slice(12).trim();
      } else if (line.startsWith('source-schema:')) {
        const val = line.slice(14).trim();
        if (val.startsWith('base64:')) {
          try { result.sourceSchema = decodeField(val.slice(7)); } catch { /* ignore */ }
        }
      } else if (line.startsWith('target-schema:')) {
        const val = line.slice(14).trim();
        if (val.startsWith('base64:')) {
          try { result.targetSchema = decodeField(val.slice(7)); } catch { /* ignore */ }
        }
      } else if (line.startsWith('example-data:')) {
        const val = line.slice(13).trim();
        if (val.startsWith('base64:')) {
          try { result.exampleData = decodeField(val.slice(7)); } catch { /* ignore */ }
        }
      }
    }
  }

  // Everything after the block comment is the Groovy script
  result.groovyScript = content.replace(/^\/\*[\s\S]*?\*\/\s*/, '').trim();

  return result;
}

/** Triggers a browser file download for the given text content. */
export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Returns a sanitised filename stem derived from the mapping name. */
export function mappingFilename(name: string): string {
  return (name.trim().replace(/[^a-zA-Z0-9_\-. ]/g, '_').replace(/\s+/g, '_') || 'mapping') + '.groovy';
}
