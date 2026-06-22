export type ZavorthErrorStrategy =
  | 'retry-silent'
  | 'retry-explain'
  | 'escalate'
  | 'suggest-alternatives'
  | 'log-continue'
  | 'ask-user';

export type ZavorthErrorCategory =
  | 'api-failure'
  | 'ambiguous-input'
  | 'tool-failure'
  | 'knowledge-gap'
  | 'permission-denied'
  | 'timeout'
  | 'unknown';

export type ZavorthErrorHandlingRule = {
  category: ZavorthErrorCategory;
  strategy: ZavorthErrorStrategy;
  maxRetries?: number;
  fallbackStrategy?: ZavorthErrorStrategy;
  addedAt: string;
};

export type ZavorthErrorHandlingPolicy = {
  schemaVersion: 'zavorth.error-handling.policy/v1';
  rules: ZavorthErrorHandlingRule[];
  defaultStrategy: ZavorthErrorStrategy;
  updatedAt: string;
};
