export const ZAVORTH_SMART_COMMAND_SURFACE_CONTRACT_VERSION =
  'zavorth-smart-command-surface/1' as const;

export type ZavorthSmartCommandId =
  | 'new'
  | 'reset'
  | 'model'
  | 'personality'
  | 'retry'
  | 'undo'
  | 'compress'
  | 'usage'
  | 'insights'
  | 'skills'
  | 'stop'
  | 'platforms'
  | 'status'
  | 'sethome'
  | 'loop';

export type ZavorthSmartCommandStatus =
  | 'handled'
  | 'preview'
  | 'approval-required'
  | 'not-handled'
  | 'blocked';

export type ZavorthSmartCommandRisk = 'none' | 'low' | 'medium' | 'high';

export type ZavorthSmartCommandExecutionMode =
  | 'read-only'
  | 'session-local'
  | 'state-preview'
  | 'approval-gated';

export type ZavorthSmartCommandResolution = {
  id: ZavorthSmartCommandId;
  aliases: string[];
  label: string;
  summary: string;
  risk: ZavorthSmartCommandRisk;
  executionMode: ZavorthSmartCommandExecutionMode;
  canonicalSlash: string;
  cliCommand: string;
  supportedSurfaces: Array<'cli' | 'zavorthControl' | 'telegram' | 'discord' | 'whatsapp' | 'api'>;
};

export type ZavorthSmartCommandSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SMART_COMMAND_SURFACE_CONTRACT_VERSION;
  surface: 'smart-command-surface';
  status: ZavorthSmartCommandStatus;
  command: {
    raw: string;
    id: ZavorthSmartCommandId | null;
    args: string;
    canonicalSlash: string | null;
    cliEquivalent: string | null;
  };
  channel: string;
  sessionId: string | null;
  reply: {
    title: string;
    body: string;
    hints: string[];
  };
  action: {
    performed: boolean;
    requiresApproval: boolean;
    approvalReason: string | null;
    nextCommand: string | null;
  };
  inventory: {
    commands: number;
    providersKnown: number;
    skillsKnown: number;
    platformsKnown: number;
  };
  policy: {
    slashAndTextUseSameGateway: true;
    readOnlyCommandsDoNotStartRuntime: true;
    stateChangingCommandsPreviewFirst: true;
    riskyCommandsRequireApproval: true;
    crossSurfaceAliasesStable: true;
  };
  safety: {
    noShellExecution: true;
    noNetworkProbe: true;
    noSecretSerialization: true;
    noFilesystemMutationWithoutApproval: true;
    noRuntimeAdapterInvocation: true;
  };
  catalog: ZavorthSmartCommandResolution[];
};
