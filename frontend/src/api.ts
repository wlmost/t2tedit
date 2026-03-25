import type { Mapping, TransformResult, ValidationResult, SchemaField } from './types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listMappings: (): Promise<Mapping[]> =>
    request<Mapping[]>('/api/mappings'),

  getMapping: (id: string): Promise<Mapping> =>
    request<Mapping>(`/api/mappings/${id}`),

  createMapping: (mapping: Partial<Mapping>): Promise<Mapping> =>
    request<Mapping>('/api/mappings', {
      method: 'POST',
      body: JSON.stringify(mapping),
    }),

  updateMapping: (id: string, mapping: Partial<Mapping>): Promise<Mapping> =>
    request<Mapping>(`/api/mappings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(mapping),
    }),

  deleteMapping: (id: string): Promise<void> =>
    request<void>(`/api/mappings/${id}`, { method: 'DELETE' }),

  transform: (req: {
    mappingId?: string;
    mapping?: Mapping;
    inputData: any;
  }): Promise<TransformResult> =>
    request<TransformResult>('/api/transform', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  validate: (mapping: Mapping): Promise<ValidationResult> =>
    request<ValidationResult>('/api/validate', {
      method: 'POST',
      body: JSON.stringify(mapping),
    }),

  parseSchema: (data: any): Promise<{ fields: SchemaField[] }> =>
    request<{ fields: SchemaField[] }>('/api/schema/parse', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  groovyStatus: (): Promise<{ available: boolean; version?: string }> =>
    request<{ available: boolean; version?: string }>('/api/groovy/status'),
};
