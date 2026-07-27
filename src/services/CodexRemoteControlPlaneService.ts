import { CodexCliAdapter } from '../agents/CodexCliAdapter.js';
import { ZavorthRemoteTransportService } from './ZavorthRemoteTransportService.js';
import {
  GatewaySessionStoreService,
  type GatewaySessionSpawnSnapshot,
} from '../runtime/sessions/GatewaySessionStoreService.js';
import {
  CodexRemoteProfileRegistryService,
  type CodexRemoteExecutionProfile,
  type CodexRemoteProfileRegistrySnapshot,
} from './CodexRemoteProfileRegistryService.js';
import {
  CodexRemoteReadModelService,
  type CodexRemoteReadModelSnapshot,
} from './CodexRemoteReadModelService.js';
import { CodexRemotePowerShellBrokerClientService } from './CodexRemotePowerShellBrokerClientService.js';



type CodexRemoteControlPlaneRuntime = {
  now?: () => Date;
  codexCliAdapter?: Pick<CodexCliAdapter, 'isAvailable'>;
  remoteTransportService?: Pick<ZavorthRemoteTransportService, 'buildSnapshot'>;
  sessionStoreService?: Pick<GatewaySessionStoreService, 'canSpawn' | 'createSession'>;
  profileRegistryService?: Pick<
    CodexRemoteProfileRegistryService,
    'buildSnapshot' | 'resolveExecutionProfile'
  >;
  readModelService?: Pick<CodexRemoteReadModelService, 'buildSnapshot'>;
  powerShellBrokerClient?: Pick<CodexRemotePowerShellBrokerClientService, 'probe' | 'brokerLockExists'>;
};

export type CodexRemoteControlPlaneSnapshot = {
  generatedAt: string;
  kernel: {
    label: string;
    executionMode: string;
    accountRouting: string;
    remoteTransport: string;
  };
  summary: {
    cliReady: boolean;
    activeProfileId: string;
    profiles: number;
    enabledProfiles: number;
    readyRemotePaths: number;
    partialRemotePaths: number;
    webSpawnReady: boolean;
    trackedSessions: number;
    runningSessions: number;
    pendingApprovals: number;
    visibilityMode: 'full-user-visible';
    staleRunningSessions: number;
  };
  activeProfile: CodexRemoteExecutionProfile;
  profiles: CodexRemoteProfileRegistrySnapshot;
  sessionBroker: CodexRemoteReadModelSnapshot;
  remotePaths: Array<{
    id: string;
    label: string;
    readiness: string;
    available: boolean;
    endpoint: string | null;
    operatorSummary: string;
  }>;
  actions: Array<{
    id:
      | 'select-profile'
      | 'create-profile'
      | 'update-profile'
      | 'delete-profile'
      | 'spawn-web-session'
      | 'inspect'
      | 'start-session'
      | 'resume-session'
      | 'stop-session'
      | 'open-web-session';
    label: string;
    description: string;
    requiresInput: boolean;
  }>;
  handoff: {
    recommendedSurface: 'web' | 'telegram';
    webSessionReady: boolean;
    telegramCommand: string;
    webDraft: GatewaySessionSpawnSnapshot | null;
  };
  visibility: {
    mode: 'full-user-visible';
    approvalBridge: 'visible-when-present';
    pendingApprovals: number;
    note: string;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export class CodexRemoteControlPlaneService {
  private readonly now: () => Date;
  private readonly codexCli: Pick<CodexCliAdapter, 'isAvailable'>;
  private readonly remoteTransports: Pick<ZavorthRemoteTransportService, 'buildSnapshot'>;
  private readonly sessionStore: Pick<GatewaySessionStoreService, 'canSpawn' | 'createSession'>;
  private readonly profiles: Pick<CodexRemoteProfileRegistryService, 'buildSnapshot' | 'resolveExecutionProfile'>;
  private readonly readModel: Pick<CodexRemoteReadModelService, 'buildSnapshot'>;
  private readonly powerShellBroker: Pick<CodexRemotePowerShellBrokerClientService, 'probe' | 'brokerLockExists'>;

  constructor(runtime: CodexRemoteControlPlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.codexCli = runtime.codexCliAdapter || new CodexCliAdapter();
    this.remoteTransports = runtime.remoteTransportService || new ZavorthRemoteTransportService();
    this.sessionStore = runtime.sessionStoreService || new GatewaySessionStoreService();
    this.profiles = runtime.profileRegistryService || new CodexRemoteProfileRegistryService();
    this.readModel = runtime.readModelService || new CodexRemoteReadModelService();
    this.powerShellBroker = runtime.powerShellBrokerClient || new CodexRemotePowerShellBrokerClientService();
  }

  public async buildSnapshot(input: {
    runtimeUserId?: string | null;
    selectedSessionId?: string | null;
  } = {}): Promise<CodexRemoteControlPlaneSnapshot> {
    const profileSnapshot = this.profiles.buildSnapshot();
    const activeProfile = this.profiles.resolveExecutionProfile(profileSnapshot.activeProfileId);
    const registryHealthStatus = String(profileSnapshot.health.status || 'unknown').trim() || 'unknown';
    const registryRecommendedAction = String(profileSnapshot.readiness.recommendedAction || '').trim();
    const cliReady = process.platform === 'win32'
      ? (await this.powerShellBroker.probe({
          codexCliPath: activeProfile.codexCliPath,
          codexHome: activeProfile.codexHome,
          workspaceRoot: activeProfile.workspaceRoot,
        })).available
      : await this.codexCli.isAvailable();
    const remoteTransportSnapshot = this.remoteTransports.buildSnapshot();
    const webSpawnReady = this.sessionStore.canSpawn('web');
    const runtimeUserId = String(input.runtimeUserId || '').trim() || 'web';
    const webDraft = webSpawnReady ? this.sessionStore.createSession({ userId: runtimeUserId, platform: 'web' }) : null;
    const remotePaths = remoteTransportSnapshot.entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      readiness: entry.readiness,
      available: entry.available,
      endpoint: entry.endpoint,
      operatorSummary: entry.operatorSummary,
    }));
    const readyRemotePaths = remotePaths.filter((entry) => entry.readiness === 'ready').length;
    const partialRemotePaths = remotePaths.filter((entry) => entry.readiness === 'partial').length;
    const enabledProfiles = profileSnapshot.profiles.filter((profile) => profile.enabled).length;
    const sessionBroker = await this.readModel.buildSnapshot({
      selectedSessionId: input.selectedSessionId,
    });

    return {
      generatedAt: this.now().toISOString(),
      kernel: {
        label: 'Codex Remote',
        executionMode: process.platform === 'win32' ? 'powershell-broker' : 'codex-cli-broker',
        accountRouting: 'profile-routed',
        remoteTransport: process.platform === 'win32' ? 'powershell-file-broker' : 'zavorth-remote-plane',
      },
      summary: {
        cliReady,
        activeProfileId: activeProfile.id,
        profiles: profileSnapshot.profiles.length,
        enabledProfiles,
        readyRemotePaths,
        partialRemotePaths,
        webSpawnReady,
        trackedSessions: sessionBroker.summary.totalSessions,
        runningSessions: sessionBroker.summary.runningSessions,
        pendingApprovals: sessionBroker.summary.pendingApprovals,
        visibilityMode: 'full-user-visible',
        staleRunningSessions: sessionBroker.summary.staleRunningSessions,
      },
      activeProfile,
      profiles: profileSnapshot,
      sessionBroker,
      remotePaths,
      actions: [
        {
          id: 'inspect',
          label: 'Inspecionar Codex Remote',
          description: 'Updates readiness, profiles, sessions, and remote Codex CLI paths.',
          requiresInput: false,
        },
        {
          id: 'select-profile',
          label: 'Selecionar profile',
          description: 'Changes the active Codex Remote profile for upcoming handoffs and executions.',
          requiresInput: true,
        },
        {
          id: 'create-profile',
          label: 'Criar profile',
          description: 'Cria um profile adicional do Codex Remote para outra conta, workspace ou CODEX_HOME.',
          requiresInput: true,
        },
        {
          id: 'update-profile',
          label: 'Atualizar profile',
          description: 'Atualiza os metadados operacionais de um profile existente do Codex Remote.',
          requiresInput: true,
        },
        {
          id: 'delete-profile',
          label: 'Remover profile',
          description: 'Remove um profile armazenado do Codex Remote without afetar o profile default do host.',
          requiresInput: true,
        },
        {
          id: 'start-session',
          label: 'Start session',
          description: 'Cria uma session rastreavel do Codex Remote e starts o Codex CLI em background.',
          requiresInput: true,
        },
        {
          id: 'resume-session',
          label: 'resume session',
          description: 'Resumes a session registered by the Codex Remote broker.',
          requiresInput: true,
        },
        {
          id: 'stop-session',
          label: 'Stop session',
          description: 'Interrupts a session currently running.',
          requiresInput: true,
        },
        {
          id: 'spawn-web-session',
          label: 'Open web session',
          description: 'Prepara handoff remote do Codex em uma session web nova do Zavorth.',
          requiresInput: false,
        },
        {
          id: 'open-web-session',
          label: 'Attach web session',
          description: 'Abre um handoff web para uma session do Codex Remote already existente.',
          requiresInput: true,
        },
      ],
      handoff: {
        recommendedSurface: webSpawnReady ? 'web' : 'telegram',
        webSessionReady: webSpawnReady,
        telegramCommand: '/codexremote help',
        webDraft,
      },
      visibility: {
        mode: 'full-user-visible',
        approvalBridge: 'visible-when-present',
        pendingApprovals: sessionBroker.summary.pendingApprovals,
        note: sessionBroker.visibility.note,
      },
      narrative: {
        headline: `Codex Remote com ${profileSnapshot.profiles.length} profile(is), ${remotePaths.length} transport(s) e ${sessionBroker.summary.totalSessions} session(s).`,
        operatorSummary: [
          cliReady ? 'Codex CLI respondendo.' : 'Codex CLI ainda unavailable.',
          `Perfil active: ${activeProfile.label}.`,
          `Saude do registry: ${registryHealthStatus}.`,
          `${readyRemotePaths} transport(s) remote(s) ready.`,
          `${sessionBroker.summary.runningSessions} session(s) running.`,
          `${sessionBroker.summary.pendingApprovals} pending approval(s).`,
          sessionBroker.visibility.note,
        ].join(' '),
        nextAction: sessionBroker.summary.totalSessions > 0
          ? 'review a session mais recente e abrir handoff web se need trocar de contexto.'
          : registryRecommendedAction === 'create-profile'
            ? 'Criar um profile adicional do Codex Remote before do primeiro handoff entre contas.'
          : webSpawnReady ? 'Criar a primeira session do Codex Remote ou abrir uma session web de handoff.'
            : 'review transporte remote e readiness of the host before do handoff.',
      },
    };
  }
}
