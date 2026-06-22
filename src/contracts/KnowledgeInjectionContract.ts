export type ZavorthKnowledgeSourceType =
  | 'file'
  | 'directory'
  | 'url'
  | 'inline';

export type ZavorthKnowledgeCategory =
  | 'reference'
  | 'documentation'
  | 'style-guide'
  | 'domain'
  | 'project'
  | 'custom';

export type ZavorthKnowledgeEntry = {
  id: string;
  sourceType: ZavorthKnowledgeSourceType;
  category: ZavorthKnowledgeCategory;
  path?: string;
  url?: string;
  content?: string;
  label: string;
  description: string;
  addedAt: string;
  lastVerifiedAt: string;
  tags: string[];
};

export type ZavorthKnowledgeIndex = {
  schemaVersion: 'zavorth.knowledge.index/v1';
  entries: ZavorthKnowledgeEntry[];
  updatedAt: string;
};

export type ZavorthKnowledgeInjectionResult = {
  injected: number;
  skipped: number;
  errors: string[];
  contextTokens: number;
};
