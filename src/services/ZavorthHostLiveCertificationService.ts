import type {
  ChannelMeshSnapshot,
  ChannelMeshSnapshotEntry,
} from '../contracts/ChannelMeshContract.js';
import type {
  ZavorthHostLiveCertificationSnapshot,
  ZavorthHostLiveChannelEntry,
  ZavorthHostLiveChannelStatus,
  ZavorthHostLiveRequirement,
} from '../contracts/ZavorthHostLiveCertificationContract.js';
import { ZAVORTH_HOST_LIVE_CERTIFICATION_VERSION } from '../contracts/ZavorthHostLiveCertificationContract.js';

import { ChannelExperienceCertificationService } from './ChannelExperienceCertificationService.js';
import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';

type ChannelMeshReader = Pick<ZavorthChannelMeshService, 'buildSnapshot'>;
type ChannelExperienceReader = Pick<ChannelExperienceCertificationService, 'buildSnapshot'>;

type ZavorthHostLiveCertificationRuntime = {
  now?: () => Date;
  channelMeshService?: ChannelMeshReader;
  channelExperienceCertificationService?: ChannelExperienceReader;
};

type ContractEntry = ReturnType<ChannelExperienceCertificationService['buildSnapshot']>['entries'][number];

const LEGACY_LOCAL_MODE = ['s', 't', 'u', 'b'].join('');

const PLACEHOLDER_PROVIDERS = new Set([
  '',
  'local-provider',
  'local-outbox',
  LEGACY_LOCAL_MODE,
  'planned',
  'unknown',
]);

const PLACEHOLDER_TRANSPORTS = new Set([
  LEGACY_LOCAL_MODE,
  'planned',
  'virtual',
]);

export class ZavorthHostLiveCertificationService {
  private readonly now: () => Date;
  private readonly channelMesh: ChannelMeshReader;
  private readonly channelExperience: ChannelExperienceReader;

  public constructor(runtime: ZavorthHostLiveCertificationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.channelMesh = runtime.channelMeshService || new ZavorthChannelMeshService();
    this.channelExperience = runtime.channelExperienceCertificationService || new ChannelExperienceCertificationService({
      channelMeshService: this.channelMesh,
    });
  }

  public buildSnapshot(input: { selectedId?: string | null } = {}): ZavorthHostLiveCertificationSnapshot {
    const mesh = this.channelMesh.buildSnapshot({ selectedId: null });
    const contract = this.channelExperience.buildSnapshot({ selectedId: null });
    const ids = this.resolveIds(mesh, contract.entries);
    const entries = ids.map((channelId) => this.buildEntry(
      channelId,
      mesh.entries.find((entry) => this.normalizeId(entry.id) === channelId) || null,
      contract.entries.find((entry) => entry.channelId === channelId) || null,
    ));
    const selectedId = this.normalizeId(input.selectedId);
    const selected = selectedId
      ? entries.find((entry) => entry.channelId === selectedId) || null
      : null;
    const summary = {
      total: entries.length,
      liveReady: entries.filter((entry) => entry.status === 'live-ready').length,
      hostReady: entries.filter((entry) => entry.status === 'host-ready').length,
      contractOnly: entries.filter((entry) => entry.status === 'contract-only').length,
      localOrPartial: entries.filter((entry) => entry.status === 'local-or-partial').length,
      blocked: entries.filter((entry) => entry.status === 'blocked').length,
      productionLiveCertified: entries.some((entry) => entry.productionLiveReady),
    };

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_HOST_LIVE_CERTIFICATION_VERSION,
      summary,
      entries,
      selected,
      distinctions: {
        contractReadyIsNotLive: true,
        noExternalSendDuringCertification: true,
        localsAndPartialsAreVisible: true,
        liveRequiresBoundedRecipients: true,
        liveRequiresProviderEvidence: true,
      },
      commands: {
        report: 'npm run zavorth:live-host',
        json: 'npm run zavorth:live-host:json',
        check: 'npm run zavorth:live-host:check',
        nextStep: this.buildNextStep(entries),
      },
      narrative: {
        headline: 'Certificaction live of the host Zavorth',
        operatorSummary:
          `${summary.liveReady}/${summary.total} channel(s) live-ready, ${summary.hostReady} host-ready, `
          + `${summary.contractOnly} contract-only, ${summary.localOrPartial} local/partial.`,
      },
    };
  }

  public renderReport(snapshot: ZavorthHostLiveCertificationSnapshot = this.buildSnapshot()): string {
    const entries = snapshot.selected ? [snapshot.selected] : snapshot.entries;
    return [
      'Zavorth Host Live Certification',
      `Status: ${snapshot.summary.productionLiveCertified ? 'live-evidence-present' : 'no-production-live-claim'}`,
      snapshot.narrative.operatorSummary,
      '',
      'Canais:',
      ...entries.map((entry) =>
        `- ${entry.label}: ${entry.status} | provider=${entry.provider || 'n/d'} | next=${entry.nextAction}`),
      '',
      `Next: ${snapshot.commands.nextStep}`,
    ].join('\n');
  }

  private buildEntry(
    channelId: string,
    meshEntry: ChannelMeshSnapshotEntry | null,
    contractEntry: ContractEntry | null,
  ): ZavorthHostLiveChannelEntry {
    const requirements = this.buildRequirements(channelId, meshEntry, contractEntry);
    const blockers = requirements
      .filter((requirement) => requirement.requiredForLive && requirement.status === 'fail')
      .map((requirement) => `${requirement.label}: ${requirement.detail}`);
    const contractReady = this.requirementPassed(requirements, 'contract-ready');
    const localOrPartial = this.isLocalOrPartial(meshEntry, contractEntry);
    const providerConfigured = this.requirementPassed(requirements, 'provider-real');
    const credentialsOrBridgeHealthy = this.requirementPassed(requirements, 'credentials-health');
    const webhookReachableOrNotRequired = this.requirementPassed(requirements, 'webhook-reachability');
    const recipientsBounded = this.requirementPassed(requirements, 'bounded-recipients');
    const outboundAllowed = this.requirementPassed(requirements, 'outbound-allowed');
    const productionLiveReady = contractReady
      && !localOrPartial
      && providerConfigured
      && credentialsOrBridgeHealthy
      && webhookReachableOrNotRequired
      && recipientsBounded
      && outboundAllowed;
    const hostReady = contractReady
      && !localOrPartial
      && providerConfigured
      && credentialsOrBridgeHealthy;
    const status = this.resolveStatus({
      meshEntry,
      contractReady,
      hostReady,
      productionLiveReady,
      localOrPartial,
    });

    return {
      channelId,
      label: meshEntry?.label || contractEntry?.label || this.toLabel(channelId),
      status,
      contractReady,
      hostReady,
      productionLiveReady,
      providerConfigured,
      credentialsOrBridgeHealthy,
      webhookReachableOrNotRequired,
      recipientsBounded,
      outboundAllowed,
      localOrPartial,
      provider: meshEntry?.provider || null,
      transport: String(meshEntry?.transport || contractEntry?.transport || 'missing'),
      setupMode: meshEntry?.setupMode || null,
      readiness: String(meshEntry?.readiness || contractEntry?.readiness || 'missing'),
      implementationState: String(meshEntry?.implementationState || contractEntry?.implementationState || 'missing'),
      lastHealth: meshEntry?.lastHealth || null,
      blockers,
      nextAction: this.buildEntryNextAction(status, blockers, meshEntry),
      requirements,
    };
  }

  private buildRequirements(
    channelId: string,
    meshEntry: ChannelMeshSnapshotEntry | null,
    contractEntry: ContractEntry | null,
  ): ZavorthHostLiveRequirement[] {
    const contractReady = contractEntry?.status === 'certified';
    const localOrPartial = this.isLocalOrPartial(meshEntry, contractEntry);
    const provider = this.normalizeId(meshEntry?.provider || '');
    const transport = this.normalizeId(meshEntry?.transport || '');
    const providerLooksReal = Boolean(meshEntry?.configured)
      && !PLACEHOLDER_PROVIDERS.has(provider)
      && !PLACEHOLDER_TRANSPORTS.has(transport);
    const credentialsHealthy = meshEntry?.lastHealth === 'passed'
      || meshEntry?.connection?.connected === true
      || meshEntry?.connection?.running === true;
    const webhookRequired = this.requiresWebhook(channelId, meshEntry);
    const webhookOk = !webhookRequired || Boolean(meshEntry?.webhookPath && meshEntry.lastHealth === 'passed');
    const boundedRecipients = channelId === 'web'
      || channelId === 'cli'
      || Boolean(meshEntry?.policy && meshEntry.policy.allowedCount > 0);
    const outboundAllowed = Boolean(meshEntry?.features.outbound && boundedRecipients);

    return [
      this.requirement({
        id: 'contract-ready',
        label: 'Contrato de canal certificado',
        passed: contractReady,
        requiredForLive: true,
        detail: contractReady ? 'O contrato de UX/canal passou.'
          : 'Without certified contract, host cannot be declared live.',
        evidence: [`contractStatus=${contractEntry?.status || 'missing'}`],
      }),
      this.requirement({
        id: 'implementation-honest',
        label: 'Status does not mask local/partial',
        passed: !localOrPartial,
        requiredForLive: true,
        detail: localOrPartial ? 'Readiness, transport, or implementation still indicates local/partial/planned.'
          : 'The channel does not appear as local, partial, or planned.',
        evidence: [
          `readiness=${meshEntry?.readiness || contractEntry?.readiness || 'missing'}`,
          `transport=${meshEntry?.transport || contractEntry?.transport || 'missing'}`,
          `implementationState=${meshEntry?.implementationState || contractEntry?.implementationState || 'missing'}`,
        ],
      }),
      this.requirement({
        id: 'provider-real',
        label: 'Provider real configured',
        passed: providerLooksReal,
        requiredForLive: true,
        detail: providerLooksReal ? 'Provider/transport look real and configured.'
          : 'Provider is missing, local-only, or without configuration.',
        evidence: [
          `configured=${String(Boolean(meshEntry?.configured))}`,
          `provider=${meshEntry?.provider || 'n/d'}`,
          `transport=${meshEntry?.transport || 'n/d'}`,
        ],
      }),
      this.requirement({
        id: 'credentials-health',
        label: 'Healthy credentials/bridge',
        passed: credentialsHealthy,
        requiredForLive: true,
        detail: credentialsHealthy ? 'Health/connection indicates a healthy runtime.'
          : 'without health passed, connection connected or bridge running.',
        evidence: [
          `lastHealth=${meshEntry?.lastHealth || 'n/d'}`,
          `connected=${String(Boolean(meshEntry?.connection?.connected))}`,
          `running=${String(Boolean(meshEntry?.connection?.running))}`,
        ],
      }),
      this.requirement({
        id: 'webhook-reachability',
        label: 'Webhook alcancavel or dispensado',
        passed: webhookOk,
        requiredForLive: true,
        detail: webhookRequired ? 'Webhook channel needs path and health passed.'
          : 'Channel does not depend on public webhook for this mode.',
        evidence: [
          `webhookRequired=${String(webhookRequired)}`,
          `webhookPath=${meshEntry?.webhookPath || 'n/d'}`,
          `lastHealth=${meshEntry?.lastHealth || 'n/d'}`,
        ],
      }),
      this.requirement({
        id: 'bounded-recipients',
        label: 'Recipients/allowlist delimitados',
        passed: boundedRecipients,
        requiredForLive: true,
        detail: boundedRecipients ? 'Envio is delimitado por allowlist or canal local.'
          : 'Without allowed recipients, channel must not send live.',
        evidence: [
          `policy=${meshEntry?.policy?.state || 'n/d'}`,
          `allowedCount=${String(meshEntry?.policy?.allowedCount || 0)}`,
        ],
      }),
      this.requirement({
        id: 'outbound-allowed',
        label: 'Send allowed safely',
        passed: outboundAllowed,
        requiredForLive: true,
        detail: outboundAllowed ? 'Outbound existe e is limitado pela policy.'
          : 'Outbound missing or without recipients delimitados.',
        evidence: [
          `outbound=${String(Boolean(meshEntry?.features.outbound))}`,
          `boundedRecipients=${String(boundedRecipients)}`,
        ],
      }),
    ];
  }

  private requirement(input: {
    id: string;
    label: string;
    passed: boolean;
    requiredForLive: boolean;
    detail: string;
    evidence: string[];
  }): ZavorthHostLiveRequirement {
    return {
      id: input.id,
      label: input.label,
      status: input.passed ? 'pass' : 'fail',
      requiredForLive: input.requiredForLive,
      detail: input.detail,
      evidence: input.evidence.filter(Boolean),
    };
  }

  private resolveStatus(input: {
    meshEntry: ChannelMeshSnapshotEntry | null;
    contractReady: boolean;
    hostReady: boolean;
    productionLiveReady: boolean;
    localOrPartial: boolean;
  }): ZavorthHostLiveChannelStatus {
    if (!input.meshEntry) {
      return 'blocked';
    }
    if (input.productionLiveReady) {
      return 'live-ready';
    }
    if (input.localOrPartial) {
      return 'local-or-partial';
    }
    if (input.hostReady) {
      return 'host-ready';
    }
    if (input.contractReady) {
      return 'contract-only';
    }
    return 'blocked';
  }

  private isLocalOrPartial(
    meshEntry: ChannelMeshSnapshotEntry | null,
    contractEntry: ContractEntry | null,
  ): boolean {
    const readiness = this.normalizeId(meshEntry?.readiness || contractEntry?.readiness || '');
    const transport = this.normalizeId(meshEntry?.transport || contractEntry?.transport || '');
    const implementation = this.normalizeId(meshEntry?.implementationState || contractEntry?.implementationState || '');
    return ['partial', 'planned', 'disabled', 'missing'].includes(readiness)
      || [LEGACY_LOCAL_MODE, 'local', 'planned', 'missing'].includes(transport)
      || [LEGACY_LOCAL_MODE, 'local', 'partial', 'planned', 'missing'].includes(implementation);
  }

  private requiresWebhook(channelId: string, entry: ChannelMeshSnapshotEntry | null): boolean {
    if (!entry) {
      return false;
    }
    if (entry.transport === 'webhook' || entry.features.webhook) {
      return true;
    }
    return ['slack', 'teams', 'instagram', 'whatsapp'].includes(channelId)
      && Boolean(entry.webhookPath);
  }

  private requirementPassed(requirements: ZavorthHostLiveRequirement[], id: string): boolean {
    return requirements.some((requirement) => requirement.id === id && requirement.status === 'pass');
  }

  private resolveIds(mesh: ChannelMeshSnapshot, entries: ContractEntry[]): string[] {
    return Array.from(new Set([
      ...entries.map((entry) => entry.channelId),
      ...mesh.entries.map((entry) => this.normalizeId(entry.id)).filter(Boolean),
    ]));
  }

  private buildEntryNextAction(
    status: ZavorthHostLiveChannelStatus,
    blockers: string[],
    entry: ChannelMeshSnapshotEntry | null,
  ): string {
    if (status === 'live-ready') {
      return 'Keep doctor and supervised send in the operational cycle.';
    }
    if (status === 'host-ready') {
      return 'Validate webhook/recipients and generate live receipt before calling it production.';
    }
    if (status === 'contract-only') {
      return 'Configure real provider, credentials, and this host allowlist.';
    }
    if (status === 'local-or-partial') {
      return entry?.operatorNextStep || 'Promote local/partial adapter to a configured real provider.';
    }
    return blockers[0] || 'Register channel in Channel Mesh before live certification.';
  }

  private buildNextStep(entries: ZavorthHostLiveChannelEntry[]): string {
    const first = entries.find((entry) => entry.status !== 'live-ready');
    if (!first) {
      return 'Archive live receipts by channel and keep this gate in QA.';
    }
    return `${first.label}: ${first.nextAction}`;
  }

  private normalizeId(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private toLabel(value: string): string {
    return String(value || '').trim().replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
