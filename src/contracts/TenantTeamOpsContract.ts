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
  phase: '42';
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
  nextRecommendedPhase: {
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
  'qa:phase:42',
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
  'Tenant/team ops consolida identidade operacional por workspace, tenant, time e superficie sem iniciar watcher persistente.',
  'Policy por escopo precisa estar visivel para tenants, channels, teams e workspace.',
  'Permissoes segmentadas devem mostrar owners, guilds, channels e acoes guiadas por tenant.',
  'Relatorios por projeto usam workspaceRoot e source snapshots de governance sem publicar dados sensiveis.',
  'Memoria e artifacts ficam representados por escopos de tenant/contexto, sem misturar payloads entre clientes ou ambientes.',
  'A Control UI deve expor identidade, policy, permissoes e isolamento com comandos copiaveis.',
];
