export type ZavorthProactivityChannel =
  | 'telegram'
  | 'discord'
  | 'zavorthControl'
  | 'email'
  | 'cli'
  | 'satellite';

export type ZavorthProactivitySeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type ZavorthProactivityRule = {
  id: string;
  trigger: string;
  channel: ZavorthProactivityChannel;
  severity: ZavorthProactivitySeverity;
  timeWindow?: {
    start: string;
    end: string;
  };
  action: 'notify' | 'suggest' | 'execute' | 'queue';
  addedAt: string;
};

export type ZavorthProactivityPolicy = {
  schemaVersion: 'zavorth.proactivity.policy/v1';
  rules: ZavorthProactivityRule[];
  quietHours: {
    start: string;
    end: string;
  } | null;
  defaultChannel: ZavorthProactivityChannel;
  updatedAt: string;
};
