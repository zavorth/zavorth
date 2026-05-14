import type { PlatformGatewayContract } from '../contracts/PlatformContract.js';
import type {
  ChannelLoginQrSnapshot,
  ChannelMeshActionExecution,
  ChannelMeshActionKind,
  ChannelMeshSnapshot,
  ChannelMeshSnapshotEntry,
} from '../contracts/ChannelMeshContract.js';
import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';

export type BroadcastCapableGateway = Pick<
  PlatformGatewayContract,
  'broadcast' | 'resolveBroadcastRecipients' | 'supportsRoleAwareBroadcast'
> & {
  requestLoginQr?: () => Promise<{
    ok?: boolean;
    status?: string;
    summary?: string;
    details?: string[];
    loginQr?: ChannelLoginQrSnapshot | null;
  }>;
  relink?: () => Promise<{ ok?: boolean; summary?: string; details?: string[] }>;
  logout?: () => Promise<{ ok?: boolean; summary?: string; details?: string[] }>;
  readStatus?: () => unknown;
};

type ChannelMeshActionPlane =
  Pick<ZavorthChannelMeshService, 'buildSnapshot'>
  & Partial<Pick<ZavorthChannelMeshService, 'reloadChannelPolicies'>>;

type ZavorthChannelActionRuntime = {
  now?: () => Date;
  channelMeshService?: ChannelMeshActionPlane;
  broadcastGateways?: Partial<Record<string, BroadcastCapableGateway | null | undefined>>;
};

export class ZavorthChannelActionService {
  private readonly now: () => Date;
  private readonly channelMesh: ChannelMeshActionPlane;
  private readonly broadcastGateways: Partial<Record<string, BroadcastCapableGateway | null | undefined>>;

  constructor(runtime: ZavorthChannelActionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.channelMesh = runtime.channelMeshService || new ZavorthChannelMeshService();
    this.broadcastGateways = runtime.broadcastGateways || {};
  }

  public async execute(input: {
    channelId: string;
    actionId: string;
    requestedBy?: string | null;
  }): Promise<ChannelMeshActionExecution> {
    const channelId = this.normalizeChannelId(input.channelId);
    const actionId = this.normalizeActionId(input.actionId);
    if (!channelId) {
      throw new Error('channelId obrigatorio.');
    }
    if (!actionId) {
      throw new Error('actionId obrigatorio.');
    }

    const snapshot = this.channelMesh.buildSnapshot({ selectedId: channelId });
    const selected = snapshot.selected;
    if (!selected || this.normalizeChannelId(selected.id) !== channelId) {
      throw new Error(`Canal nao encontrado: ${channelId}.`);
    }

    switch (actionId) {
      case 'inspect':
        return this.finish(actionId, selected, snapshot, 'manual', 'Inspecao do canal pronta.', [
          selected.summary,
          selected.operatorSummary,
          selected.actionHint,
        ]);
      case 'status':
        return this.finish(actionId, selected, snapshot, 'manual', `Status de ${selected.label} pronto para exibicao.`, [
          selected.summary,
          ...this.renderStatusRows(selected),
          selected.lastEventAt ? `Ultimo evento: ${selected.lastEventAt}.` : '',
          selected.loginQr?.supported ? `QR: ${selected.loginQr.state}. ${selected.loginQr.nextStep}` : '',
        ].filter(Boolean));
      case 'policy':
        return this.finish(actionId, selected, snapshot, 'manual', `${selected.label} resumido em policy operacional.`, [
          `Readiness: ${selected.readiness}.`,
          `Transporte: ${selected.transport}.`,
          `Inbound: ${selected.features.inbound ? 'sim' : 'nao'} | Outbound: ${selected.features.outbound ? 'sim' : 'nao'}.`,
          `Threads: ${selected.features.threads ? 'sim' : 'nao'} | Group policy: ${selected.features.groupPolicy ? 'sim' : 'nao'}.`,
          ...(selected.notes || []).slice(0, 4),
        ]);
      case 'policy-reload':
        return this.executePolicyReload(selected, input.requestedBy || null);
      case 'prepare':
        return this.executePrepare(selected, snapshot);
      case 'broadcast-test':
        return this.executeBroadcastTest(selected, snapshot, input.requestedBy || null, 'broadcast-test');
      case 'send-test':
        return this.executeBroadcastTest(selected, snapshot, input.requestedBy || null, 'send-test');
      case 'doctor':
        return this.finish(actionId, selected, snapshot, 'manual', `Doctor de ${selected.label} preparado.`, [
          selected.doctorCommand || 'npm run test:channels:smoke',
          selected.lastHealth ? `Ultima leitura de saude: ${selected.lastHealth}.` : 'Ultima leitura de saude indisponivel.',
          selected.operatorNextStep || selected.actionHint,
        ]);
      case 'repair':
        return this.finish(actionId, selected, snapshot, 'manual', `Plano de reparo de ${selected.label} preparado.`, [
          selected.operatorNextStep || selected.actionHint,
          ...this.buildPrepareChecklist(selected),
        ]);
      case 'login-qr':
        return this.executeLoginQr(selected, snapshot);
      case 'relink':
        return this.executeBridgeLifecycleAction(selected, snapshot, 'relink');
      case 'logout':
        return this.executeBridgeLifecycleAction(selected, snapshot, 'logout');
      default:
        throw new Error(`Acao de canal desconhecida: ${actionId}.`);
    }
  }

  private async executePolicyReload(
    selected: ChannelMeshSnapshotEntry,
    requestedBy: string | null,
  ): Promise<ChannelMeshActionExecution> {
    if (!this.channelMesh.reloadChannelPolicies) {
      throw new Error('Channel Mesh nao expoe reload de policy neste runtime.');
    }

    const channelId = this.normalizeChannelId(selected.id);
    const result = await this.channelMesh.reloadChannelPolicies({
      selectedId: channelId,
      actor: requestedBy || 'operator',
      reason: 'channel-mesh-action',
    });
    const receipt = result.receipt;
    const changedChannels = receipt.changedChannels.length > 0
      ? receipt.changedChannels.join(', ')
      : 'nenhum canal com diferenca detectada';
    const refreshedSelected = result.selected || selected;

    return {
      generatedAt: receipt.reloadedAt || this.now().toISOString(),
      channelId,
      actionId: 'policy-reload',
      status: 'applied',
      ok: true,
      summary: `Policy de ${refreshedSelected.label} recarregada sem reiniciar gateways ativos.`,
      details: [
        `Fonte: ${receipt.source}.`,
        `Solicitado por: ${receipt.actor}.`,
        `Policies carregadas: ${receipt.previousPolicyCount} -> ${receipt.nextPolicyCount}.`,
        `Canais alterados: ${changedChannels}.`,
      ],
      selected: result.snapshot.selected,
      snapshot: result.snapshot,
      policyReloadReceipt: receipt,
    };
  }

  private executePrepare(
    selected: ChannelMeshSnapshotEntry,
    snapshot: ChannelMeshSnapshot,
  ): ChannelMeshActionExecution {
    const details = [
      `Proximo passo oficial: ${selected.actionHint}`,
      ...(selected.notes || []).slice(0, 4),
      ...this.buildPrepareChecklist(selected),
    ];
    return this.finish(
      'prepare',
      selected,
      snapshot,
      'manual',
      `${selected.label} preparado para o proximo passo do Channel Mesh.`,
      details,
    );
  }

  private async executeBroadcastTest(
    selected: ChannelMeshSnapshotEntry,
    snapshot: ChannelMeshSnapshot,
    requestedBy: string | null,
    actionId: Extract<ChannelMeshActionKind, 'broadcast-test' | 'send-test'>,
  ): Promise<ChannelMeshActionExecution> {
    const gateway = this.broadcastGateways[this.normalizeChannelId(selected.id)] || null;
    if (!selected.features.outbound) {
      return this.finish(
        actionId,
        selected,
        snapshot,
        'manual',
        `${selected.label} ainda nao expoe outbound suficiente para um broadcast de teste.`,
        [
          selected.summary,
          'Use o channel mesh para revisar transporte, policy e proximo passo antes de ampliar rollout.',
        ],
      );
    }
    if (!this.isDefaultLiveActionAllowed(selected)) {
      return this.finish(
        actionId,
        selected,
        snapshot,
        'manual',
        `${selected.label} nao esta live-ready para envio padrao.`,
        [
          selected.defaultBlockReason || 'Canal configurado, mas sem prova live suficiente para envio.',
          `Proof: ${selected.readinessProof || 'unknown'}.`,
          'Rode doctor, valide webhook/bridge ou faca um probe live explicito antes de enviar payload real.',
        ],
      );
    }
    if (!gateway?.broadcast) {
      throw new Error(`Canal ${selected.label} ainda nao tem bridge de broadcast operacional neste runtime.`);
    }

    const roles = gateway.supportsRoleAwareBroadcast === false ? [] : ['admin', 'operator'];
    const recipients = await this.resolveRecipients(gateway, roles);
    const testMessage =
      `Teste do Channel Mesh em ${selected.label}.\n`
      + `Transporte: ${selected.transport}.\n`
      + `Solicitado por: ${requestedBy || 'operator'}.\n`
      + `Emitido em: ${this.now().toLocaleString('en-US')}.`;

    await gateway.broadcast(testMessage, roles);

    return this.finish(
      actionId,
      selected,
      snapshot,
      'applied',
      `Teste de broadcast enviado para ${selected.label}.`,
      [
        recipients.length > 0
          ? `Recipientes previstos: ${recipients.length}.`
          : 'Recipientes previstos nao puderam ser enumerados neste runtime.',
        'O canal recebeu um payload curto de verificacao, sem alterar sessions ou state global.',
      ],
    );
  }

  private async executeLoginQr(
    selected: ChannelMeshSnapshotEntry,
    snapshot: ChannelMeshSnapshot,
  ): Promise<ChannelMeshActionExecution> {
    const channelId = this.normalizeChannelId(selected.id);
    const gateway = this.broadcastGateways[channelId] || null;
    if (!selected.features.qrLogin && !selected.loginQr?.supported) {
      return {
        ...this.finish(
          'login-qr',
          selected,
          snapshot,
          'manual',
          `${selected.label} nao usa login por QR neste provider.`,
          [
            selected.loginQr?.nextStep || selected.actionHint,
          ],
        ),
        loginQr: selected.loginQr || null,
      };
    }

    if (typeof gateway?.requestLoginQr !== 'function') {
      return {
        ...this.finish(
          'login-qr',
          selected,
          snapshot,
          'manual',
          `${selected.label} ainda nao expoe QR pelo gateway ativo.`,
          [
            'Conecte o runtime local que publica qr.txt na sessao ou implemente requestLoginQr no gateway.',
            selected.loginQr?.nextStep || selected.actionHint,
          ],
        ),
        loginQr: selected.loginQr || null,
      };
    }

    const receipt = await gateway.requestLoginQr();
    return {
      generatedAt: this.now().toISOString(),
      channelId,
      actionId: 'login-qr',
      status: receipt.ok ? 'applied' : 'manual',
      ok: receipt.ok === true,
      summary: receipt.summary || `QR de ${selected.label} consultado.`,
      details: Array.isArray(receipt.details) && receipt.details.length > 0
        ? receipt.details
        : [selected.loginQr?.nextStep || selected.actionHint],
      selected: snapshot.selected,
      snapshot,
      loginQr: receipt.loginQr || selected.loginQr || null,
    };
  }

  private async executeBridgeLifecycleAction(
    selected: ChannelMeshSnapshotEntry,
    snapshot: ChannelMeshSnapshot,
    actionId: Extract<ChannelMeshActionKind, 'relink' | 'logout'>,
  ): Promise<ChannelMeshActionExecution> {
    const channelId = this.normalizeChannelId(selected.id);
    const gateway = this.broadcastGateways[channelId] || null;
    const method = actionId === 'relink' ? gateway?.relink : gateway?.logout;

    if (!this.isDefaultLiveActionAllowed(selected)) {
      return this.finish(
        actionId,
        selected,
        snapshot,
        'manual',
        actionId === 'relink'
          ? `Pareamento de ${selected.label} exige canal live-ready.`
          : `Logout de ${selected.label} exige canal live-ready.`,
        [
          selected.defaultBlockReason || 'Canal sem prova live suficiente para alterar ciclo de sessao.',
          `Proof: ${selected.readinessProof || 'unknown'}.`,
          'Use prepare/doctor/login-qr antes de executar ciclo de bridge em runtime real.',
        ],
      );
    }

    if (typeof method === 'function') {
      const receipt = await method.call(gateway);
      return this.finish(
        actionId,
        selected,
        snapshot,
        receipt.ok === false ? 'manual' : 'applied',
        receipt.summary || `${selected.label} atualizou ciclo de sessao.`,
        Array.isArray(receipt.details) && receipt.details.length > 0
          ? receipt.details
          : [selected.operatorNextStep || selected.actionHint],
      );
    }

    return this.finish(
      actionId,
      selected,
      snapshot,
      'manual',
      actionId === 'relink'
        ? `Pareamento de ${selected.label} preparado.`
        : `Encerramento de sessao de ${selected.label} preparado.`,
      actionId === 'relink'
        ? [
            'Pare o runtime local do canal.',
            'Remova ou rotacione a sessao local somente depois de confirmar que nao ha envio em andamento.',
            'Solicite /channels login-qr whatsapp para gerar novo QR quando a bridge publicar qr.txt.',
          ]
        : [
            'Pare o runtime local antes de remover sessoes persistentes.',
            'Revogue tokens/provider no painel oficial quando o canal usa API externa.',
            'Mantenha allowlists e audit logs intactos para investigacao posterior.',
          ],
    );
  }

  private async resolveRecipients(
    gateway: BroadcastCapableGateway,
    roles: string[],
  ): Promise<string[]> {
    if (typeof gateway.resolveBroadcastRecipients !== 'function') {
      return [];
    }

    const result = await gateway.resolveBroadcastRecipients(roles);
    return Array.isArray(result)
      ? result.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
  }

  private finish(
    actionId: ChannelMeshActionKind,
    selected: ChannelMeshSnapshotEntry,
    snapshot: ChannelMeshSnapshot,
    status: ChannelMeshActionExecution['status'],
    summary: string,
    details: string[],
  ): ChannelMeshActionExecution {
    return {
      generatedAt: this.now().toISOString(),
      channelId: this.normalizeChannelId(selected.id),
      actionId,
      status,
      ok: status !== 'noop',
      summary,
      details,
      selected: snapshot.selected,
      snapshot,
    };
  }

  private normalizeChannelId(value: string | null | undefined): string {
    return String(value || '').trim().toLowerCase();
  }

  private normalizeActionId(value: string | null | undefined): ChannelMeshActionKind | '' {
    const normalized = String(value || '').trim().toLowerCase().split(':').pop() || '';
    switch (normalized) {
      case 'inspect':
      case 'status':
      case 'policy':
      case 'policy-reload':
      case 'prepare':
      case 'broadcast-test':
      case 'send-test':
      case 'doctor':
      case 'repair':
      case 'login-qr':
      case 'relink':
      case 'logout':
        return normalized;
      default:
        return '';
    }
  }

  private isDefaultLiveActionAllowed(selected: ChannelMeshSnapshotEntry): boolean {
    return selected.defaultRouteAllowed === true;
  }

  private buildPrepareChecklist(selected: ChannelMeshSnapshotEntry): string[] {
    const channelId = this.normalizeChannelId(selected.id);
    switch (channelId) {
      case 'slack':
        if (selected.transport === 'native' || (selected.notes || []).some((note) => /slack web api|slack nativo/i.test(String(note || '')))) {
          return [
            'Confirme SLACK_BOT_TOKEN e SLACK_SIGNING_SECRET antes de receber eventos reais.',
            'Aponte o Slack para /api/webhooks/slack e valide a assinatura do webhook.',
            'Revise SLACK_ALLOWED_CHANNEL_IDS e o workspace alvo antes de abrir rollout no mesh.',
            'Use /channels broadcast-test slack para validar outbound real apos o bootstrap.',
          ];
        }
        return [
          'Defina o transporte inicial do Slack antes de abrir sessions_send no mesh.',
          'Mapeie policy de workspace/canal/thread e anexos antes do rollout.',
          'Promova o adapter do Slack para runtime supervisionado somente depois do bootstrap de credenciais.',
        ];
      case 'whatsapp':
        if (selected.transport === 'webhook' || (selected.notes || []).some((note) => /cloud api|meta cloud api/i.test(String(note || '')))) {
          return [
            'Confirme WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN e WHATSAPP_WEBHOOK_VERIFY_TOKEN.',
            'Registre /api/webhooks/whatsapp como callback da Cloud API e valide o hub.challenge.',
            'Mantenha WHATSAPP_ALLOWED_CHAT_IDS alinhado aos chats que vao receber rollout no mesh.',
            'Use /channels broadcast-test whatsapp para validar outbound real apos o webhook ficar pronto.',
          ];
        }
        return [
          'Confirme WHATSAPP_ALLOWED_CHAT_IDS para os chats que vao receber testes.',
          'Valide o runtime local supervisionado com /channels broadcast-test whatsapp antes de ampliar o rollout.',
          'Mantenha o adapter em modo local controlado ate promover um provider oficial ou bridge dedicada.',
        ];
      case 'instagram':
        if (selected.transport === 'webhook' || (selected.notes || []).some((note) => /instagram messaging|meta graph|meta instagram/i.test(String(note || '')))) {
          return [
            'Confirme INSTAGRAM_BUSINESS_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_WEBHOOK_VERIFY_TOKEN.',
            'Registre /api/webhooks/instagram como callback da Meta Instagram Messaging API e valide o hub.challenge.',
            'Mantenha INSTAGRAM_ALLOWED_RECIPIENT_IDS alinhado aos recipients autorizados antes do rollout.',
            'Use /channels broadcast-test instagram para validar outbound real apos o webhook ficar pronto.',
          ];
        }
        return [
          'Confirme INSTAGRAM_ALLOWED_RECIPIENT_IDS para os recipients que vao receber testes.',
          'Defina INSTAGRAM_PROVIDER=meta-messaging quando quiser ativar DM real pela Meta.',
          'Valide o outbox local supervisionado com /channels broadcast-test instagram antes de conectar credenciais oficiais.',
        ];
      case 'discord':
        return [
          'Revise guilds/canais permitidos e exposure de slash commands antes de ampliar rollout.',
        ];
      case 'signal':
        return [
          'Confirme signal-cli/JSON-RPC e uma conta dedicada antes de ativar inbound/outbound.',
          'Mantenha ZAVORTH_CHANNEL_POLICY_SIGNAL_OPEN=false e use allowlist por recipient.',
          'Valide o doctor local e o outbox supervisionado antes do envio real.',
        ];
      case 'imessage':
        return [
          'Suba um Node Host macOS e confirme o snapshot da Mac bridge.',
          'Comece com IMESSAGE_READ_ONLY=true e exija approval/trust antes de enviar.',
          'Use allowlist por recipient para evitar automacao invisivel em conversas pessoais.',
        ];
      case 'teams':
        return [
          'Configure tenant, app id e secret do Teams antes de publicar o webhook.',
          'Use allowlist por conversation id antes de expor o bot a um tenant real.',
        ];
      case 'email':
        return [
          'Configure SMTP e allowlist de recipients para notificacoes outbound.',
          'Adicione IMAP apenas quando quiser approvals por resposta de email.',
        ];
      default:
        return ['Revise policy, transporte e prerequisites do canal antes de ampliar operacao.'];
    }
  }

  private renderStatusRows(selected: ChannelMeshSnapshotEntry): string[] {
    if (!Array.isArray(selected.statusRows) || selected.statusRows.length === 0) {
      return [
        `Readiness: ${selected.readiness}.`,
        `Transporte: ${selected.transport}.`,
        `Configurado: ${selected.configured ? 'sim' : 'nao'}.`,
      ];
    }

    return selected.statusRows.map((row) => `${row.label}: ${row.value}.`);
  }
}
