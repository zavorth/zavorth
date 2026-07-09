export type ZavorthCliHomeStatus = 'ready' | 'warning' | 'blocked' | 'offline';

export type ZavorthCliHomeSnapshot = {
  contractVersion: 'zavorth-cli-home/1';
  generatedAt: string;
  projectRoot: string;
  status: ZavorthCliHomeStatus;
  headline: string;
  runtime: {
    node: string;
    packageVersion: string | null;
    gatewayToken: 'present' | 'missing';
    zavorthControl: 'available' | 'missing';
  };
  provider: {
    id: string | null;
    model: string | null;
    configured: boolean;
  };
  channels: {
    telegram: 'ready' | 'needs-allowlist' | 'not-configured';
    discord: 'ready' | 'not-configured';
  };
  approvals: {
    pending: number;
    latest: Array<{
      id: string;
      title: string;
      riskLevel: string;
      status: string;
    }>;
  };
  safety: {
    effectBoundary: 'ready' | 'missing';
    secretsRedacted: true;
    noRuntimeStart: true;
  };
  nextActions: Array<{
    label: string;
    command: string;
    detail?: string;
  }>;
};
