import type { CapabilityImportManifestItem } from '../contracts/CapabilityImportContract.js';
import {
  CAPABILITY_PACK_READINESS_CONTRACT_VERSION,
  type CapabilityPackItemReadiness,
  type CapabilityPackReadinessCheck,
  type CapabilityPackReadinessInput,
  type CapabilityPackReadinessSnapshot,
  type CapabilityPackReadinessStatus,
} from '../contracts/CapabilityPackReadinessContract.js';
import {
  ZavorthCapabilityPackCatalogService,
  type ZavorthCapabilityPackCatalogRuntime,
} from './ZavorthCapabilityPackCatalogService.js';

export type ZavorthCapabilityPackReadinessDoctorRuntime = ZavorthCapabilityPackCatalogRuntime & {
  env?: Record<string, string | undefined>;
};

export class ZavorthCapabilityPackReadinessDoctorService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly catalog: ZavorthCapabilityPackCatalogService;

  constructor(runtime: ZavorthCapabilityPackReadinessDoctorRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
    this.catalog = new ZavorthCapabilityPackCatalogService(runtime);
  }

  public buildSnapshot(input: CapabilityPackReadinessInput = {}): CapabilityPackReadinessSnapshot {
    const manifests = this.catalog.listManifests({ packId: input.packId || null });
    const itemReadiness = manifests
      .flatMap((manifest) => manifest.items)
      .filter((item) => !input.targetItemId || this.toItemId(item) === input.targetItemId)
      .map((item) => this.inspectItem(item, input));
    const ready = itemReadiness.filter((item) => item.status === 'ready_for_activation_request').length;
    const needsConfiguration = itemReadiness.filter((item) => item.status === 'needs_configuration').length;
    const needsProbe = itemReadiness.filter((item) => item.status === 'needs_probe').length;
    const blocked = itemReadiness.filter((item) => item.status === 'blocked').length;

    return {
      contractVersion: CAPABILITY_PACK_READINESS_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      policy: {
        canonicalRoot: 'zavorth-core/Zavorth',
        readsSecretValues: false,
        secretsSerialized: false,
        checksPresenceOnly: true,
        liveActivationApplied: false,
      },
      query: {
        packId: input.packId || null,
        targetItemId: input.targetItemId || null,
      },
      summary: {
        packs: manifests.length,
        items: itemReadiness.length,
        ready,
        needsConfiguration,
        needsProbe,
        blocked,
      },
      items: itemReadiness,
      narrative: this.buildNarrative(itemReadiness),
    };
  }

  public renderReport(input: CapabilityPackReadinessInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Zavorth Capability Pack Readiness Doctor',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Policy: readsSecretValues=${snapshot.policy.readsSecretValues}; secrets=${snapshot.policy.secretsSerialized}; live=${snapshot.policy.liveActivationApplied}.`,
      `Items: ${snapshot.summary.items} | ready ${snapshot.summary.ready} | config ${snapshot.summary.needsConfiguration} | probe ${snapshot.summary.needsProbe} | blocked ${snapshot.summary.blocked}.`,
      '',
      'Items:',
    ];
    for (const item of snapshot.items.slice(0, 16)) {
      lines.push(`- ${item.status} ${item.itemId}: ${item.nextAction}`);
    }
    lines.push('', `Next: ${snapshot.narrative.nextAction}`);
    return lines.join('\n');
  }

  private inspectItem(
    item: CapabilityImportManifestItem,
    input: CapabilityPackReadinessInput,
  ): CapabilityPackItemReadiness {
    const checks: CapabilityPackReadinessCheck[] = [
      ...this.secretChecks(item, input),
      ...this.envChecks(item, input),
      ...this.binaryChecks(item, input),
      ...this.manualChecks(item, input),
      ...this.localRouteChecks(item, input),
      ...this.readinessChecks(item, input),
      this.policyCheck(item),
    ];
    const blockers = checks
      .filter((check) => check.status === 'blocked' || check.status === 'missing')
      .map((check) => check.summary);
    const status = this.resolveStatus(checks);

    return {
      itemId: this.toItemId(item),
      label: item.label,
      kind: item.kind,
      status,
      checks,
      blockers,
      nextAction: this.nextAction(status, checks),
    };
  }

  private secretChecks(
    item: CapabilityImportManifestItem,
    input: CapabilityPackReadinessInput,
  ): CapabilityPackReadinessCheck[] {
    const available = new Set(input.availableSecretRefs || []);
    return (item.requirements?.secretRefs || []).map((ref) => ({
      id: `secret:${ref}`,
      kind: 'secret-ref' as const,
      status: available.has(ref) ? 'passed' as const : 'missing' as const,
      summary: available.has(ref) ? `${ref} is present as a secret ref.`
        : `${ref} must be configured as a secret ref.`,
    }));
  }

  private envChecks(
    item: CapabilityImportManifestItem,
    input: CapabilityPackReadinessInput,
  ): CapabilityPackReadinessCheck[] {
    const available = new Set(input.availableEnvKeys || []);
    return (item.requirements?.envKeys || []).map((key) => {
      const present = available.has(key) || Boolean(this.env[key]);
      return {
        id: `env:${key}`,
        kind: 'env-key' as const,
        status: present ? 'passed' as const : 'missing' as const,
        summary: present ? `${key} is present. Value was not read.`
          : `${key} must exist. Value will not be read by the doctor.`,
      };
    });
  }

  private binaryChecks(
    item: CapabilityImportManifestItem,
    input: CapabilityPackReadinessInput,
  ): CapabilityPackReadinessCheck[] {
    const available = new Set(input.availableBinaries || []);
    return (item.requirements?.binaries || []).map((binary) => ({
      id: `binary:${binary}`,
      kind: 'binary' as const,
      status: available.has(binary) ? 'passed' as const : 'missing' as const,
      summary: available.has(binary) ? `${binary} binary is available.`
        : `${binary} binary must be available before activation.`,
    }));
  }

  private manualChecks(
    item: CapabilityImportManifestItem,
    input: CapabilityPackReadinessInput,
  ): CapabilityPackReadinessCheck[] {
    const completed = new Set(input.completedManualSteps || []);
    return (item.requirements?.manualSteps || []).map((step) => ({
      id: `manual:${step}`,
      kind: 'manual-step' as const,
      status: completed.has(step) ? 'passed' as const : 'manual' as const,
      summary: completed.has(step) ? `${step} completed.`
        : `${step} needs operator confirmation.`,
    }));
  }

  private localRouteChecks(
    item: CapabilityImportManifestItem,
    input: CapabilityPackReadinessInput,
  ): CapabilityPackReadinessCheck[] {
    if (item.governance?.networkScope !== 'local') {
      return [];
    }
    const routes = input.localRoutes || {};
    const present = routes[item.id] === true || routes[this.toItemId(item)] === true;
    return [{
      id: `local-route:${item.id}`,
      kind: 'local-route',
      status: present ? 'passed' : 'missing',
      summary: present ? `${item.label} local route is reachable.`
        : `${item.label} local route needs a local health check.`,
    }];
  }

  private readinessChecks(
    item: CapabilityImportManifestItem,
    input: CapabilityPackReadinessInput,
  ): CapabilityPackReadinessCheck[] {
    const completed = new Set(input.completedReadinessChecks || []);
    return (item.activation?.readinessChecks || []).map((check) => ({
      id: `readiness:${check}`,
      kind: 'readiness-check' as const,
      status: completed.has(check) ? 'passed' as const : 'pending' as const,
      summary: completed.has(check) ? `${check} passed.`
        : `${check} still needs a doctor/probe result.`,
    }));
  }

  private policyCheck(item: CapabilityImportManifestItem): CapabilityPackReadinessCheck {
    const hasGovernance = Boolean(item.governance);
    return {
      id: 'policy:governance',
      kind: 'policy',
      status: hasGovernance ? 'passed' : 'blocked',
      summary: hasGovernance ? 'Governance policy is declared.'
        : 'Governance policy is missing.',
    };
  }

  private resolveStatus(checks: CapabilityPackReadinessCheck[]): CapabilityPackReadinessStatus {
    if (checks.some((check) => check.status === 'blocked')) {
      return 'blocked';
    }
    if (checks.some((check) => check.status === 'missing')) {
      return 'needs_configuration';
    }
    if (checks.some((check) => check.status === 'manual' || check.status === 'pending')) {
      return 'needs_probe';
    }
    return 'ready_for_activation_request';
  }

  private nextAction(status: CapabilityPackReadinessStatus, checks: CapabilityPackReadinessCheck[]): string {
    const next = checks.find((check) => check.status !== 'passed');
    if (status === 'ready_for_activation_request') {
      return 'Continue to approval and controlled activation request.';
    }
    return next?.summary || 'Review readiness checks.';
  }

  private buildNarrative(items: CapabilityPackItemReadiness[]): CapabilityPackReadinessSnapshot['narrative'] {
    const ready = items.filter((item) => item.status === 'ready_for_activation_request').length;
    const blocked = items.filter((item) => item.status === 'blocked').length;
    const next = items.find((item) => item.status !== 'ready_for_activation_request');
    return {
      headline: `Readiness Doctor: ${ready}/${items.length} item(s) ready.`,
      operatorSummary: `${blocked} blocked; checks are presence-only and never read secret values.`,
      nextAction: next?.nextAction || 'All selected items can continue to approval.',
    };
  }

  private toItemId(item: CapabilityImportManifestItem): string {
    return `${item.kind}:${this.slug(item.id)}`;
  }

  private slug(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
