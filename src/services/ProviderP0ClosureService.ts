import type {
  ProviderP0ClosureEntry,
  ProviderP0ClosureSnapshot,
  ProviderP0ClosureStatus,
} from '../contracts/ProviderP0ClosureContract.js';
import { ZAVORTH_PROVIDER_P0_CLOSURE_CONTRACT_VERSION } from '../contracts/ProviderP0ClosureContract.js';
import { ReleaseCertificationService } from './ReleaseCertificationService.js';
import { ProviderMeshReadinessService } from './ProviderMeshReadinessService.js';

type ProviderP0ClosureRuntime = {
  now?: () => Date;
  providerMeshReadinessService?: ProviderMeshReadinessService;
  releaseCertificationService?: ReleaseCertificationService;
};

const CLOSED_PROVIDER_IDS = ['anthropic', 'anthropic-vertex'];

export class ProviderP0ClosureService {
  private readonly now: () => Date;
  private readonly providerMesh: ProviderMeshReadinessService;
  private readonly certification: ReleaseCertificationService;

  constructor(runtime: ProviderP0ClosureRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.providerMesh = runtime.providerMeshReadinessService || new ProviderMeshReadinessService({
      now: this.now,
    });
    this.certification = runtime.releaseCertificationService || new ReleaseCertificationService({
      now: this.now,
    });
  }

  public buildSnapshot(): ProviderP0ClosureSnapshot {
    const providerSnapshot = this.providerMesh.buildSnapshot();
    const certificationSnapshot = this.certification.buildSnapshot();
    const entries = CLOSED_PROVIDER_IDS.map((providerId) => this.buildEntry(providerId));
    const remainingProviderP0 = providerSnapshot.summary.unsupported + providerSnapshot.summary.unmapped;
    const status: ProviderP0ClosureStatus = remainingProviderP0 === 0 && certificationSnapshot.summary.sourceP0Gaps === 0
      ? 'closed'
      : 'blocked';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_PROVIDER_P0_CLOSURE_CONTRACT_VERSION,
      status,
      summary: {
        closedProviders: entries.filter((entry) => entry.p0Closed).length,
        remainingProviderP0,
        providerUnsupported: providerSnapshot.summary.unsupported,
        providerTemplateReady: providerSnapshot.summary.templateReady,
        certificationP0Gaps: certificationSnapshot.summary.sourceP0Gaps,
        certificationStatus: certificationSnapshot.status,
        releaseReady: certificationSnapshot.summary.releaseReady,
        liveExternalCallRequired: false,
        secretValuesSerialized: false,
      },
      entries,
      providerSnapshot: {
        contractVersion: providerSnapshot.contractVersion,
        summary: providerSnapshot.summary,
      },
      certification: {
        contractVersion: certificationSnapshot.contractVersion,
        profile: certificationSnapshot.profile,
        status: certificationSnapshot.status,
        summary: certificationSnapshot.summary,
      },
      commands: {
        check: 'npm run provider-p0-closure:check --silent',
        providerConsistency: 'npm run provider-mesh-readiness:check --silent',
        certify: 'npm run release-certify --silent',
        nextStage: 'Etapa 11 - P1 Provider Adapter Runtime',
      },
      policy: {
        closureIsClassificationOnly: true,
        noProviderCalls: true,
        noSecretsSerialized: true,
        remainingTemplatesStayVisible: true,
      },
    };
  }

  private buildEntry(providerId: string): ProviderP0ClosureEntry {
    const entry = this.providerMesh.buildEntry(providerId);
    const p0Closed = entry.status !== 'unsupported' && entry.status !== 'unmapped' && entry.runtimeSupported;
    return {
      providerId,
      previousBlocker: 'unsupported_anthropic',
      closureStrategy: 'anthropic-compatible-runtime',
      status: entry.status === 'first-class' || entry.status === 'generic-compatible'
        ? entry.status
        : 'template-ready',
      runtimeSupported: entry.runtimeSupported,
      adapterStrategy: entry.adapterStrategy,
      p0Closed,
      remainingTier: p0Closed && entry.status === 'template-ready' ? 'p1-template' : 'none',
      command: `ProviderMeshReadinessService.buildEntry(${JSON.stringify(providerId)})`,
      receipt: `provider-p0-closure.${providerId}.receipt`,
    };
  }
}
