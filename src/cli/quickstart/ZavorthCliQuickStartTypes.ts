export type ZavorthCliQuickStartStatus = 'ready' | 'needs_provider' | 'needs_channel' | 'needs_approval' | 'blocked';

export type ZavorthCliQuickStartOption = {
  id: string;
  label: string;
  status: 'ready' | 'recommended' | 'optional' | 'blocked';
  command: string;
  detail: string;
};

export type ZavorthCliQuickStartSnapshot = {
  contractVersion: 'zavorth-cli-quickstart/1';
  generatedAt: string;
  projectRoot: string;
  status: ZavorthCliQuickStartStatus;
  headline: string;
  provider: {
    configured: boolean;
    id: string | null;
    model: string | null;
    recommendedCommand: string;
  };
  channels: {
    telegram: 'ready' | 'needs-allowlist' | 'not-configured';
    discord: 'ready' | 'not-configured';
    recommendedCommand: string;
  };
  approvals: {
    pending: number;
    recommendedCommand: string | null;
  };
  safety: {
    effectBoundary: 'ready' | 'missing';
    writesRequireApply: true;
    secretsRedacted: true;
    noRuntimeStart: true;
  };
  options: ZavorthCliQuickStartOption[];
  nextActions: Array<{
    label: string;
    command: string;
    detail?: string;
  }>;
};

export type ZavorthQuickStartInteractiveResult = {
  exitCode: number;
  output: string;
  snapshot: ZavorthCliQuickStartSnapshot;
  locale?: string;
  provider?: string;
  model?: string;
  agentName?: string;
  userName?: string;
  tone?: string;
};
