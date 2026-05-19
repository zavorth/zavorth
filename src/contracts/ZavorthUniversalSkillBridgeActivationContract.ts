import type {
  ZavorthUniversalSkillBridgeRegistryAction,
  ZavorthUniversalSkillBridgeRegistrySnapshot,
} from './ZavorthUniversalSkillBridgeRegistryContract.js';

export const ZAVORTH_UNIVERSAL_SKILL_BRIDGE_ACTIVATION_CONTRACT_VERSION =
  '2026-05-10.checkpoint-5' as const;

export type ZavorthUniversalSkillBridgeActivationAction =
  | 'help'
  | 'inspect'
  | 'origin'
  | 'dry-run'
  | 'live-prepare'
  | 'denied';

export type ZavorthUniversalSkillBridgeActivationStatus =
  | 'help'
  | 'ready'
  | 'dry-run'
  | 'approval-required'
  | 'denied'
  | 'not-found';

export type ZavorthUniversalSkillBridgeActivationSurfaceAction = {
  id: string;
  label: string;
  command: string;
  callbackData: string;
  apiPath: string | null;
  style: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  requiresApproval: boolean;
  safeDefault: boolean;
  reason: string;
};

export type ZavorthUniversalSkillBridgeActivationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_UNIVERSAL_SKILL_BRIDGE_ACTIVATION_CONTRACT_VERSION;
  args: string;
  channel: string;
  actorId: string | null;
  action: ZavorthUniversalSkillBridgeActivationAction;
  status: ZavorthUniversalSkillBridgeActivationStatus;
  selectedId: string | null;
  approvalId: string | null;
  intent: string | null;
  report: string;
  registry: ZavorthUniversalSkillBridgeRegistrySnapshot | null;
  registryActions: ZavorthUniversalSkillBridgeRegistryAction[];
  surfaceActions: ZavorthUniversalSkillBridgeActivationSurfaceAction[];
  policy: {
    activationDoesNotExecuteUpstreamCode: true;
    activationUsesRegistryAndBridgeOnly: true;
    dryRunIsDefault: true;
    liveRequiresOwnerApproval: true;
    untrustedSkillContentRemainsWrapped: true;
    channelFallbacksMustKeepSameCommands: true;
  };
  commands: {
    help: '/skills bridge';
    inspect: '/skills bridge <skill>';
    dryRun: '/skills run <skill>';
    live: '/skills live <skill> --approval-id <approval-id>';
    origin: '/skills origin <skill>';
    check: 'npm run zavorth:universal-skill-bridge-activation:check --silent';
    nextStage: 'Runtime gateway - Trust-Governed Skill Expansion at Scale';
  };
};
