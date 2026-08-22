import { config } from '../config/index.js';
import {
  OperationsCockpitService,
  type OperationsCockpitSnapshot,
} from './OperationsDashboardService.js';
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
        label: 'Desbloquear Windows session',
        command: 'Unlock the local Windows session',
        reason: 'Without interactive session, remote ZavorthBridge cannot operate.',
        actionId: null,
        manualOnly: true,
      };
    }

    if (doctorHistory.stability.flappingLikely) {
      return {
        label: 'Diagnosticar remote do ZavorthBridge',
        command: 'npm run zavorthBridge:remote:history',
        reason: 'Ha flapping recente no remote do ZavorthBridge; vale olhar a trend before insistir at repair.',
        actionId: 'zavorth-bridge-remote-history',
        manualOnly: false,
      };
    }

    if (latest?.incidentSeverity === 'error' || latest?.incidentSeverity === 'warning') {
      return {
        label: 'run doctor do remote',
        command: 'npm run zavorthBridge:remote:doctor',
        reason: `O latest incidente do ZavorthBridge foi ${latest.primaryIncidentCode}.`,
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
      label: 'Keep operational routine',
      command: 'npm run ops:maintain',
      reason: 'Default flow to keep the host healthy.',
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
      `${cockpit.summary.readySidecars}/${cockpit.summary.enabledSidecars} enabled sidecars are ready.`,
      `Free space: ${cockpit.summary.freeDiskPercent}% | publish ${cockpit.summary.publishAgeLabel}.`,
      maintenanceAutomationSummary,
    ];

    if (doctorHistory.totalRuns > 0) {
      items.push(
        doctorHistory.latest?.readyAfter ? `ZavorthBridge remote is healthy; ${doctorHistory.repairedRuns}/${doctorHistory.totalRuns} runs had repair.`
        : `ZavorthBridge remote: latest incident ${doctorHistory.latest?.primaryIncidentCode || 'n/a'} (${doctorHistory.latest?.incidentSeverity || 'n/a'}).`,
      );
    } else {
      items.push('ZavorthBridge remote still has no registered operational history.');
    }

    if (nodeMeshSmoke) {
      items.push(
        nodeMeshSmoke.status === 'passed' && !nodeMeshSmoke.stale ? `Node Mesh validated by real smoke test ${this.formatRelative(nodeMeshSmoke.checkedAt)}; latest invoke ${nodeMeshSmoke.recentCapabilityId || 'n/d'}.`
          : nodeMeshSmoke.status === 'passed' && nodeMeshSmoke.stale ? `Node Mesh has stale real smoke ${this.formatRelative(nodeMeshSmoke.checkedAt)}; renew validation before trusting remote invokes.`
          : nodeMeshSmoke.status === 'failed'
            ? (nodeMeshSmoke.error ? `Node Mesh failed the latest real smoke: ${nodeMeshSmoke.error}.`
              : 'Node Mesh failed the last real smoke and needs new validation.')
            : nodeMeshSmoke.status === 'running'
              ? 'Node Mesh is under real smoke validation right now.'
              : 'Node Mesh still has no recent real smoke registered on this host.',
      );
    }

    if (zavorthBridgeMobileAccess?.status === 'active') {
      items.push(
        `ZavorthBridge mobile active via ${zavorthBridgeMobileAccess.mode === 'public' ? 'public URL' : 'LAN'}${zavorthBridgeMobileAccess.expiresAt ? ` until ${zavorthBridgeMobileAccess.expiresAt}` : ''}.`,
      );
    } else if (zavorthBridgeMobileAccess?.status === 'expired') {
      items.push('The latest mobile ZavorthBridge lease expired; reopen access before the next phone session.');
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
            ? `Native Discord gateway ready; ${discordBridge.pendingOutbox} recent sends registered.`
            : `Discord bridge ready; inbox ${discordBridge.pendingInbox} and outbox ${discordBridge.pendingOutbox}.`
          : discordBridge.lastError ? `${this.describeDiscordChannel(discordBridge.mode)} pending: ${discordBridge.lastError}.`
            : `${this.describeDiscordChannel(discordBridge.mode)} enabled but not ready yet.`,
      );
    }

    return items;
  }

  private buildMaintenanceAutomation(
    cockpit: OperationsCockpitSnapshot,
  ): NonNullable<OperatorBriefSnapshot['maintenanceAutomation']> {
    const automation = cockpit.operations.maintenanceAutomation;
    const summary = automation.enabled ? `Recurring automation active; next window ${this.formatRelative(automation.nextPlannedAt)}.`
      : 'Recurring automation is disabled on the current host.';
    const prioritySummary = automation.lastTriggerSource === 'priority'
      ? ` Latest priority auto-trigger: ${automation.lastPriorityReason || 'early operational revalidation.'}`
      : '';

    return {
      enabled: automation.enabled,
      lastTriggerSource: automation.lastTriggerSource,
      lastPriorityReason: automation.lastPriorityReason || null,
      nextPlannedAt: automation.nextPlannedAt,
      label: automation.lastTriggerSource === 'priority'
        ? 'Priority automation'
        : (automation.enabled ? 'Recurring automation' : 'Automation disabled'),
      summary: `${summary}${prioritySummary}`,
    };
  }

  private buildHeadline(
    posture: OperatorBriefSnapshot['posture'],
    cockpit: OperationsCockpitSnapshot,
    doctorHistory: ZavorthBridgeRemoteDoctorHistorySummary,
  ): string {
    if (posture === 'stable') {
      return 'Zavorth is stable and operable without immediate attention.';
    }

    if (posture === 'watch') {
      return doctorHistory.latest ? `Zavorth is operable, but has attention on ${doctorHistory.latest.primaryIncidentCode}.`
        : 'Zavorth is operable, with a few points needing follow-up.';
    }

    return cockpit.status === 'degraded'
      ? 'Zavorth needs operator action now.'
      : 'Zavorth is functional, but there is a relevant operational incident.';
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
        label: 'Doctor pending',
        summary: 'Native channel doctor has not been executed on this host yet.',
        command: 'npm run test:channels:smoke',
      };
    }

    if (doctor.status === 'missing') {
      return {
        status: 'missing',
        stale: false,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor pending',
        summary: 'Native channel doctor has not been executed on this host yet.',
        command: doctor.recommendedAction || doctor.command || 'npm run test:channels:smoke',
      };
    }

    if (doctor.status === 'skipped') {
      return {
        status: 'skipped',
        stale: false,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor skipped',
        summary:
          doctor.summary || 'Native channel doctor was skipped because no real provider is configured.',
        command: doctor.command || 'npm run test:channels:smoke',
      };
    }

    if (doctor.status === 'failed') {
      return {
        status: 'failed',
        stale: false,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor failed',
        summary:
          doctor.summary || 'Native channel doctor found pending items in native Slack or WhatsApp Cloud API.',
        command: doctor.recommendedAction || doctor.command || 'npm run test:channels:smoke',
      };
    }

    if (doctor.stale) {
      return {
        status: 'passed',
        stale: true,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor stale',
        summary: `Native channel doctor became stale ${this.formatRelative(doctor.checkedAt)}; run ${doctor.recommendedAction || doctor.command || 'npm run test:channels:smoke'} before expanding rollout.`,
        command: doctor.recommendedAction || doctor.command || 'npm run test:channels:smoke',
      };
    }

    const passedItems = (doctor.items || [])
      .filter((item) => item.status === 'passed')
      .map((item) => this.describeDoctorProvider(
        item.channelId as 'slack' | 'whatsapp' | 'telegram' | 'discord' | 'signal' | 'imessage' | 'teams' | 'email',
        item.mode as 'native' | 'cloud-api' | 'local' | 'baileys' | 'bridge' | 'signal-cli' | 'mac-bridge' | 'graph-bot' | 'smtp-imap' | 'unknown'
      ));
    const providerLabel = passedItems.length
      ? passedItems.join(' e ')
      : 'the configured providers';

    return {
      status: 'passed',
      stale: false,
      checkedAt: doctor.checkedAt || null,
      label: 'Doctor validated',
      summary: `Native channel doctor validated ${providerLabel} ${this.formatRelative(doctor.checkedAt)}.`,
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
        label: 'Doctor pending',
        summary: 'Remote transport doctor has not been executed on this host yet.',
        command: 'npm run test:transports:smoke',
      };
    }

    if (doctor.status === 'running') {
      return {
        status: 'running',
        stale: false,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor running',
        summary: 'Doctor dos remote transports is at validation neste momento.',
        command: doctor.command || 'npm run test:transports:smoke',
      };
    }

    if (doctor.status === 'skipped') {
      return {
        status: 'skipped',
        stale: false,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor pulado',
        summary: doctor.summary || 'Doctor dos remote transports foi pulado on this host.',
        command: doctor.command || 'npm run test:transports:smoke',
      };
    }

    if (doctor.status === 'failed') {
      return {
        status: 'failed',
        stale: false,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor failed',
        summary: doctor.summary || 'Remote transport doctor found pending items in the remote plan.',
        command: doctor.recommendedAction || doctor.command || 'npm run test:transports:smoke',
      };
    }

    if (doctor.stale) {
      return {
        status: 'passed',
        stale: true,
        checkedAt: doctor.checkedAt || null,
        label: 'Doctor vencido',
        summary: `Doctor dos remote transports venceu ${this.formatRelative(doctor.checkedAt)}; run ${doctor.recommendedAction || doctor.command || 'npm run test:transports:smoke'} before trusting paired sidecars, gateways, and nodes.`,
        command: doctor.recommendedAction || doctor.command || 'npm run test:transports:smoke',
      };
    }

    return {
      status: 'passed',
      stale: false,
      checkedAt: doctor.checkedAt || null,
      label: 'Doctor validated',
      summary: `Remote transport doctor validated sidecars, gateways, and paired nodes ${this.formatRelative(doctor.checkedAt)}.`,
      command: doctor.command || 'npm run test:transports:smoke',
    };
  }

  private formatText(snapshot: OperatorBriefSnapshot): string {
    const lines = [
      'Briefing the operator',
      '',
      `Generated at: ${snapshot.generatedAt}`,
      `Posture: ${snapshot.posture}`,
      `Headline: ${snapshot.headline}`,
      '',
      'Highlights:',
      ...snapshot.highlights.map((item) => `- ${item}`),
      ...(snapshot.maintenanceAutomation
        ? [
            '',
            'Operational automation:',
            `- Estado: ${snapshot.maintenanceAutomation.label}`,
            `- Resumo: ${snapshot.maintenanceAutomation.summary}`,
          ]
        : []),
      ...(snapshot.channelProviderDoctor
        ? [
            '',
            'Native channels:',
            `- Estado: ${snapshot.channelProviderDoctor.label}`,
            `- Resumo: ${snapshot.channelProviderDoctor.summary}`,
            ...(snapshot.channelProviderDoctor.command
              ? [`- Command: ${snapshot.channelProviderDoctor.command}`]
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
              ? [`- Command: ${snapshot.remoteTransportDoctor.command}`]
              : []),
          ]
        : []),
      '',
      'next action recomendada:',
      `- ${snapshot.nextAction.label}`,
      `- Command: ${snapshot.nextAction.command}`,
      `- Motivo: ${snapshot.nextAction.reason}`,
    ];

    if (snapshot.zavorthBridge.available) {
      lines.push(
        '',
        'ZavorthBridge remote:',
        `- Incidente mais recente: ${snapshot.zavorthBridge.latestIncident || 'n/d'} (${snapshot.zavorthBridge.latestSeverity || 'n/d'})`,
        `- Flapping: ${snapshot.zavorthBridge.flappingLikely ? 'yes' : 'no'}`,
        `- Historical repair: ${snapshot.zavorthBridge.repairedRuns}/${snapshot.zavorthBridge.totalRuns}`,
      );
    }

    return lines.join('\n');
  }

  private formatRelative(value: string | null): string {
    if (!value) {
      return 'without agenda';
    }

    const target = Date.parse(value);
    if (!Number.isFinite(target)) {
      return 'invalid date';
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

  private describeDiscordChannel(mode: string | undefined): string {
    return mode === 'native' ? 'Gateway nactive do Discord' : 'Discord bridge';
  }

  private describeDoctorProvider(
    channelId: 'slack' | 'whatsapp' | 'telegram' | 'discord' | 'signal' | 'imessage' | 'teams' | 'email',
    mode:
      | 'native'
      | 'cloud-api'
      | 'local'
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
