export type CapabilityDispatchMode = 'conversation' | 'execution' | 'planning';

export type CapabilityType =
  | 'executor'
  | 'workflow'
  | 'research'
  | 'automation'
  | 'integration';

export type CapabilityMatcher = {
  keywords?: string[];
  patterns?: string[];
  require_all_keywords?: boolean;
};

export type CapabilityPolicy = {
  executor: string;
  requiresApproval: boolean;
  dangerLevel?: string | null;
  networkScope?: 'none' | 'local' | 'private-network' | 'external-policy' | null;
  lifecycle?: 'stateless' | 'session' | 'event-bridge' | null;
  artifactKinds?: string[];
  allowedHosts?: string[];
};

export type CapabilityCommand = {
  command: string;
  aliases?: string[];
  explicit_executor?: string | null;
  handler_action?: string | null;
  handler_config?: Record<string, unknown> | null;
  description: string;
  usage?: string;
  hidden?: boolean;
  privateMenu?: boolean;
  groupMenu?: boolean;
  section?: string;
};

export type CapabilityDefinition = {
  id: string;
  label: string;
  type: CapabilityType;
  description: string;
  intent: string;
  executor_preference: string | null;
  dispatch_mode: CapabilityDispatchMode;
  workspace_hint?: string | null;
  requires_planning?: boolean;
  routing_reason?: string;
  routing_confidence?: number;
  priority?: number;
  enabled?: boolean;
  allowed_command_types?: string[];
  command?: CapabilityCommand | null;
  matchers?: CapabilityMatcher[];
  tags?: string[];
  policy?: CapabilityPolicy | null;
  source?: 'builtin' | 'plugin';
  plugin_name?: string | null;
};

export type CapabilitySummary = {
  total: number;
  builtin: number;
  plugin: number;
  commands: number;
  implicitRoutes: number;
};
