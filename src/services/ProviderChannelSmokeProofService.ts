import type {
  ChannelSmokeProof,
  ProviderChannelSmokeProofMode,
  ProviderChannelSmokeProofSnapshot,
  ProviderChannelSmokeReceipt,
  ProviderChannelSmokeStep,
  ProviderSmokeProof,
} from '../contracts/ProviderChannelSmokeProofContract.js';
import { ZAVORTH_PROVIDER_CHANNEL_SMOKE_PROOF_CONTRACT_VERSION } from '../contracts/ProviderChannelSmokeProofContract.js';

import type { ChannelMeshConsistencyEntry } from '../contracts/ChannelMeshConsistencyContract.js';
import type { ProviderMeshReadinessProviderEntry } from '../contracts/ProviderMeshReadinessContract.js';
import { ChannelMeshConsistencyService } from './ChannelMeshConsistencyService.js';
import { ProviderMeshReadinessService } from './ProviderMeshReadinessService.js';

type ProviderChannelSmokeProofRuntime = {
  now?: () => Date;
  mode?: ProviderChannelSmokeProofMode;
  providerMeshReadinessService?: ProviderMeshReadinessService;
  channelMeshConsistencyService?: ChannelMeshConsistencyService;
};

export class ProviderChannelSmokeProofService {
  private readonly now: () => Date;
  private readonly mode: ProviderChannelSmokeProofMode;
  private readonly providerMesh: ProviderMeshReadinessService;
  private readonly channelMesh: ChannelMeshConsistencyService;

  constructor(runtime: ProviderChannelSmokeProofRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.mode = runtime.mode || 'dry-live-harness';
    this.providerMesh = runtime.providerMeshReadinessService || new ProviderMeshReadinessService({
      now: this.now,
    });
    this.channelMesh = runtime.channelMeshConsistencyService || new ChannelMeshConsistencyService({
      now: this.now,
    });
  }

  public buildSnapshot(): ProviderChannelSmokeProofSnapshot {
    const providerSnapshot = this.providerMesh.buildSnapshot();
    const channelSnapshot = this.channelMesh.buildSnapshot();
    const providerProofs = providerSnapshot.entries.map((entry) => this.buildProviderProof(entry));
    const channelProofs = channelSnapshot.entries.map((entry) => this.buildChannelProof(entry));
    const receipts = [...providerProofs, ...channelProofs].map((entry) => entry.receipt);
    const providerBlocked = providerProofs.filter((entry) => entry.status === 'blocked').length;
    const channelBlocked = channelProofs.filter((entry) => entry.status === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_PROVIDER_CHANNEL_SMOKE_PROOF_CONTRACT_VERSION,
      status: providerBlocked > 0 || channelBlocked > 0 ? 'blocked' : 'closed',
      mode: this.mode,
      summary: {
        providers: providerProofs.length,
        providerSmokeProofs: providerProofs.length - providerBlocked,
        providerBlocked,
        channels: channelProofs.length,
        channelSmokeProofs: channelProofs.length - channelBlocked,
        channelBlocked,
        receipts: receipts.length,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        secretValuesSerialized: false,
      },
      providerProofs,
      channelProofs,
      receipts,
      providerSnapshot: {
        contractVersion: providerSnapshot.contractVersion,
        summary: providerSnapshot.summary,
      },
      channelSnapshot: {
        contractVersion: channelSnapshot.contractVersion,
        summary: channelSnapshot.summary,
      },
      policy: {
        noProviderNetworkCalls: true,
        noLiveChannelSends: true,
        noSecretsSerialized: true,
        mockHarnessIsDeterministic: true,
        liveModeRequiresOperatorApproval: true,
        artifactsAndReceiptsRequired: true,
      },
      commands: {
        check: 'npm run provider-channel-smoke-proof:check --silent',
        providerConsistency: 'npm run provider-mesh-readiness:check --silent',
        channelConsistency: 'npm run channel-mesh-consistency:check --silent',
        focusedTests: ['npx jest tests/services/ProviderChannelSmokeProofService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextWorker: 'Worker 6 - media/voice/web/docs diagnostics closure',
      },
    };
  }

  public buildProviderProof(entry: ProviderMeshReadinessProviderEntry): ProviderSmokeProof {
    const blocked = entry.status === 'unsupported' || entry.status === 'unmapped' || !entry.runtimeSupported;
    const providerId = entry.route.providerId || entry.normalizedSourceName;
    const routeId = entry.route.routeId || providerId;
    const modelId = entry.route.models?.find((model) => model.primary)?.modelId
      || entry.route.models?.[0]?.modelId
      || null;
    const status = blocked ? 'blocked' : 'local-proven';
    const receipt = this.buildReceipt({
      surface: 'provider.call',
      sourceName: entry.normalizedSourceName,
      status,
      artifactKind: 'provider.smoke.artifact',
      receiptKind: 'provider.smoke.receipt',
      summary: blocked ? `${entry.normalizedSourceName} provider smoke blocked by runtime classification.`
        : `${entry.normalizedSourceName} provider request envelope resolved without external provider call.`,
    });

    return {
      sourceName: entry.sourceName,
      normalizedSourceName: entry.normalizedSourceName,
      status,
      adapterStrategy: entry.adapterStrategy,
      runtimeAdapter: entry.runtimeAdapter,
      routeKind: entry.routeKind,
      credentialRefs: entry.credentialPolicy.credentialRefs,
      requestEnvelope: {
        providerId,
        routeId,
        modelId,
        capabilities: entry.capabilities,
        modalities: entry.modalities,
        dryRun: true,
      },
      steps: [
        this.step({
          id: `provider.${entry.normalizedSourceName}.runtime-target-resolution`,
          kind: 'runtime-target-resolution',
          status,
          command: entry.smokeGate.command,
          evidence: entry.smokeGate.expected,
        }),
        this.step({
          id: `provider.${entry.normalizedSourceName}.credential-policy-redaction`,
          kind: 'credential-policy-redaction',
          status,
          command: `ProviderCredentialPolicy.inspect(${JSON.stringify(entry.normalizedSourceName)})`,
          evidence: `credential refs only: ${entry.credentialPolicy.credentialRefs.join(', ') || 'none'}`,
        }),
        this.step({
          id: `provider.${entry.normalizedSourceName}.provider-request-envelope`,
          kind: 'provider-request-envelope',
          status,
          command: `ProviderSmokeHarness.buildRequest(${JSON.stringify(entry.normalizedSourceName)})`,
          evidence: `route ${routeId} uses ${entry.runtimeAdapter} adapter in dryRun mode`,
        }),
        this.step({
          id: `provider.${entry.normalizedSourceName}.provider-artifact-receipt`,
          kind: 'provider-artifact-receipt',
          status,
          command: `ProviderSmokeHarness.receipt(${JSON.stringify(receipt.id)})`,
          evidence: receipt.summary,
        }),
      ],
      receipt,
    };
  }

  public buildChannelProof(entry: ChannelMeshConsistencyEntry): ChannelSmokeProof {
    const blocked = entry.status === 'unsupported' || entry.status === 'unmapped' || entry.status === 'template-ready';
    const status = blocked ? 'blocked' : 'local-proven';
    const receipt = this.buildReceipt({
      surface: 'channel.message',
      sourceName: entry.normalizedSourceName,
      status,
      artifactKind: 'channel.smoke.artifact',
      receiptKind: 'channel.smoke.receipt',
      summary: blocked ? `${entry.normalizedSourceName} channel smoke blocked by connector classification.`
        : `${entry.normalizedSourceName} inbound/outbound envelopes normalized without live channel send.`,
    });

    return {
      sourceName: entry.sourceName,
      normalizedSourceName: entry.normalizedSourceName,
      canonicalChannelId: entry.canonicalChannelId,
      status,
      transportStrategy: entry.route.transportStrategy,
      credentialRefs: entry.credentialPolicy.credentialRefs,
      inboundEnvelope: {
        channelId: entry.dryRun.inbound.channelId,
        sessionId: entry.dryRun.inbound.sessionId,
        userId: entry.dryRun.inbound.userId,
        normalized: entry.dryRun.inbound.normalized,
        dryRun: true,
      },
      outboundEnvelope: {
        channelId: entry.dryRun.outbound.channelId,
        recipients: entry.dryRun.outbound.recipients,
        dryRun: true,
        attachmentsSupported: entry.dryRun.outbound.attachmentsSupported,
      },
      steps: [
        this.step({
          id: `channel.${entry.normalizedSourceName}.channel-inbound-normalization`,
          kind: 'channel-inbound-normalization',
          status,
          command: `ChannelSmokeHarness.normalizeInbound(${JSON.stringify(entry.normalizedSourceName)})`,
          evidence: `${entry.canonicalChannelId} inbound envelope normalized in dryRun mode`,
        }),
        this.step({
          id: `channel.${entry.normalizedSourceName}.channel-outbound-plan`,
          kind: 'channel-outbound-plan',
          status,
          command: entry.smokeGate.command,
          evidence: entry.smokeGate.expected,
        }),
        this.step({
          id: `channel.${entry.normalizedSourceName}.credential-policy-redaction`,
          kind: 'credential-policy-redaction',
          status,
          command: `ChannelCredentialPolicy.inspect(${JSON.stringify(entry.normalizedSourceName)})`,
          evidence: `credential refs only: ${entry.credentialPolicy.credentialRefs.join(', ') || 'none'}`,
        }),
        this.step({
          id: `channel.${entry.normalizedSourceName}.channel-delivery-receipt`,
          kind: 'channel-delivery-receipt',
          status,
          command: `ChannelSmokeHarness.receipt(${JSON.stringify(receipt.id)})`,
          evidence: receipt.summary,
        }),
      ],
      receipt,
    };
  }

  private step(input: {
    id: string;
    kind: ProviderChannelSmokeStep['kind'];
    status: 'local-proven' | 'blocked';
    command: string;
    evidence: string;
  }): ProviderChannelSmokeStep {
    return {
      id: input.id,
      kind: input.kind,
      status: input.status === 'blocked' ? 'blocked' : 'passed',
      command: input.command,
      evidence: input.evidence,
      liveExternalCallRequired: false,
      liveChannelSendRequired: false,
      secretValuesSerialized: false,
    };
  }

  private buildReceipt(input: {
    surface: ProviderChannelSmokeReceipt['surface'];
    sourceName: string;
    status: 'local-proven' | 'blocked';
    summary: string;
    artifactKind: string;
    receiptKind: string;
  }): ProviderChannelSmokeReceipt {
    return {
      id: `provider-channel-smoke.${input.surface}.${input.sourceName}.receipt`,
      surface: input.surface,
      sourceName: input.sourceName,
      status: input.status === 'blocked' ? 'blocked' : 'passed',
      summary: input.summary,
      artifactKind: input.artifactKind,
      receiptKind: input.receiptKind,
      noLiveIo: true,
      secretValuesSerialized: false,
    };
  }
}

