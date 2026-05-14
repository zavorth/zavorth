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
    const registryHealthStatus = String((profileSnapshot as any)?.health?.status || 'unknown').trim() || 'unknown';
    const registryRecommendedAction = String((profileSnapshot as any)?.readiness?.recommendedAction || '').trim();
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
          description: 'Atualiza readiness, perfis, sessoes e caminhos remotos do Codex CLI.',
          requiresInput: false,
        },
        {
          id: 'select-profile',
          label: 'Selecionar perfil',
          description: 'Troca o perfil ativo do Codex Remote para os proximos handoffs e execucoes.',
          requiresInput: true,
        },
        {
          id: 'create-profile',
          label: 'Criar perfil',
          description: 'Cria um perfil adicional do Codex Remote para outra conta, workspace ou CODEX_HOME.',
          requiresInput: true,
        },
        {
          id: 'update-profile',
          label: 'Atualizar perfil',
          description: 'Atualiza os metadados operacionais de um perfil existente do Codex Remote.',
          requiresInput: true,
        },
        {
          id: 'delete-profile',
          label: 'Remover perfil',
          description: 'Remove um perfil armazenado do Codex Remote sem afetar o perfil default do host.',
          requiresInput: true,
        },
        {
          id: 'start-session',
          label: 'Iniciar sessao',
          description: 'Cria uma sessao rastreavel do Codex Remote e inicia o Codex CLI em background.',
          requiresInput: true,
        },
        {
          id: 'resume-session',
          label: 'Retomar sessao',
          description: 'Retoma uma sessao registrada pelo broker do Codex Remote.',
          requiresInput: true,
        },
        {
          id: 'stop-session',
          label: 'Parar sessao',
          description: 'Interrompe uma sessao atualmente em execucao.',
          requiresInput: true,
        },
        {
          id: 'spawn-web-session',
          label: 'Abrir sessao web',
          description: 'Prepara handoff remoto do Codex em uma sessao web nova do Zavorth.',
          requiresInput: false,
        },
        {
          id: 'open-web-session',
          label: 'Anexar sessao web',
          description: 'Abre um handoff web para uma sessao do Codex Remote ja existente.',
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
        headline: `Codex Remote com ${profileSnapshot.profiles.length} perfil(is), ${remotePaths.length} transporte(s) e ${sessionBroker.summary.totalSessions} sessao(oes).`,
        operatorSummary: [
          cliReady ? 'Codex CLI respondendo.' : 'Codex CLI ainda indisponivel.',
          `Perfil ativo: ${activeProfile.label}.`,
          `Saude do registry: ${registryHealthStatus}.`,
          `${readyRemotePaths} transporte(s) remoto(s) pronto(s).`,
          `${sessionBroker.summary.runningSessions} sessao(oes) em execucao.`,
          `${sessionBroker.summary.pendingApprovals} aprovacao(oes) pendente(s).`,
          sessionBroker.visibility.note,
        ].join(' '),
        nextAction: sessionBroker.summary.totalSessions > 0
          ? 'Revisar a sessao mais recente e abrir handoff web se precisar trocar de contexto.'
          : registryRecommendedAction === 'create-profile'
            ? 'Criar um perfil adicional do Codex Remote antes do primeiro handoff entre contas.'
          : webSpawnReady
            ? 'Criar a primeira sessao do Codex Remote ou abrir uma sessao web de handoff.'
            : 'Revisar transporte remoto e readiness do host antes do handoff.',
      },
    };
  }
}
