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

const PLACEHOLDER_PROVIDERS = new Set([
  '',
  'local-provider',
  'local-outbox',
  'stub',
  'planned',
  'unknown',
]);

const PLACEHOLDER_TRANSPORTS = new Set([
  'stub',
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
      stubOrPartial: entries.filter((entry) => entry.status === 'stub-or-partial').length,
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
        stubsAndPartialsAreVisible: true,
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
        headline: 'Certificacao live do host Zavorth',
        operatorSummary:
          `${summary.liveReady}/${summary.total} canal(is) live-ready, ${summary.hostReady} host-ready, `
          + `${summary.contractOnly} contract-only, ${summary.stubOrPartial} stub/partial.`,
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
    const stubOrPartial = this.isStubOrPartial(meshEntry, contractEntry);
    const providerConfigured = this.requirementPassed(requirements, 'provider-real');
    const credentialsOrBridgeHealthy = this.requirementPassed(requirements, 'credentials-health');
    const webhookReachableOrNotRequired = this.requirementPassed(requirements, 'webhook-reachability');
    const recipientsBounded = this.requirementPassed(requirements, 'bounded-recipients');
    const outboundAllowed = this.requirementPassed(requirements, 'outbound-allowed');
    const productionLiveReady = contractReady
      && !stubOrPartial
      && providerConfigured
      && credentialsOrBridgeHealthy
      && webhookReachableOrNotRequired
      && recipientsBounded
      && outboundAllowed;
    const hostReady = contractReady
      && !stubOrPartial
      && providerConfigured
      && credentialsOrBridgeHealthy;
    const status = this.resolveStatus({
      meshEntry,
      contractReady,
      hostReady,
      productionLiveReady,
      stubOrPartial,
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
      stubOrPartial,
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
    const stubOrPartial = this.isStubOrPartial(meshEntry, contractEntry);
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
        detail: contractReady
          ? 'O contrato de UX/canal passou.'
          : 'Sem contrato certificado, o host nao pode ser declarado live.',
        evidence: [`contractStatus=${contractEntry?.status || 'missing'}`],
      }),
      this.requirement({
        id: 'implementation-honest',
        label: 'Status nao mascara stub/partial',
        passed: !stubOrPartial,
        requiredForLive: true,
        detail: stubOrPartial
          ? 'Readiness, transporte ou implementacao ainda indicam stub/partial/planned.'
          : 'O canal nao aparece como stub, partial ou planned.',
        evidence: [
          `readiness=${meshEntry?.readiness || contractEntry?.readiness || 'missing'}`,
          `transport=${meshEntry?.transport || contractEntry?.transport || 'missing'}`,
          `implementationState=${meshEntry?.implementationState || contractEntry?.implementationState || 'missing'}`,
        ],
      }),
      this.requirement({
        id: 'provider-real',
        label: 'Provider real configurado',
        passed: providerLooksReal,
        requiredForLive: true,
        detail: providerLooksReal
          ? 'Provider/transporte parecem reais e configurados.'
          : 'Provider ausente, local placeholder, stub ou sem configuracao.',
        evidence: [
          `configured=${String(Boolean(meshEntry?.configured))}`,
          `provider=${meshEntry?.provider || 'n/d'}`,
          `transport=${meshEntry?.transport || 'n/d'}`,
        ],
      }),
      this.requirement({
        id: 'credentials-health',
        label: 'Credenciais/bridge saudaveis',
        passed: credentialsHealthy,
        requiredForLive: true,
        detail: credentialsHealthy
          ? 'Health/connection indica runtime saudavel.'
          : 'Sem health passed, connection connected ou bridge running.',
        evidence: [
          `lastHealth=${meshEntry?.lastHealth || 'n/d'}`,
          `connected=${String(Boolean(meshEntry?.connection?.connected))}`,
          `running=${String(Boolean(meshEntry?.connection?.running))}`,
        ],
      }),
      this.requirement({
        id: 'webhook-reachability',
        label: 'Webhook alcancavel ou dispensado',
        passed: webhookOk,
        requiredForLive: true,
        detail: webhookRequired
          ? 'Canal webhook precisa path e health passed.'
          : 'Canal nao depende de webhook publico para este modo.',
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
        detail: boundedRecipients
          ? 'Envio esta delimitado por allowlist ou canal local.'
          : 'Sem recipients permitidos, o canal nao deve enviar live.',
        evidence: [
          `policy=${meshEntry?.policy?.state || 'n/d'}`,
          `allowedCount=${String(meshEntry?.policy?.allowedCount || 0)}`,
        ],
      }),
      this.requirement({
        id: 'outbound-allowed',
        label: 'Envio permitido com seguranca',
        passed: outboundAllowed,
        requiredForLive: true,
        detail: outboundAllowed
          ? 'Outbound existe e esta limitado pela policy.'
          : 'Outbound ausente ou sem recipients delimitados.',
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
    stubOrPartial: boolean;
  }): ZavorthHostLiveChannelStatus {
    if (!input.meshEntry) {
      return 'blocked';
    }
    if (input.productionLiveReady) {
      return 'live-ready';
    }
    if (input.stubOrPartial) {
      return 'stub-or-partial';
    }
    if (input.hostReady) {
      return 'host-ready';
    }
    if (input.contractReady) {
      return 'contract-only';
    }
    return 'blocked';
  }

  private isStubOrPartial(
    meshEntry: ChannelMeshSnapshotEntry | null,
    contractEntry: ContractEntry | null,
  ): boolean {
    const readiness = this.normalizeId(meshEntry?.readiness || contractEntry?.readiness || '');
    const transport = this.normalizeId(meshEntry?.transport || contractEntry?.transport || '');
    const implementation = this.normalizeId(meshEntry?.implementationState || contractEntry?.implementationState || '');
    return ['partial', 'planned', 'disabled', 'missing'].includes(readiness)
      || ['stub', 'planned', 'missing'].includes(transport)
      || ['stub', 'partial', 'planned', 'missing'].includes(implementation);
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
      return 'Manter doctor e envio supervisionado no ciclo operacional.';
    }
    if (status === 'host-ready') {
      return 'Validar webhook/recipients e gerar recibo live antes de chamar de producao.';
    }
    if (status === 'contract-only') {
      return 'Configurar provider real, credenciais e allowlist deste host.';
    }
    if (status === 'stub-or-partial') {
      return entry?.operatorNextStep || 'Promover adapter de stub/partial para provider real configurado.';
    }
    return blockers[0] || 'Registrar canal no Channel Mesh antes de certificar live.';
  }

  private buildNextStep(entries: ZavorthHostLiveChannelEntry[]): string {
    const first = entries.find((entry) => entry.status !== 'live-ready');
    if (!first) {
      return 'Arquivar recibos live por canal e manter este gate no QA.';
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
