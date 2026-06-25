export type ZavorthOutputContext =
  | 'code'
  | 'explanation'
  | 'summary'
  | 'comparison'
  | 'debugging'
  | 'documentation'
  | 'general';

export type ZavorthOutputFormatRule = {
  context: ZavorthOutputContext;
  format: string;
  maxLength?: number;
  includeExamples: boolean;
  useBulletPoints: boolean;
  useTables: boolean;
  addedAt: string;
};

export type ZavorthOutputFormatPolicy = {
  schemaVersion: 'zavorth.output-format.policy/v1';
  rules: ZavorthOutputFormatRule[];
  updatedAt: string;
};
