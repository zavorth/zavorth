import {
  PROVIDER_CONNECTION_PLAYBOOK_VERSION,
  type ProviderConnectionPlaybook,
  type ProviderConnectionPlaybookSnapshot,
  type ProviderConnectionPlaybookStatus,
  type ProviderConnectionStep,
  type ProviderConnectionStepStatus,
} from '../contracts/ProviderConnectionPlaybookContract.js';
import type {
  ZavorthProviderReadinessEntry,
  ZavorthProviderReadinessMatrixSnapshot,
} from '../contracts/ZavorthProviderReadinessMatrixContract.js';
import { ZavorthProviderReadinessMatrixService } from './ZavorthProviderReadinessMatrixService.js';

type ProviderMatrixLike = Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot'>;

export type ProviderConnectionPlaybookInput = {
  providerId?: string | null;
  includeAdvanced?: boolean;
};

type ProviderConnectionPlaybookDeps = {
  now?: () => Date;
  providerMatrixService?: ProviderMatrixLike;
};

export class ProviderConnectionPlaybookService {
  private readonly now: () => Date;
  private readonly providerMatrixService: ProviderMatrixLike;

  constructor(deps: ProviderConnectionPlaybookDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.providerMatrixService = deps.providerMatrixService || new ZavorthProviderReadinessMatrixService();
  }

  public buildSnapshot(input: ProviderConnectionPlaybookInput = {}): ProviderConnectionPlaybookSnapshot {
    const providerId = normalizeId(input.providerId);
    const matrix = this.providerMatrixService.buildSnapshot({
      providerId,
      includeAdvanced: input.includeAdvanced === true,
      probe: true,
    });
    const playbooks = matrix.entries.map((entry) => this.buildPlaybook(entry));
    const selected = providerId
      ? playbooks.find((entry) => entry.providerId === providerId || normalizeId(entry.label) === providerId) || null
      : null;
    const summary = {
      total: playbooks.length,
      needsAuth: playbooks.filter((entry) => entry.status === 'needs-auth').length,
      needsBaseUrl: playbooks.filter((entry) => entry.status === 'needs-base-url').length,
      readyToProbe: playbooks.filter((entry) => entry.status === 'ready-to-probe').length,
      liveReady: playbooks.filter((entry) => entry.readiness.liveReady).length,
      defaultRouteAllowed: playbooks.filter((entry) => entry.readiness.defaultRouteAllowed).length,
    };
    const status = summary.defaultRouteAllowed > 0
      ? 'ready'
      : summary.readyToProbe > 0 || summary.liveReady > 0
        ? 'attention'
        : 'needs-setup';
    return {
      generatedAt: this.now().toISOString(),
      version: PROVIDER_CONNECTION_PLAYBOOK_VERSION,
      status,
      selected,
      playbooks,
      summary,
      operatorSummary:
        `${summary.total} providers covered; ${summary.needsAuth} need a key, `
        + `${summary.needsBaseUrl} need a base URL, ${summary.readyToProbe} are ready to probe and `
        + `${summary.defaultRouteAllowed} podem virar route default.`,
    };
  }

  public renderText(input: ProviderConnectionPlaybookInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Zavorth provider connection playbook',
      '',
      snapshot.operatorSummary,
      'Model catalog is not provider live proof.',
    ];
    if (!snapshot.selected) {
      lines.push(
        '',
        'Providers:',
        ...snapshot.playbooks.slice(0, 12).map((entry) =>
          `- ${entry.label}: ${entry.status}; next passo: ${entry.nextAction}`),
        '',
        'Use --provider <provider> para ver o roteiro completo.',
      );
      return lines.join('\n');
    }
    const selected = snapshot.selected;
    lines.push(
      '',
      `${selected.label} (${selected.providerId})`,
      selected.summary,
      `Default model: ${selected.defaultModel || 'not set'}.`,
      `Live: ${selected.readiness.liveReady ? 'yes' : 'no'} (${selected.readiness.readinessProof}).`,
      selected.readiness.defaultRouteAllowed ? 'Rota default: liberada.'
        : `Default route: blocked ? ${selected.readiness.defaultBlockReason || 'needs live proof.'}`,
      `Next step: ${selected.nextAction}`,
      '',
      'Steps:',
      ...selected.steps.map((step) =>
        `- [${step.status}] ${step.label}${step.command ? `: ${step.command}` : ''}`),
      '',
      `Required variables: ${selected.requiredInputKeys.join(', ') || 'none'}.`,
      `Missing variables: ${selected.missingInputKeys.join(', ') || 'none'}.`,
      '',
      'Commands:',
      `- Inspect: ${selected.commands.inspect}`,
      `- Safe probe: ${selected.commands.safeProbe}`,
      `- Probe live: ${selected.commands.liveProbe}`,
      `- Set default route: ${selected.commands.selectDefault}`,
    );
    return lines.join('\n');
  }

  private buildPlaybook(entry: ZavorthProviderReadinessEntry): ProviderConnectionPlaybook {
    const missingInputKeys = this.missingInputKeys(entry);
    const status = this.statusFor(entry);
    const commands = {
      inspect: 'npm run zavorth:provider-readiness:check --silent',
      safeProbe: `npm run zavorth:provider-readiness -- --provider ${entry.id} --probe`,
      liveProbe: `npm run zavorth:provider-readiness -- --provider ${entry.id} --live`,
      selectDefault: `zavorth providers use ${entry.id}`,
    };
    const steps = this.stepsFor(entry, missingInputKeys, commands);
    return {
      providerId: entry.id,
      label: entry.label,
      status,
      providerStatus: entry.status,
      defaultModel: entry.currentModelName,
      summary: this.summaryFor(entry, missingInputKeys),
      nextAction: this.nextAction(steps, entry),
      requiredInputKeys: this.requiredInputKeys(entry),
      missingInputKeys,
      readiness: {
        authConfigured: entry.authConfigured,
        baseUrlConfigured: entry.baseUrlConfigured,
        liveReady: entry.liveReady,
        defaultRouteAllowed: entry.defaultRouteAllowed,
        readinessProof: entry.readinessProof,
        probeStatus: entry.probe.status,
        defaultBlockReason: entry.defaultBlockReason,
      },
      commands,
      steps,
      safety: {
        rawSecretsSerialized: false,
        catalogSupportIsNotLiveProof: true,
        liveProbeRequiresExplicitAction: true,
        defaultRouteRequiresLiveProof: true,
      },
    };
  }

  private requiredInputKeys(entry: ZavorthProviderReadinessEntry): string[] {
    return unique([...entry.credentialRefs, ...entry.requirements]).sort();
  }

  private missingInputKeys(entry: ZavorthProviderReadinessEntry): string[] {
    const missing = [];
    if (!entry.authConfigured) missing.push(...entry.credentialRefs);
    if (!entry.baseUrlConfigured) missing.push(...entry.requirements.filter((item) => /BASE_URL|URL|endpoint/i.test(item)));
    return unique(missing).sort();
  }

  private statusFor(entry: ZavorthProviderReadinessEntry): ProviderConnectionPlaybookStatus {
    if (entry.status === 'blocked' || entry.status === 'unsupported') return 'blocked';
    if (entry.defaultRouteAllowed) return 'default-route-ready';
    if (entry.liveReady) return 'live-ready';
    if (!entry.authConfigured) return 'needs-auth';
    if (!entry.baseUrlConfigured) return 'needs-base-url';
    return 'ready-to-probe';
  }

  private stepsFor(
    entry: ZavorthProviderReadinessEntry,
    missingInputKeys: string[],
    commands: ProviderConnectionPlaybook['commands'],
  ): ProviderConnectionStep[] {
    const authMissing = !entry.authConfigured;
    const baseUrlMissing = !entry.baseUrlConfigured;
    const blocked = entry.status === 'blocked' || entry.status === 'unsupported';
    return [
      step('choose-provider', 'Choose provider and profile', 'done', null, [
        `${entry.label} selected with model ${entry.currentModelName || 'not set'}.`,
      ]),
      step('add-credentials', 'Add credentials as local secrets', authMissing ? 'next' : 'done', null, [
        authMissing ? `missing: ${missingInputKeys.join(', ')}.` : 'Required keys appear configured.',
        'Raw values are never stored in the snapshot.',
      ]),
      step('configure-base-url', 'Configure base URL when needed', baseUrlMissing ? 'next' : 'done', null, [
        baseUrlMissing ? 'Compatible provider needs endpoint/base URL.' : 'Base URL is not pending.',
      ]),
      step('select-model', 'Confirm default model', entry.currentModelName ? 'done' : 'pending', null, [
        entry.currentModelName ? `Current model: ${entry.currentModelName}.` : 'Choose a model before making it default.',
      ]),
      step('run-safe-probe', 'Run probe without hidden live network access', entry.liveReady || entry.defaultRouteAllowed ? 'done' : blocked ? 'blocked' : authMissing || baseUrlMissing ? 'blocked' : 'next', commands.safeProbe, [
        'Safe probe prepares evidence without hidden live calls.',
      ]),
      step('run-live-probe', 'Run explicit live probe', entry.liveReady ? 'done' : authMissing || baseUrlMissing || blocked ? 'blocked' : 'next', commands.liveProbe, [
        'Live probe uses the network only when the operator explicitly asks.',
      ]),
      step('allow-default-route', 'Enable default route', entry.defaultRouteAllowed ? 'done' : entry.liveReady ? 'next' : 'blocked', commands.selectDefault, [
        'Default route requires provider readiness, live proof, and fallback policy.',
      ]),
    ];
  }

  private summaryFor(entry: ZavorthProviderReadinessEntry, missingInputKeys: string[]): string {
    if (entry.defaultRouteAllowed) return `${entry.label} has live proof and can be the default route.`;
    if (entry.liveReady) return `${entry.label} has live proof, but has not become the default route yet.`;
    if (missingInputKeys.length > 0) return `${entry.label} needs configuration before any live probe.`;
    return `${entry.label} is ready for a controlled probe.`;
  }

  private nextAction(steps: ProviderConnectionStep[], entry: ZavorthProviderReadinessEntry): string {
    if (entry.defaultRouteAllowed) return `Use ${entry.label} as the default provider with fallback and receipts.`;
    if (entry.liveReady) return `Review fallback and promote ${entry.label} to the default route when it makes sense.`;
    const next = steps.find((candidate) => candidate.status === 'next') || steps.find((candidate) => candidate.status === 'pending');
    if (next?.command) return `${next.label}: ${next.command}`;
    if (next) return next.label;
    return entry.userAction;
  }
}

function step(
  id: ProviderConnectionStep['id'],
  label: string,
  status: ProviderConnectionStepStatus,
  command: string | null,
  details: string[],
): ProviderConnectionStep {
  return { id, label, status, command, details };
}

function normalizeId(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}
