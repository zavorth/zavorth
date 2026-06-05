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
        `${summary.total} providers cobertos; ${summary.needsAuth} precisam de chave, `
        + `${summary.needsBaseUrl} precisam de base URL, ${summary.readyToProbe} estao prontos para probe e `
        + `${summary.defaultRouteAllowed} podem virar rota padrao.`,
    };
  }

  public renderText(input: ProviderConnectionPlaybookInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Playbook de conexao de providers do Zavorth',
      '',
      snapshot.operatorSummary,
      'Catalogo de modelo nao e prova live de provider.',
    ];
    if (!snapshot.selected) {
      lines.push(
        '',
        'Providers:',
        ...snapshot.playbooks.slice(0, 12).map((entry) =>
          `- ${entry.label}: ${entry.status}; proximo passo: ${entry.nextAction}`),
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
      `Modelo padrao: ${selected.defaultModel || 'nao definido'}.`,
      `Live: ${selected.readiness.liveReady ? 'sim' : 'nao'} (${selected.readiness.readinessProof}).`,
      selected.readiness.defaultRouteAllowed
        ? 'Rota padrao: liberada.'
        : `Rota padrao: bloqueada - ${selected.readiness.defaultBlockReason || 'precisa de prova live.'}`,
      `Proximo passo: ${selected.nextAction}`,
      '',
      'Passos:',
      ...selected.steps.map((step) =>
        `- [${step.status}] ${step.label}${step.command ? `: ${step.command}` : ''}`),
      '',
      `Variaveis necessarias: ${selected.requiredInputKeys.join(', ') || 'nenhuma'}.`,
      `Variaveis faltantes: ${selected.missingInputKeys.join(', ') || 'nenhuma'}.`,
      '',
      'Comandos:',
      `- Inspecionar: ${selected.commands.inspect}`,
      `- Probe seguro: ${selected.commands.safeProbe}`,
      `- Probe live: ${selected.commands.liveProbe}`,
      `- Definir rota padrao: ${selected.commands.selectDefault}`,
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
      step('choose-provider', 'Escolher provider e perfil', 'done', null, [
        `${entry.label} selecionado com modelo ${entry.currentModelName || 'nao definido'}.`,
      ]),
      step('add-credentials', 'Adicionar credenciais como segredo local', authMissing ? 'next' : 'done', null, [
        authMissing ? `Faltam: ${missingInputKeys.join(', ')}.` : 'Chaves obrigatorias aparecem configuradas.',
        'Valores brutos nunca entram no snapshot.',
      ]),
      step('configure-base-url', 'Configurar base URL quando necessario', baseUrlMissing ? 'next' : 'done', null, [
        baseUrlMissing ? 'Provider compativel precisa de endpoint/base URL.' : 'Base URL nao esta pendente.',
      ]),
      step('select-model', 'Confirmar modelo padrao', entry.currentModelName ? 'done' : 'pending', null, [
        entry.currentModelName ? `Modelo atual: ${entry.currentModelName}.` : 'Escolha um modelo antes de tornar padrao.',
      ]),
      step('run-safe-probe', 'Rodar probe sem rede live oculta', entry.liveReady || entry.defaultRouteAllowed ? 'done' : blocked ? 'blocked' : authMissing || baseUrlMissing ? 'blocked' : 'next', commands.safeProbe, [
        'Probe seguro prepara evidencia sem chamada live escondida.',
      ]),
      step('run-live-probe', 'Rodar probe live explicito', entry.liveReady ? 'done' : authMissing || baseUrlMissing || blocked ? 'blocked' : 'next', commands.liveProbe, [
        'Probe live usa rede apenas quando o operador pede explicitamente.',
      ]),
      step('allow-default-route', 'Liberar rota padrao', entry.defaultRouteAllowed ? 'done' : entry.liveReady ? 'next' : 'blocked', commands.selectDefault, [
        'Rota padrao exige provider ready, prova live e policy de fallback.',
      ]),
    ];
  }

  private summaryFor(entry: ZavorthProviderReadinessEntry, missingInputKeys: string[]): string {
    if (entry.defaultRouteAllowed) return `${entry.label} tem prova live e pode ser rota padrao.`;
    if (entry.liveReady) return `${entry.label} tem prova live, mas ainda nao virou rota padrao.`;
    if (missingInputKeys.length > 0) return `${entry.label} precisa de configuracao antes de qualquer probe live.`;
    return `${entry.label} esta pronto para probe controlado.`;
  }

  private nextAction(steps: ProviderConnectionStep[], entry: ZavorthProviderReadinessEntry): string {
    if (entry.defaultRouteAllowed) return `Usar ${entry.label} como provider padrao com fallback e receipts.`;
    if (entry.liveReady) return `Revisar fallback e promover ${entry.label} para rota padrao quando fizer sentido.`;
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
