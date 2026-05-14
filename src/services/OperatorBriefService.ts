import { config } from '../config/index.js';
import {
  OperationsCockpitService,
  type OperationsCockpitSnapshot,
} from './OperationsCockpitService.js';
import {
  ZavorthBridgeRemoteDoctorHistoryService,
  type ZavorthBridgeRemoteDoctorHistorySummary,
} from './ZavorthBridgeRemoteDoctorHistoryService.js';

type CockpitLike = Pick<OperationsCockpitService, 'readSnapshot'> &
  Partial<Pick<OperationsCockpitService, 'readSnapshotFast' | 'readSnapshotLive'>>;
type DoctorHistoryLike = Pick<ZavorthBridgeRemoteDoctorHistoryService, 'readHistory' | 'summarize'>;

type OperatorBriefRuntime = {
  now?: () => Date;
};

export type OperatorBriefSnapshot = {
  generatedAt: string;
  posture: 'stable' | 'watch' | 'action-needed';
  headline: string;
  highlights: string[];
  channelProviderDoctor?: {
    status: 'passed' | 'failed' | 'skipped' | 'missing';
    stale: boolean;
    checkedAt: string | null;
    label: string;
    summary: string;
    command: string | null;
  };
  remoteTransportDoctor?: {
    status: 'passed' | 'failed' | 'running' | 'skipped' | 'missing';
    stale: boolean;
    checkedAt: string | null;
    label: string;
    summary: string;
    command: string | null;
  };
  maintenanceAutomation?: {
    enabled: boolean;
    lastTriggerSource: 'automation' | 'manual' | 'priority' | null;
    lastPriorityReason: string | null;
    nextPlannedAt: string | null;
    label: string;
    summary: string;
  };
  nextAction: {
    label: string;
    command: string;
    reason: string;
    actionId: string | null;
    manualOnly: boolean;
  };
  zavorthBridge: {
    available: boolean;
    latestIncident: string | null;
    latestSeverity: string | null;
    flappingLikely: boolean;
    repairedRuns: number;
    totalRuns: number;
  };
  text: string;
};

export class OperatorBriefService {
  private readonly now: () => Date;

  constructor(
    private readonly operationsCockpit: CockpitLike,
    private readonly doctorHistoryService: DoctorHistoryLike = new ZavorthBridgeRemoteDoctorHistoryService(),
    runtime: OperatorBriefRuntime = {},
  ) {
    this.now = runtime.now || (() => new Date());
  }

  public readSnapshot(): OperatorBriefSnapshot {
    return this.readSnapshotLive();
  }

  public readSnapshotFast(): OperatorBriefSnapshot {
    const cockpit =
      typeof this.operationsCockpit.readSnapshotFast === 'function'
        ? this.operationsCockpit.readSnapshotFast()
        : this.operationsCockpit.readSnapshot();
    return this.buildSnapshot(cockpit);
  }

  public readSnapshotLive(): OperatorBriefSnapshot {
    const cockpit =
      typeof this.operationsCockpit.readSnapshotLive === 'function'
        ? this.operationsCockpit.readSnapshotLive()
        : this.operationsCockpit.readSnapshot();
    return this.buildSnapshot(cockpit);
  }

  public readSnapshotFromCockpit(cockpit: OperationsCockpitSnapshot): OperatorBriefSnapshot {
    return this.buildSnapshot(cockpit);
  }

  private buildSnapshot(cockpit: OperationsCockpitSnapshot): OperatorBriefSnapshot {
    const doctorHistory = this.doctorHistoryService.summarize(
      this.doctorHistoryService.readHistory(config.zavorthBridgeRemoteDoctorHistoryFile),
      6,
    );
    const posture = this.resolvePosture(cockpit, doctorHistory);
    const channelProviderDoctor = this.buildChannelProviderDoctor(cockpit);
    const remoteTransportDoctor = this.buildRemoteTransportDoctor(cockpit);
    const maintenanceAutomation = this.buildMaintenanceAutomation(cockpit);
    const nextAction = this.resolveNextAction(cockpit, doctorHistory);
    const highlights = this.buildHighlights(
      cockpit,
      doctorHistory,
      maintenanceAutomation.summary,
      channelProviderDoctor?.summary || null,
      remoteTransportDoctor?.summary || null,
    );
    const headline = this.buildHeadline(posture, cockpit, doctorHistory);

    const snapshot: OperatorBriefSnapshot = {
      generatedAt: this.now().toISOString(),
      posture,
      headline,
      highlights,
      channelProviderDoctor,
      remoteTransportDoctor,
      maintenanceAutomation,
      nextAction,
      zavorthBridge: {
        available: doctorHistory.totalRuns > 0,
        latestIncident: doctorHistory.latest?.primaryIncidentCode || null,
        latestSeverity: doctorHistory.latest?.incidentSeverity || null,
        flappingLikely: doctorHistory.stability.flappingLikely,
        repairedRuns: doctorHistory.repairedRuns,
        totalRuns: doctorHistory.totalRuns,
      },
      text: '',
    };

    snapshot.text = this.formatText(snapshot);
    return snapshot;
  }

  private resolvePosture(
    cockpit: OperationsCockpitSnapshot,
    doctorHistory: ZavorthBridgeRemoteDoctorHistorySummary,
  ): OperatorBriefSnapshot['posture'] {
    if (
      cockpit.status === 'degraded' ||
      doctorHistory.stability.flappingLikely ||
      doctorHistory.latest?.incidentSeverity === 'critical' ||
      doctorHistory.latest?.incidentSeverity === 'error'
    ) {
      return 'action-needed';
    }

    if (
      cockpit.status === 'attention' ||
      doctorHistory.latest?.incidentSeverity === 'warning'
    ) {
      return 'watch';
    }

    return 'stable';
  }

  private resolveNextAction(
    cockpit: OperationsCockpitSnapshot,
    doctorHistory: ZavorthBridgeRemoteDoctorHistorySummary,
  ): OperatorBriefSnapshot['nextAction'] {
    const latest = doctorHistory.latest;
    if (latest?.incidentSeverity === 'critical') {
      return {
        label: 'Desbloquear sessao do Windows',
        command: 'Desbloqueie a sessao local do Windows',
        reason: 'Sem sessao interativa, o remoto do ZavorthBridge nao consegue operar.',
        actionId: null,
        manualOnly: true,
      };
    }

    if (doctorHistory.stability.flappingLikely) {
      return {
        label: 'Diagnosticar remoto do ZavorthBridge',
        command: 'npm run zavorthBridge:remote:history',
        reason: 'Ha flapping recente no remoto do ZavorthBridge; vale olhar a tendencia antes de insistir em repair.',
        actionId: 'zavorth-bridge-remote-history',
        manualOnly: false,
      };
    }

    if (latest?.incidentSeverity === 'error' || latest?.incidentSeverity === 'warning') {
      return {
        label: 'Rodar doctor do remoto',
        command: 'npm run zavorthBridge:remote:doctor',
        reason: `O ultimo incidente do ZavorthBridge foi ${latest.primaryIncidentCode}.`,
        actionId: 'zavorth-bridge-remote-doctor',
        manualOnly: false,
      };
    }

    const topAction = cockpit.actions[0];
    if (topAction) {
      return {
        label: topAction.label,
        command: topAction.command,
        reason: topAction.reason,
        actionId: topAction.id || null,
        manualOnly: !topAction.id,
      };
    }

    return {
      label: 'Manter rotina operacional',
      command: 'npm run ops:maintain',
      reason: 'Fluxo padrao para manter o host saudavel.',
      actionId: 'maintenance',
      manualOnly: false,
    };
  }

  private buildHighlights(
    cockpit: OperationsCockpitSnapshot,
    doctorHistory: ZavorthBridgeRemoteDoctorHistorySummary,
    maintenanceAutomationSummary: string,
    channelProviderDoctorSummary: string | null,
    remoteTransportDoctorSummary: string | null,
  ): string[] {
    const discordBridge = cockpit.operations.channels?.discordBridge;
    const nodeMeshSmoke = cockpit.operations.nodeMeshSmoke;
    const zavorthBridgeMobileAccess = cockpit.operations.zavorthBridgeMobileAccess;
    const items = [
      `${cockpit.summary.readySidecars}/${cockpit.summary.enabledSidecars} sidecars habilitados estao prontos.`,
      `Espaco livre: ${cockpit.summary.freeDiskPercent}% | publish ${cockpit.summary.publishAgeLabel}.`,
      maintenanceAutomationSummary,
    ];

    if (doctorHistory.totalRuns > 0) {
      items.push(
        doctorHistory.latest?.readyAfter
          ? `ZavorthBridge remoto esta saudavel; ${doctorHistory.repairedRuns}/${doctorHistory.totalRuns} runs tiveram reparo.`
        : `ZavorthBridge remoto: ultimo incidente ${doctorHistory.latest?.primaryIncidentCode || 'n/d'} (${doctorHistory.latest?.incidentSeverity || 'n/d'}).`,
      );
    } else {
      items.push('ZavorthBridge remoto ainda sem historico operacional registrado.');
    }

    if (nodeMeshSmoke) {
      items.push(
        nodeMeshSmoke.status === 'passed' && !nodeMeshSmoke.stale
          ? `Node Mesh validado por smoke real ${this.formatRelative(nodeMeshSmoke.checkedAt)}; ultimo invoke ${nodeMeshSmoke.recentCapabilityId || 'n/d'}.`
          : nodeMeshSmoke.status === 'passed' && nodeMeshSmoke.stale
            ? `Node Mesh com smoke real vencido ${this.formatRelative(nodeMeshSmoke.checkedAt)}; renove a validacao antes de confiar em invokes remotos.`
          : nodeMeshSmoke.status === 'failed'
            ? (nodeMeshSmoke.error
              ? `Node Mesh falhou no ultimo smoke real: ${nodeMeshSmoke.error}.`
              : 'Node Mesh falhou no ultimo smoke real e precisa de nova validacao.')
            : nodeMeshSmoke.status === 'running'
              ? 'Node Mesh em validacao por smoke real neste momento.'
              : 'Node Mesh ainda sem smoke real recente registrado neste host.',
      );
    }

    if (zavorthBridgeMobileAccess?.status === 'active') {
      items.push(
        `ZavorthBridge mobile ativo via ${zavorthBridgeMobileAccess.mode === 'public' ? 'URL publica' : 'LAN'}${zavorthBridgeMobileAccess.expiresAt ? ` ate ${zavorthBridgeMobileAccess.expiresAt}` : ''}.`,
      );
    } else if (zavorthBridgeMobileAccess?.status === 'expired') {
      items.push('O ultimo lease movel do ZavorthBridge expirou; reabra o acesso antes da proxima sessao no celular.');
    }

    if (channelProviderDoctorSummary) {
      items.push(channelProviderDoctorSummary);
    }

    if (remoteTransportDoctorSummary) {
      items.push(remoteTransportDoctorSummary);
    }

    if (discordBridge?.enabled) {
      items.push(
        discordBridge.started
          ? discordBridge.mode === 'native'
            ? `Gateway nativo do Discord pronto; ${discordBridge.pendingOutbox} envios recentes registrados.`
            : `Discord bridge pronto; inbox ${discordBridge.pendingInbox} e outbox ${discordBridge.pendingOutbox}.`
          : discordBridge.lastError
            ? `${this.describeDiscordChannel(discordBridge.mode)} pendente: ${discordBridge.lastError}.`
            : `${this.describeDiscordChannel(discordBridge.mode)} habilitado, mas ainda nao pronto.`,
      );
    }

    return items;
  }

  private buildMaintenanceAutomation(
    cockpit: OperationsCockpitSnapshot,
  ): NonNullable<OperatorBriefSnapshot['maintenanceAutomation']> {
    const automation = cockpit.operations.maintenanceAutomation;
    const summary = automation.enabled
      ? `Automacao recorrente ativa; proxima janela ${this.formatRelative(automation.nextPlannedAt)}.`
      : 'Automacao recorrente desativada no host atual.';
    const prioritySummary = automation.lastTriggerSource === 'priority'
      ? ` Ultimo autodisparo prioritario: ${automation.lastPriorityReason || 'revalidacao operacional antecipada.'}`
      : '';

    return {
      enabled: automation.enabled,
      lastTriggerSource: automation.lastTriggerSource,
      lastPriorityReason: automation.lastPriorityReason || null,
      nextPlannedAt: automation.nextPlannedAt,
      label: automation.lastTriggerSource === 'priority'
        ? 'Automacao prioritaria'
        : (automation.enabled ? 'Automacao recorrente' : 'Automacao desativada'),
      summary: `${summary}${prioritySummary}`,
    };
  }

  private buildHeadline(
    posture: OperatorBriefSnapshot['posture'],
    cockpit: OperationsCockpitSnapshot,
    doctorHistory: ZavorthBridgeRemoteDoctorHistorySummary,
  ): string {
    if (posture === 'stable') {
      return 'Zavorth estavel e operavel sem atencao imediata.';
    }

    if (posture === 'watch') {
      return doctorHistory.latest
        ? `Zavorth operavel, mas com atencao em ${doctorHistory.latest.primaryIncidentCode}.`
        : 'Zavorth operavel, mas com alguns pontos pedindo acompanhamento.';
    }

    return cockpit.status === 'degraded'
      ? 'Zavorth precisa de acao do operador agora.'
      : 'Zavorth esta funcional, mas ha um incidente operacional relevante.';
  }

  private buildChannelProviderDoctor(
    cockpit: OperationsCockpitSnapshot,
  ): OperatorBriefSnapshot['channelProviderDoctor'] {
    const doctor = cockpit.operations.channelProviderDoctor;
    if (!doctor) {
      return {
        status: 'missing',
        stale: false,
        checkedAt: null,
        label: 'Doctor pendente',
        summary: 'Doctor dos canais nativos ainda nao foi executado neste host.',
        command: 'npm run test:channels:smoke',
      };
    }

    if (doctor.status === 'missing') {
      return {
        status: 'missing',
        stale: false,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor pendente',
        summary: 'Doctor dos canais nativos ainda nao foi executado neste host.',
        command: doctor.recommendedAction || doctor.command || 'npm run test:channels:smoke',
      };
    }

    if (doctor.status === 'skipped') {
      return {
        status: 'skipped',
        stale: false,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor pulado',
        summary:
          doctor.summary || 'Doctor dos canais nativos foi pulado porque nenhum provider real esta configurado.',
        command: doctor.command || 'npm run test:channels:smoke',
      };
    }

    if (doctor.status === 'failed') {
      return {
        status: 'failed',
        stale: false,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor falhou',
        summary:
          doctor.summary || 'Doctor dos canais nativos encontrou pendencias em Slack native ou WhatsApp Cloud API.',
        command: doctor.recommendedAction || doctor.command || 'npm run test:channels:smoke',
      };
    }

    if (doctor.stale) {
      return {
        status: 'passed',
        stale: true,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor vencido',
        summary: `Doctor dos canais nativos venceu ${this.formatRelative(doctor.checkedAt)}; rode ${doctor.recommendedAction || doctor.command || 'npm run test:channels:smoke'} antes de ampliar o rollout.`,
        command: doctor.recommendedAction || doctor.command || 'npm run test:channels:smoke',
      };
    }

    const passedItems = (doctor.items || [])
      .filter((item) => item.status === 'passed')
      .map((item) => this.describeDoctorProvider(item.channelId, item.mode));
    const providerLabel = passedItems.length
      ? passedItems.join(' e ')
      : 'os providers configurados';

    return {
      status: 'passed',
      stale: false,
      checkedAt: doctor.checkedAt || null,
      label: 'Doctor validado',
      summary: `Doctor dos canais nativos validou ${providerLabel} ${this.formatRelative(doctor.checkedAt)}.`,
      command: doctor.command || 'npm run test:channels:smoke',
    };
  }

  private buildRemoteTransportDoctor(
    cockpit: OperationsCockpitSnapshot,
  ): OperatorBriefSnapshot['remoteTransportDoctor'] {
    const doctor = cockpit.operations.remoteTransportDoctor;
    if (!doctor || doctor.status === 'missing') {
      return {
        status: 'missing',
        stale: false,
        checkedAt: null,
        label: 'Doctor pendente',
        summary: 'Doctor dos transportes remotos ainda nao foi executado neste host.',
        command: 'npm run test:transports:smoke',
      };
    }

    if (doctor.status === 'running') {
      return {
        status: 'running',
        stale: false,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor em andamento',
        summary: 'Doctor dos transportes remotos esta em validacao neste momento.',
        command: doctor.command || 'npm run test:transports:smoke',
      };
    }

    if (doctor.status === 'skipped') {
      return {
        status: 'skipped',
        stale: false,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor pulado',
        summary: doctor.summary || 'Doctor dos transportes remotos foi pulado neste host.',
        command: doctor.command || 'npm run test:transports:smoke',
      };
    }

    if (doctor.status === 'failed') {
      return {
        status: 'failed',
        stale: false,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor falhou',
        summary: doctor.summary || 'Doctor dos transportes remotos encontrou pendencias no plano remoto.',
        command: doctor.recommendedAction || doctor.command || 'npm run test:transports:smoke',
      };
    }

    if (doctor.stale) {
      return {
        status: 'passed',
        stale: true,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor vencido',
        summary: `Doctor dos transportes remotos venceu ${this.formatRelative(doctor.checkedAt)}; rode ${doctor.recommendedAction || doctor.command || 'npm run test:transports:smoke'} antes de confiar em sidecars, gateways e nodes pareados.`,
        command: doctor.recommendedAction || doctor.command || 'npm run test:transports:smoke',
      };
    }

    return {
      status: 'passed',
      stale: false,
      checkedAt: doctor.checkedAt || null,
      label: 'Doctor validado',
      summary: `Doctor dos transportes remotos validou sidecars, gateways e nodes pareados ${this.formatRelative(doctor.checkedAt)}.`,
      command: doctor.command || 'npm run test:transports:smoke',
    };
  }

  private formatText(snapshot: OperatorBriefSnapshot): string {
    const lines = [
      'Briefing do operador',
      '',
      `Gerado em: ${snapshot.generatedAt}`,
      `Postura: ${snapshot.posture}`,
      `Headline: ${snapshot.headline}`,
      '',
      'Highlights:',
      ...snapshot.highlights.map((item) => `- ${item}`),
      ...(snapshot.maintenanceAutomation
        ? [
            '',
            'Automacao operacional:',
            `- Estado: ${snapshot.maintenanceAutomation.label}`,
            `- Resumo: ${snapshot.maintenanceAutomation.summary}`,
          ]
        : []),
      ...(snapshot.channelProviderDoctor
        ? [
            '',
            'Canais nativos:',
            `- Estado: ${snapshot.channelProviderDoctor.label}`,
            `- Resumo: ${snapshot.channelProviderDoctor.summary}`,
            ...(snapshot.channelProviderDoctor.command
              ? [`- Comando: ${snapshot.channelProviderDoctor.command}`]
              : []),
          ]
        : []),
      ...(snapshot.remoteTransportDoctor
        ? [
            '',
            'Transportes remotos:',
            `- Estado: ${snapshot.remoteTransportDoctor.label}`,
            `- Resumo: ${snapshot.remoteTransportDoctor.summary}`,
            ...(snapshot.remoteTransportDoctor.command
              ? [`- Comando: ${snapshot.remoteTransportDoctor.command}`]
              : []),
          ]
        : []),
      '',
      'Proxima acao recomendada:',
      `- ${snapshot.nextAction.label}`,
      `- Comando: ${snapshot.nextAction.command}`,
      `- Motivo: ${snapshot.nextAction.reason}`,
    ];

    if (snapshot.zavorthBridge.available) {
      lines.push(
        '',
        'ZavorthBridge remoto:',
        `- Incidente mais recente: ${snapshot.zavorthBridge.latestIncident || 'n/d'} (${snapshot.zavorthBridge.latestSeverity || 'n/d'})`,
        `- Flapping: ${snapshot.zavorthBridge.flappingLikely ? 'sim' : 'nao'}`,
        `- Reparo historico: ${snapshot.zavorthBridge.repairedRuns}/${snapshot.zavorthBridge.totalRuns}`,
      );
    }

    return lines.join('\n');
  }

  private formatRelative(value: string | null): string {
    if (!value) {
      return 'sem agenda';
    }

    const target = Date.parse(value);
    if (!Number.isFinite(target)) {
      return 'data invalida';
    }

    const diffMs = target - this.now().getTime();
    const absoluteMinutes = Math.round(Math.abs(diffMs) / 60000);
    if (absoluteMinutes < 1) {
      return 'agora';
    }
    if (absoluteMinutes < 60) {
      return diffMs >= 0 ? `em ${absoluteMinutes} min` : `ha ${absoluteMinutes} min`;
    }
    const absoluteHours = Math.round(absoluteMinutes / 60);
    if (absoluteHours < 24) {
      return diffMs >= 0 ? `em ${absoluteHours} h` : `ha ${absoluteHours} h`;
    }
    const absoluteDays = Math.round(absoluteHours / 24);
    return diffMs >= 0 ? `em ${absoluteDays} d` : `ha ${absoluteDays} d`;
  }

  private describeDiscordChannel(mode: 'bridge' | 'native' | 'unknown' | undefined): string {
    return mode === 'native' ? 'Gateway nativo do Discord' : 'Discord bridge';
  }

  private describeDoctorProvider(
    channelId: 'slack' | 'whatsapp' | 'telegram' | 'discord' | 'signal' | 'imessage' | 'teams' | 'email',
    mode:
      | 'native'
      | 'cloud-api'
      | 'stub'
      | 'baileys'
      | 'bridge'
      | 'signal-cli'
      | 'mac-bridge'
      | 'graph-bot'
      | 'smtp-imap'
      | 'unknown',
  ): string {
    if (channelId === 'telegram') {
      return 'Telegram';
    }
    if (channelId === 'discord') {
      return mode === 'bridge' ? 'Discord bridge' : 'Discord';
    }
    if (channelId === 'whatsapp') {
      if (mode === 'cloud-api') {
        return 'WhatsApp Cloud API';
      }
      if (mode === 'baileys') {
        return 'WhatsApp Baileys';
      }
      return 'WhatsApp';
    }

    if (channelId === 'signal') {
      return 'Signal bridge';
    }
    if (channelId === 'imessage') {
      return 'iMessage Mac bridge';
    }
    if (channelId === 'teams') {
      return 'Microsoft Teams';
    }
    if (channelId === 'email') {
      return 'Email SMTP/IMAP';
    }

    return mode === 'native' ? 'Slack native' : 'Slack';
  }
}
