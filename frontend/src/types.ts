export interface SchemaField {
  name: string;
  path: string;
  type: string;
  children?: SchemaField[];
  required?: boolean;
}

export interface MappingRule {
  id: string;
  sourcePath: string;
  targetPath: string;
  transform: 'direct' | 'groovy' | 'template';
  groovyScript?: string;
  template?: string;
  condition?: string;
}

export interface Mapping {
  id: string;
  name: string;
  description: string;
  sourceSchema: any;
  targetSchema: any;
  rules: MappingRule[];
  groovyScript?: string;
  exampleData?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface TransformResult {
  success: boolean;
  outputData?: any;
  error?: string;
  logs?: string[];
  durationMs: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
