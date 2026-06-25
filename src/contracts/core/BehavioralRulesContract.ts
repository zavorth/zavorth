export type ZavorthRuleSeverity =
  | 'strict'
  | 'prefer'
  | 'suggest';

export type ZavorthRuleContext =
  | 'always'
  | 'code'
  | 'review'
  | 'creative'
  | 'explanation'
  | 'error'
  | 'uncertainty'
  | 'external'
  | 'custom';

export type ZavorthBehavioralRule = {
  id: string;
  context: ZavorthRuleContext;
  pattern?: string;
  directive: string;
  severity: ZavorthRuleSeverity;
  addedAt: string;
};

export type ZavorthBehavioralRulesIndex = {
  schemaVersion: 'zavorth.rules.index/v1';
  rules: ZavorthBehavioralRule[];
  updatedAt: string;
};
