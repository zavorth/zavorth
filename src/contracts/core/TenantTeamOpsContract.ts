export type TenantTeamOpsCheckStatus = 'pass' | 'warn' | 'fail';
export type TenantTeamOpsSource = 'package' | 'web' | 'governance' | 'tenant' | 'policy' | 'permission' | 'isolation';

export type TenantTeamOpsIdentityScope = {
  tenantId: string;
  platform: string;
  boundary: string;
  scopeLabel: string;
  policyProfile: string;
  governanceStatus: string;
  ownerCount: number;
  allowedGuildCount: number;
  allowedChannelCount: number;
  publicServerMode: boolean;
};

export type TenantTeamOpsPolicyScope = {
  id: string;
  label: string;
  posture: string;
  boundary: string;
  allowlistState: string;
  command: string | null;
};

export type TenantTeamOpsPermissionReadout = {
  tenantId: string;
  status: 'ready' | 'needs-onboarding' | 'restricted' | 'personal';
  owners: number;
  allowedGuilds: number;
  allowedChannels: number;
  guidedActions: number;
  nextAction: string | null;
};

export type TenantTeamOpsProjectReport = {
  id: string;
  label: string;
  workspaceRoot: string;
  tenantCount: number;
  sharedTenants: number;
  teams: number;
  posture: string;
  summary: string;
};

export type TenantTeamOpsIsolationEntry = {
  tenantId: string;
  memoryScope: string;
  artifactScope: string;
  status: 'isolated' | 'personal' | 'attention';
  reason: string;
};

export type TenantTeamOpsCheck = {
  id: string;
  title: string;
  status: TenantTeamOpsCheckStatus;
  source: TenantTeamOpsSource;
  reason: string;
  evidence?: string[];
};

export type TenantTeamOpsSnapshot = {
  gate: 'tenant-team-ops';
  surface: 'tenant-team-ops';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
    tenants: number;
    sharedTenants: number;
    personalTenants: number;
    teams: number;
    policyScopes: number;
    permissionReadouts: number;
    isolatedContexts: number;
    heavyRuntimesStarted: false;
  };
  ops: {
    identityScopes: TenantTeamOpsIdentityScope[];
    policyScopes: TenantTeamOpsPolicyScope[];
    permissionReadouts: TenantTeamOpsPermissionReadout[];
    projectReports: TenantTeamOpsProjectReport[];
    isolationMap: TenantTeamOpsIsolationEntry[];
  };
  checks: TenantTeamOpsCheck[];
  contracts: string[];
  commands: {
    inspect: string;
    json: string;
    gate: string;
    governance: string;
    tenants: string;
  };
  nextRecommendedGate: {
    phase: 'complete';
    title: string;
    reason: string;
  };
};

export const TENANT_TEAM_OPS_PACKAGE_SCRIPTS = [
  'ops:governance',
  'ops:governance:json',
  'tenant:ops',
  'tenant:ops:json',
  'qa:tenant-team-ops',
] as const;

export const TENANT_TEAM_OPS_WEB_MARKERS = [
  'id="tenant-team-ops-card"',
  'id="tenant-team-identity"',
  'id="tenant-team-policy"',
  'id="tenant-team-permissions"',
  'id="tenant-team-isolation"',
  'data-copy="npm run tenant:ops"',
  'data-copy="npm run ops:governance"',
] as const;

export const TENANT_TEAM_OPS_REQUIRED_SURFACES = [
  'tenants',
  'channels',
  'teams',
  'workspace',
] as const;

export const TENANT_TEAM_OPS_CONTRACTS = [
  'Tenant/team ops consolidates operational identity by workspace, tenant, team, and surface without starting a persistent watcher.',
  'Scoped policy must be visible for tenants, channels, teams, and workspace.',
  'Segmented permissions must show owners, guilds, channels, and tenant-guided actions.',
  'Per-project reports use workspaceRoot and governance source snapshots without publishing sensitive data.',
  'Memory and artifacts are represented by tenant/context scopes without mixing payloads across customers or environments.',
  'ZavorthControl must expose identity, policy, permissions, and isolation with copyable commands.',
];
