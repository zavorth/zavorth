export type ZavorthToolPolicyAction =
  | 'file.read'
  | 'file.write'
  | 'shell.execute'
  | 'network.fetch'
  | 'email.send'
  | 'calendar.write'
  | 'subagent.delegate'
  | 'mcp.execute';

export type ZavorthToolPolicyLevel =
  | 'allow'
  | 'ask'
  | 'deny';

export type ZavorthToolPolicyEntry = {
  action: ZavorthToolPolicyAction;
  level: ZavorthToolPolicyLevel;
  conditions?: string;
  addedAt: string;
};

export type ZavorthToolPolicyIndex = {
  schemaVersion: 'zavorth.tool-policy.index/v1';
  entries: ZavorthToolPolicyEntry[];
  defaultLevel: ZavorthToolPolicyLevel;
  updatedAt: string;
};
