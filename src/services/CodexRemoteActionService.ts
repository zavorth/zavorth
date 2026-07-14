import {
  CodexRemoteControlPlaneService,
  type CodexRemoteControlPlaneSnapshot,
} from './CodexRemoteControlPlaneService.js';
import {
  CodexRemoteProfileRegistryService,
  type CodexRemoteExecutionProfile,
} from './CodexRemoteProfileRegistryService.js';
import { PermissionService } from './PermissionService.js';
import {
  CodexRemoteSessionBrokerService,
  type CodexRemoteBrokerSessionDetail,
} from './CodexRemoteSessionBrokerService.js';


import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import {
  GatewaySessionStoreService,
  type GatewaySessionSpawnSnapshot,
} from '../runtime/sessions/GatewaySessionStoreService.js';

type CodexRemoteActionId =
  | 'inspect'
  | 'select-profile'
  | 'create-profile'
  | 'update-profile'
  | 'delete-profile'
  | 'spawn-web-session'
  | 'start-session'
  | 'resume-session'
  | 'stop-session'
  | 'open-web-session'
  | 'approve-permission'
  | 'reject-permission';

type CodexRemoteActionRuntime = {
  controlPlaneService?: Pick<CodexRemoteControlPlaneService, 'buildSnapshot'>;
  profileRegistryService?: Pick<
    CodexRemoteProfileRegistryService,
    'selectProfile' | 'upsertProfile' | 'deleteProfile'
  >;
  permissionService?: Pick<
    PermissionService,
    'createRequest' | 'getRequest' | 'approveRequest' | 'rejectRequest'
  >;
  sessionStoreService?: Pick<GatewaySessionStoreService, 'canSpawn' | 'createSession'>;
  sessionBrokerService?: Pick<
    CodexRemoteSessionBrokerService,
    'startSession' | 'resumeSession' | 'stopSession' | 'openWebSession' | 'attachSpawnedWebSession' | 'readSession'
  >;
  runtimeUserId?: string | null;
};

type SessionSpawnerLike = {
  spawnSession: (input: { userId: string; platform?: string | null }) => GatewaySessionSpawnSnapshot | Promise<GatewaySessionSpawnSnapshot>;
};

export type CodexRemoteActionExecution = {
  action: {
    status: 'completed' | 'pending-approval' | 'rejected';
    actionId: CodexRemoteActionId;
    label: string;
    note: string;
    targetPanel: 'codex-remote';
    selectedProfileId?: string | null;
    openSessionId?: string | null;
    handoffCommand?: string | null;
    codexSessionId?: string | null;
    permissionId?: string | null;
  };
  codexRemote: CodexRemoteControlPlaneSnapshot;
  profile: CodexRemoteExecutionProfile | null;
  spawnedSession: GatewaySessionSpawnSnapshot | null;
  session: CodexRemoteBrokerSessionDetail | null;
  permission: PermissionRequest | null;
};

export class CodexRemoteActionService {
  private readonly controlPlane: Pick<CodexRemoteControlPlaneService, 'buildSnapshot'>;
  private readonly profiles: Pick<
    CodexRemoteProfileRegistryService,
    'selectProfile' | 'upsertProfile' | 'deleteProfile'
  >;
  private readonly permissions: Pick<
    PermissionService,
    'createRequest' | 'getRequest' | 'approveRequest' | 'rejectRequest'
  >;
  private readonly sessionStore: Pick<GatewaySessionStoreService, 'canSpawn' | 'createSession'>;
  private readonly broker: Pick<
    CodexRemoteSessionBrokerService,
    'startSession' | 'resumeSession' | 'stopSession' | 'openWebSession' | 'attachSpawnedWebSession' | 'readSession'
  >;
  private readonly runtimeUserId: string | null;

  constructor(runtime: CodexRemoteActionRuntime = {}) {
    this.controlPlane = runtime.controlPlaneService || new CodexRemoteControlPlaneService();
    this.profiles = runtime.profileRegistryService || new CodexRemoteProfileRegistryService();
    this.permissions = runtime.permissionService || new PermissionService();
    this.sessionStore = runtime.sessionStoreService || new GatewaySessionStoreService();
    this.broker = runtime.sessionBrokerService || new CodexRemoteSessionBrokerService();
    this.runtimeUserId = String(runtime.runtimeUserId || '').trim() || null;
  }

  public async execute(input: {
    actionId: CodexRemoteActionId;
    profileId?: string | null;
    profileLabel?: string | null;
    profileDescription?: string | null;
    codexCliPath?: string | null;
    codexHome?: string | null;
    prompt?: string | null;
    title?: string | null;
    sessionId?: string | null;
    permissionId?: string | null;
    decisionNote?: string | null;
    workspaceRoot?: string | null;
    runtimeUserId?: string | null;
    sourceSurface?: string | null;
    sourceChatId?: string | null;
    requireApproval?: boolean;
    skipApproval?: boolean;
    sessionSpawner?: SessionSpawnerLike | null;
  }): Promise<CodexRemoteActionExecution> {
    const actionId = input.actionId;
    const runtimeUserId = String(input.runtimeUserId || this.runtimeUserId || '').trim() || 'web';
    const normalizedProfileId = this.normalizeIdentifier(input.profileId, { stripTerminalPunctuation: true });
    const normalizedSessionId = this.normalizeIdentifier(input.sessionId, { stripTerminalPunctuation: true });
    const normalizedPermissionId = this.normalizeIdentifier(input.permissionId, { stripTerminalPunctuation: true });
    const normalizedWorkspaceRoot = String(input.workspaceRoot || '').trim() || null;

    if (actionId === 'approve-permission') {
      return this.handleApprovePermission({
        permissionId: normalizedPermissionId,
        decisionNote: input.decisionNote,
      }, runtimeUserId);
    }

    if (actionId === 'reject-permission') {
      return this.handleRejectPermission({
        permissionId: normalizedPermissionId,
        decisionNote: input.decisionNote,
      }, runtimeUserId);
    }

    if (this.shouldRequestApproval(actionId, input.requireApproval, input.skipApproval)) {
      return this.createApprovalRequest({
        ...input,
        profileId: normalizedProfileId,
        sessionId: normalizedSessionId,
        workspaceRoot: normalizedWorkspaceRoot,
      }, runtimeUserId);
    }

    if (actionId === 'inspect') {
      const codexRemote = await this.controlPlane.buildSnapshot({ runtimeUserId });
      return {
        action: {
          status: 'completed',
          actionId,
          label: 'Inspecionar Codex Remote',
          note: 'Snapshot do Codex Remote atualizado.',
          targetPanel: 'codex-remote',
        },
        codexRemote,
        profile: codexRemote.activeProfile,
        spawnedSession: null,
        session: null,
        permission: null,
      };
    }

    if (actionId === 'select-profile') {
      const selectedProfile = this.profiles.selectProfile(String(normalizedProfileId || '').trim());
      const codexRemote = await this.controlPlane.buildSnapshot({ runtimeUserId });
      return {
        action: {
          status: 'completed',
          actionId,
          label: 'Selecionar perfil',
          note: `Perfil ativo alterado para ${selectedProfile.label}.`,
          targetPanel: 'codex-remote',
          selectedProfileId: selectedProfile.id,
        },
        codexRemote,
        profile: selectedProfile,
        spawnedSession: null,
        session: null,
        permission: null,
      };
    }

    if (actionId === 'create-profile' || actionId === 'update-profile') {
      const savedProfile = this.profiles.upsertProfile({
        id: String(normalizedProfileId || '').trim(),
        label: String(input.profileLabel || '').trim() || undefined,
        description: String(input.profileDescription || '').trim() || undefined,
        codexCliPath: String(input.codexCliPath || '').trim() || undefined,
        codexHome: String(input.codexHome || '').trim() || undefined,
        workspaceRoot: normalizedWorkspaceRoot || undefined,
      });
      const codexRemote = await this.controlPlane.buildSnapshot({ runtimeUserId });
      return {
        action: {
          status: 'completed',
          actionId,
          label: actionId === 'create-profile' ? 'Criar perfil' : 'Atualizar perfil',
          note: `Perfil ${savedProfile.label} (${savedProfile.id}) salvo no Codex Remote.`,
          targetPanel: 'codex-remote',
          selectedProfileId: savedProfile.id,
        },
        codexRemote,
        profile: savedProfile,
        spawnedSession: null,
        session: null,
        permission: null,
      };
    }

    if (actionId === 'delete-profile') {
      const targetProfileId = String(normalizedProfileId || '').trim();
      const before = await this.controlPlane.buildSnapshot({ runtimeUserId });
      const deletedProfile =
        before.profiles.profiles.find((profile) => profile.id === targetProfileId)
        || before.activeProfile;
      const deleted = this.profiles.deleteProfile(targetProfileId);
      const codexRemote = await this.controlPlane.buildSnapshot({ runtimeUserId });
      return {
        action: {
          status: 'completed',
          actionId,
          label: 'Remover perfil',
          note: deleted
            ? `Perfil ${deletedProfile.label} (${deletedProfile.id}) removido do Codex Remote.`
            : `Perfil ${targetProfileId || 'n/d'} nao estava presente no Codex Remote.`,
          targetPanel: 'codex-remote',
          selectedProfileId: codexRemote.activeProfile.id,
        },
        codexRemote,
        profile: codexRemote.activeProfile,
        spawnedSession: null,
        session: null,
        permission: null,
      };
    }

    if (actionId === 'start-session') {
      const session = await this.broker.startSession({
        title: input.title,
        prompt: String(input.prompt || '').trim(),
        profileId: normalizedProfileId,
        workspaceRoot: normalizedWorkspaceRoot,
        requestedBy: runtimeUserId,
        sourceSurface: input.sourceSurface || 'web',
        sourceChatId: input.sourceChatId || null,
      });
      const codexRemote = await this.controlPlane.buildSnapshot({ runtimeUserId });
      return {
        action: {
          status: 'completed',
          actionId,
          label: 'Iniciar sessao',
          note: `Sessao ${session.record.sessionId} iniciada no Codex Remote.`,
          targetPanel: 'codex-remote',
          codexSessionId: session.record.sessionId,
        },
        codexRemote,
        profile: codexRemote.activeProfile,
        spawnedSession: null,
        session,
        permission: null,
      };
    }

    if (actionId === 'resume-session') {
      const session = await this.broker.resumeSession({
        sessionId: String(normalizedSessionId || '').trim(),
        prompt: input.prompt,
        requestedBy: runtimeUserId,
      });
      const codexRemote = await this.controlPlane.buildSnapshot({ runtimeUserId });
      return {
        action: {
          status: 'completed',
          actionId,
          label: 'Retomar sessao',
          note: `Sessao ${session.record.sessionId} retomada.`,
          targetPanel: 'codex-remote',
          codexSessionId: session.record.sessionId,
        },
        codexRemote,
        profile: codexRemote.activeProfile,
        spawnedSession: null,
        session,
        permission: null,
      };
    }

    if (actionId === 'stop-session') {
      const session = await this.broker.stopSession(String(normalizedSessionId || '').trim());
      const codexRemote = await this.controlPlane.buildSnapshot({ runtimeUserId });
      return {
        action: {
          status: 'completed',
          actionId,
          label: 'Parar sessao',
          note: `Sessao ${session.record.sessionId} interrompida.`,
          targetPanel: 'codex-remote',
          codexSessionId: session.record.sessionId,
        },
        codexRemote,
        profile: codexRemote.activeProfile,
        spawnedSession: null,
        session,
        permission: null,
      };
    }

    if (actionId === 'open-web-session' && input.sessionSpawner) {
      const spawnedSession = await input.sessionSpawner.spawnSession({
        userId: runtimeUserId,
        platform: 'web',
      });
      this.broker.attachSpawnedWebSession({
        sessionId: String(normalizedSessionId || '').trim(),
        spawnedSession,
      });
      const session = await this.broker.readSession(String(normalizedSessionId || '').trim());
      const codexRemote = await this.controlPlane.buildSnapshot({ runtimeUserId });
      return {
        action: {
          status: 'completed',
          actionId,
          label: 'Anexar sessao web',
          note: `Handoff web preparado para ${normalizedSessionId}.`,
          targetPanel: 'codex-remote',
          codexSessionId: String(normalizedSessionId || '').trim(),
          openSessionId: spawnedSession.sessionId,
          handoffCommand: spawnedSession.handoffCommand,
        },
        codexRemote,
        profile: codexRemote.activeProfile,
        spawnedSession,
        session,
        permission: null,
      };
    }

    if (actionId === 'open-web-session') {
      const spawnedSession = this.broker.openWebSession({
        sessionId: String(normalizedSessionId || '').trim(),
        runtimeUserId,
      });
      const session = await this.broker.readSession(String(normalizedSessionId || '').trim());
      const codexRemote = await this.controlPlane.buildSnapshot({ runtimeUserId });
      return {
        action: {
          status: 'completed',
          actionId,
          label: 'Anexar sessao web',
          note: `Handoff web preparado para ${normalizedSessionId}.`,
          targetPanel: 'codex-remote',
          codexSessionId: String(normalizedSessionId || '').trim(),
          openSessionId: spawnedSession.sessionId,
          handoffCommand: spawnedSession.handoffCommand,
        },
        codexRemote,
        profile: codexRemote.activeProfile,
        spawnedSession,
        session,
        permission: null,
      };
    }

    const sessionSpawner = input.sessionSpawner || null;
    const canSpawnWeb = sessionSpawner ? true : this.sessionStore.canSpawn('web');
    if (!canSpawnWeb) {
      throw new Error('O runtime atual nao pode abrir sessoes web do Codex Remote.');
    }

    const spawnedSession = sessionSpawner
      ? await sessionSpawner.spawnSession({
          userId: runtimeUserId,
          platform: 'web',
        })
      : this.sessionStore.createSession({
          userId: runtimeUserId,
          platform: 'web',
        });
    const codexRemote = await this.controlPlane.buildSnapshot({ runtimeUserId });
    return {
      action: {
        status: 'completed',
        actionId,
        label: 'Abrir sessao web',
        note: 'Sessao web do Codex Remote preparada para handoff.',
        targetPanel: 'codex-remote',
        openSessionId: spawnedSession.sessionId,
        handoffCommand: spawnedSession.handoffCommand,
      },
      codexRemote,
      profile: codexRemote.activeProfile,
      spawnedSession,
      session: null,
      permission: null,
    };
  }

  private shouldRequestApproval(
    actionId: CodexRemoteActionId,
    requireApproval?: boolean,
    skipApproval?: boolean,
  ): boolean {
    if (skipApproval) {
      return false;
    }
    if (requireApproval === true) {
      return true;
    }
    if (requireApproval === false) {
      return false;
    }
    return this.isSensitiveAction(actionId);
  }

  private async createApprovalRequest(
    input: {
      actionId: CodexRemoteActionId;
      profileId?: string | null;
      profileLabel?: string | null;
      profileDescription?: string | null;
      codexCliPath?: string | null;
      codexHome?: string | null;
      prompt?: string | null;
      title?: string | null;
      sessionId?: string | null;
      workspaceRoot?: string | null;
      sourceSurface?: string | null;
      sourceChatId?: string | null;
    },
    runtimeUserId: string,
  ): Promise<CodexRemoteActionExecution> {
    const permission = await this.permissions.createRequest({
      executor: 'codex_remote',
      kind: this.mapPermissionKind(input.actionId),
      scope: 'once',
      workspace: String(input.workspaceRoot || '').trim() || null,
      requested_value: this.mapRequestedValue(input),
      reason: this.buildApprovalReason(input),
      requested_by: runtimeUserId,
      metadata: {
        action_id: input.actionId,
        profile_id: String(input.profileId || '').trim() || null,
        profile_label: String(input.profileLabel || '').trim() || null,
        profile_description: String(input.profileDescription || '').trim() || null,
        codex_cli_path: String(input.codexCliPath || '').trim() || null,
        codex_home: String(input.codexHome || '').trim() || null,
        prompt: String(input.prompt || '').trim() || null,
        title: String(input.title || '').trim() || null,
        session_id: String(input.sessionId || '').trim() || null,
        workspace_root: String(input.workspaceRoot || '').trim() || null,
        source_surface: String(input.sourceSurface || '').trim() || null,
        source_chat_id: String(input.sourceChatId || '').trim() || null,
      },
    });
    const codexRemote = await this.controlPlane.buildSnapshot({ runtimeUserId });
    return {
      action: {
        status: 'pending-approval',
        actionId: input.actionId,
        label: 'Aguardando aprovacao',
        note: `Acao ${input.actionId} pendente de aprovacao. No Telegram voce pode aprovar pelo teclado; em qualquer surface use /codexremote approve ${permission.permission_id} ou /codexremote reject ${permission.permission_id}.`,
        targetPanel: 'codex-remote',
        permissionId: permission.permission_id,
      },
      codexRemote,
      profile: codexRemote.activeProfile,
      spawnedSession: null,
      session: null,
      permission,
    };
  }

  private async handleApprovePermission(
    input: {
      permissionId?: string | null;
      decisionNote?: string | null;
    },
    runtimeUserId: string,
  ): Promise<CodexRemoteActionExecution> {
    const permissionId = String(input.permissionId || '').trim();
    if (!permissionId) {
      throw new Error('permissionId obrigatorio.');
    }
    const permission = await this.permissions.getRequest(permissionId);
    if (!permission || permission.executor !== 'codex_remote') {
      throw new Error(`Permissao do Codex Remote nao encontrada: ${permissionId}.`);
    }
    if (permission.status === 'rejected') {
      throw new Error(`Permissao ${permissionId} ja foi rejeitada e nao pode ser executada.`);
    }
    const approved = permission.status === 'approved'
      ? permission
      : await this.permissions.approveRequest(permissionId, runtimeUserId, {
          decision_note: String(input.decisionNote || '').trim() || 'Aprovado by the operator.',
        });
    const metadata = approved.metadata || {};
    const result = await this.execute({
      actionId: String(metadata.action_id || '').trim() as CodexRemoteActionId,
      profileId: String(metadata.profile_id || '').trim() || null,
      profileLabel: String(metadata.profile_label || '').trim() || null,
      profileDescription: String(metadata.profile_description || '').trim() || null,
      codexCliPath: String(metadata.codex_cli_path || '').trim() || null,
      codexHome: String(metadata.codex_home || '').trim() || null,
      prompt: String(metadata.prompt || '').trim() || null,
      title: String(metadata.title || '').trim() || null,
      sessionId: String(metadata.session_id || '').trim() || null,
      workspaceRoot: String(metadata.workspace_root || '').trim() || null,
      runtimeUserId,
      sourceSurface: String(metadata.source_surface || '').trim() || null,
      sourceChatId: String(metadata.source_chat_id || '').trim() || null,
      skipApproval: true,
    });
    return {
      ...result,
      permission: approved,
      action: {
        ...result.action,
        permissionId: approved.permission_id,
        note: `${result.action.note} Pedido ${approved.permission_id} aprovado e executado.`,
      },
    };
  }

  private async handleRejectPermission(
    input: {
      permissionId?: string | null;
      decisionNote?: string | null;
    },
    runtimeUserId: string,
  ): Promise<CodexRemoteActionExecution> {
    const permissionId = String(input.permissionId || '').trim();
    if (!permissionId) {
      throw new Error('permissionId obrigatorio.');
    }
    const permission = await this.permissions.getRequest(permissionId);
    if (!permission || permission.executor !== 'codex_remote') {
      throw new Error(`Permissao do Codex Remote nao encontrada: ${permissionId}.`);
    }
    const rejected = await this.permissions.rejectRequest(
      permissionId,
      runtimeUserId,
      String(input.decisionNote || '').trim() || 'Rejeitado by the operator.',
    );
    const codexRemote = await this.controlPlane.buildSnapshot({ runtimeUserId });
    return {
      action: {
        status: 'rejected',
        actionId: 'reject-permission',
        label: 'Permissao rejeitada',
        note: `Pedido ${rejected.permission_id} rejeitado.`,
        targetPanel: 'codex-remote',
        permissionId: rejected.permission_id,
      },
      codexRemote,
      profile: codexRemote.activeProfile,
      spawnedSession: null,
      session: null,
      permission: rejected,
    };
  }

  private mapPermissionKind(actionId: CodexRemoteActionId): string {
    switch (actionId) {
      case 'select-profile':
        return 'profile_switch';
      case 'create-profile':
      case 'update-profile':
      case 'delete-profile':
        return 'profile_management';
      case 'start-session':
      case 'resume-session':
      case 'stop-session':
        return 'session_control';
      case 'open-web-session':
      case 'spawn-web-session':
        return 'web_handoff';
      default:
        return 'control_plane';
    }
  }

  private mapRequestedValue(input: {
    actionId: CodexRemoteActionId;
    profileId?: string | null;
    sessionId?: string | null;
    title?: string | null;
  }): string | null {
    if (input.actionId === 'select-profile') {
      return String(input.profileId || '').trim() || null;
    }
    if (
      input.actionId === 'create-profile'
      || input.actionId === 'update-profile'
      || input.actionId === 'delete-profile'
    ) {
      return String(input.profileId || '').trim() || null;
    }
    if (input.actionId === 'start-session') {
      return String(input.title || '').trim() || 'nova-sessao';
    }
    return String(input.sessionId || '').trim() || null;
  }

  private buildApprovalReason(input: {
    actionId: CodexRemoteActionId;
    profileId?: string | null;
    sessionId?: string | null;
  }): string {
    switch (input.actionId) {
      case 'select-profile':
        return `Trocar o perfil ativo do Codex Remote para ${String(input.profileId || '').trim() || 'n/d'}.`;
      case 'create-profile':
        return `Criar o perfil ${String(input.profileId || '').trim() || 'n/d'} no Codex Remote.`;
      case 'update-profile':
        return `Atualizar o perfil ${String(input.profileId || '').trim() || 'n/d'} no Codex Remote.`;
      case 'delete-profile':
        return `Remover o perfil ${String(input.profileId || '').trim() || 'n/d'} do Codex Remote.`;
      case 'start-session':
        return 'Iniciar uma nova sessao do Codex Remote.';
      case 'resume-session':
        return `Retomar a sessao ${String(input.sessionId || '').trim() || 'n/d'} do Codex Remote.`;
      case 'stop-session':
        return `Parar a sessao ${String(input.sessionId || '').trim() || 'n/d'} do Codex Remote.`;
      case 'open-web-session':
      case 'spawn-web-session':
        return 'Abrir um handoff web para uma sessao do Codex Remote.';
      default:
        return 'Executar uma acao do Codex Remote.';
    }
  }

  private isSensitiveAction(actionId: CodexRemoteActionId): boolean {
    return actionId === 'select-profile'
      || actionId === 'create-profile'
      || actionId === 'update-profile'
      || actionId === 'delete-profile'
      || actionId === 'start-session'
      || actionId === 'resume-session'
      || actionId === 'spawn-web-session'
      || actionId === 'open-web-session';
  }

  private normalizeIdentifier(
    value: string | null | undefined,
    options: {
      stripTerminalPunctuation?: boolean;
    } = {},
  ): string | null {
    let normalized = String(value || '').trim();
    if (!normalized) {
      return null;
    }

    normalized = normalized.replace(/^[\s"'`([{<]+|[\s"'`)\]}>]+$/g, '');
    if (options.stripTerminalPunctuation) {
      normalized = normalized.replace(/[.,;:!?]+$/g, '');
    }

    return normalized || null;
  }
}
