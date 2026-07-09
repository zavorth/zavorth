import { ZavorthProviderReadinessMatrixService } from './ZavorthProviderReadinessMatrixService.js';
import type {
  ZavorthRuntimeReadinessCheck,
  ZavorthRuntimeReadinessCheckId,
  ZavorthRuntimeReadinessSnapshot,
  ZavorthRuntimeReadinessStatus,
} from './ZavorthRuntimeReadinessService.js';

import type { ZavorthProviderReadinessMatrixSnapshot } from '../contracts/ZavorthProviderReadinessMatrixContract.js';
import { logger } from '../logger.js';

export const ZAVORTH_RUNTIME_GUIDED_FIXES_CONTRACT_VERSION = 'zavorth-runtime-guided-fixes/1' as const;

export type ZavorthRuntimeGuidedFixKind =
  | 'open-route'
  | 'run-command'
  | 'provider-live-proof'
  | 'manual-setup'
  | 'inspect';

export type ZavorthRuntimeGuidedFixRisk = 'read_only' | 'low' | 'approval_required';

export type ZavorthRuntimeGuidedFix = {
  id: string;
  checkId: ZavorthRuntimeReadinessCheckId;
  label: string;
  status: ZavorthRuntimeReadinessStatus;
  kind: ZavorthRuntimeGuidedFixKind;
  risk: ZavorthRuntimeGuidedFixRisk;
  summary: string;
  command: string | null;
  route: string | null;
  telegramCommand: string | null;
  requiresExplicitOperatorAction: boolean;
  requiresApproval: boolean;
  canRunFromCli: boolean;
  canRenderButton: boolean;
  executionAuthority: false;
  safeByDefault: true;
};

export type ZavorthRuntimeGuidedFixesSnapshot = {
  contractVersion: typeof ZAVORTH_RUNTIME_GUIDED_FIXES_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'runtime-guided-fixes';
  generatedAt: string;
  status: ZavorthRuntimeReadinessStatus;
  total: number;
  pending: number;
  fixes: ZavorthRuntimeGuidedFix[];
  primaryFix: ZavorthRuntimeGuidedFix | null;
  zavorthControlProjection: {
    route: '/zavorthControl';
    endpoint: '/api/runtime/readiness/fixes';
    renderMode: 'guided-fix-cards';
    executionAuthority: false;
    canExecuteLiveProviderProbe: false;
  };
  telegramProjection: {
    command: '/fixes';
    renderMode: 'guided-fix-summary';
    executionAuthority: false;
    text: string;
  };
  safety: {
    projectionOnly: true;
    noHiddenProviderProbe: true;
    noTargetExecutionAuthority: true;
    rawSecretsSerialized: false;
    mutatingFixesRequireExistingGovernance: true;
  };
  source: {
    readinessContractVersion: ZavorthRuntimeReadinessSnapshot['contractVersion'];
    readinessGeneratedAt: string;
  };
};

type ZavorthRuntimeGuidedFixesRuntime = {
  providerReadiness?: Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot'> | null;
};

export class ZavorthRuntimeGuidedFixesService {
  private readonly providerReadiness: Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot'>;

  public constructor(runtime: ZavorthRuntimeGuidedFixesRuntime = {}) {
    this.providerReadiness = runtime.providerReadiness || new ZavorthProviderReadinessMatrixService();
  }

  public buildSnapshot(readiness: ZavorthRuntimeReadinessSnapshot): ZavorthRuntimeGuidedFixesSnapshot {
    const providerSnapshot = this.safeProviderSnapshot();
    const fixes = readiness.checks
      .filter((check) => check.status !== 'ready')
      .map((check) => this.fixForCheck(check, providerSnapshot));
    const effectiveFixes = fixes.length > 0 ? fixes : [readyFix(readiness)];
    const primaryFix = effectiveFixes[0] || null;
    const base: Omit<ZavorthRuntimeGuidedFixesSnapshot, 'telegramProjection'> = {
      contractVersion: ZAVORTH_RUNTIME_GUIDED_FIXES_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'runtime-guided-fixes',
      generatedAt: readiness.generatedAt,
      status: readiness.status,
      total: effectiveFixes.length,
      pending: effectiveFixes.filter((fix) => fix.status !== 'ready').length,
      fixes: effectiveFixes,
      primaryFix,
      zavorthControlProjection: {
        route: '/zavorthControl',
        endpoint: '/api/runtime/readiness/fixes',
        renderMode: 'guided-fix-cards',
        executionAuthority: false,
        canExecuteLiveProviderProbe: false,
      },
      safety: {
        projectionOnly: true,
        noHiddenProviderProbe: true,
        noTargetExecutionAuthority: true,
        rawSecretsSerialized: false,
        mutatingFixesRequireExistingGovernance: true,
      },
      source: {
        readinessContractVersion: readiness.contractVersion,
        readinessGeneratedAt: readiness.generatedAt,
      },
    };
    return {
      ...base,
      telegramProjection: {
        command: '/fixes',
        renderMode: 'guided-fix-summary',
        executionAuthority: false,
        text: this.renderTelegramFromParts(base),
      },
    };
  }

  public renderCli(snapshot: ZavorthRuntimeGuidedFixesSnapshot): string {
    const lines = [
      'Guided fixes do Zavorth',
      `Estado: ${snapshot.status}`,
      snapshot.pending > 0
        ? `${snapshot.pending} ponto(s) precisam de acao segura.`
        : 'Nenhum bloqueio ou atencao pendente.',
      '',
      ...snapshot.fixes.map((fix, index) => [
        `${index + 1}. ${fix.label}`,
        `   ${fix.summary}`,
        fix.command ? `   Comando: ${fix.command}` : null,
        fix.route ? `   Tela: ${fix.route}` : null,
        fix.telegramCommand ? `   Telegram: ${fix.telegramCommand}` : null,
      ].filter(Boolean).join('\n')),
      '',
      'Esses fixes nao executam alvo final por conta propria; quando houver risco, o gateway continua exigindo approval.',
    ];
    return `${lines.join('\n')}\n`;
  }

  public renderTelegram(snapshot: ZavorthRuntimeGuidedFixesSnapshot): string {
    return snapshot.telegramProjection.text;
  }

  private fixForCheck(
    check: ZavorthRuntimeReadinessCheck,
    providerSnapshot: ZavorthProviderReadinessMatrixSnapshot | null,
  ): ZavorthRuntimeGuidedFix {
    if (check.id === 'provider-mesh') {
      return providerFix(check, providerSnapshot);
    }
    if (check.id === 'telegram') {
      return fix({
        check,
        id: 'fix-telegram',
        label: 'Guiar conexao do Telegram',
        kind: 'manual-setup',
        risk: 'read_only',
        summary: 'Abre o diagnostico do conector e mostra o que falta sem expor token.',
        command: 'zavorth connectors doctor telegram',
        route: '/zavorthControl/providers',
        telegramCommand: '/status',
      });
    }
    if (check.id === 'zavorthControl') {
      return fix({
        check,
        id: 'fix-zavorthControl',
        label: 'Reabrir ZavorthControl',
        kind: 'run-command',
        risk: 'read_only',
        summary: 'Sobe a superficie local diaria para confirmar que o painel responde.',
        command: 'zavorth go',
        route: '/zavorthControl',
        telegramCommand: '/zavorthControl',
      });
    }
    if (check.id === 'approvals') {
      return fix({
        check,
        id: 'fix-approvals',
        label: 'Revisar approvals pendentes',
        kind: 'inspect',
        risk: 'read_only',
        summary: 'Mostra decisoes pendentes; aprovar ou rejeitar ainda passa pelo gateway.',
        command: 'zavorth gateway approvals',
        route: '/zavorthControl/logs',
        telegramCommand: '/echoapprovals',
      });
    }
    if (check.id === 'transaction-plane') {
      return fix({
        check,
        id: 'fix-transaction-plane',
        label: 'Certificar transaction plane',
        kind: 'inspect',
        risk: 'read_only',
        summary: 'Confirma que transacoes reais continuam travadas ate approval e live gate explicitos.',
        command: 'zavorth transaction-live-executor-gate',
        route: '/zavorthControl/health',
        telegramCommand: '/status',
      });
    }
    if (check.id === 'skill-imports') {
      return fix({
        check,
        id: 'fix-skill-imports',
        label: 'Verificar import de skills',
        kind: 'inspect',
        risk: 'read_only',
        summary: 'Lista fontes externas e garante que nenhuma fonte sem pin entre no runtime.',
        command: 'npx tsx scripts/skills-security-scan.ts',
        route: '/zavorthControl/health',
        telegramCommand: '/status',
      });
    }
    if (check.id === 'memory-continuity') {
      return fix({
        check,
        id: 'fix-memory-continuity',
        label: 'Revisar memoria',
        kind: 'inspect',
        risk: 'read_only',
        summary: 'Mostra continuidade e recall sem gravar memoria oculta.',
        command: 'zavorth memory review --json',
        route: '/zavorthControl/logs',
        telegramCommand: '/status',
      });
    }
    return fix({
      check,
      id: 'fix-natural-first',
      label: 'Testar entrada natural',
      kind: 'inspect',
      risk: 'read_only',
      summary: 'Confirma que texto livre entra pelo gateway e risco vira preview/approval.',
      command: 'zavorth ask-runtime "oi"',
      route: '/zavorthControl',
      telegramCommand: '/readiness',
    });
  }

  private safeProviderSnapshot(): ZavorthProviderReadinessMatrixSnapshot | null {
    try {
      return this.providerReadiness.buildSnapshot({ includeAdvanced: false, probe: false });
    } catch (error: unknown) {logger.warn('[Zavorth Runtime Guided es] creation failed', error); return null; }
  }

  private renderTelegramFromParts(snapshot: Omit<ZavorthRuntimeGuidedFixesSnapshot, 'telegramProjection'>): string {
    const fixes = snapshot.fixes.slice(0, 4);
    return [
      'Guided fixes do Zavorth',
      snapshot.pending > 0
        ? `${snapshot.pending} ponto(s) precisam de acao.`
        : 'Nenhum bloqueio ou atencao pendente.',
      '',
      ...fixes.map((fix) => `${fix.label}: ${fix.summary}${fix.command ? ` Comando: ${fix.command}.` : ''}`),
    ].join('\n');
  }
}

function providerFix(
  check: ZavorthRuntimeReadinessCheck,
  providerSnapshot: ZavorthProviderReadinessMatrixSnapshot | null,
): ZavorthRuntimeGuidedFix {
  const readyEntry = providerSnapshot?.entries.find((entry) => entry.status === 'ready');
  const providerId = normalizeId(providerSnapshot?.activeProvider) || readyEntry?.id || 'gemini';
  if (providerSnapshot && providerSnapshot.summary.ready > 0 && providerSnapshot.summary.defaultRouteAllowed === 0) {
    return fix({
      check,
      id: 'fix-provider-live-proof',
      label: 'Validar provider com prova live',
      kind: 'provider-live-proof',
      risk: 'low',
      summary: `Executa um probe explicito em ${providerId} e salva evidencia sanitaria sem segredo bruto.`,
      command: `zavorth readiness fix provider --live-proof --provider ${providerId}`,
      route: '/zavorthControl/providers',
      telegramCommand: '/models',
      requiresExplicitOperatorAction: true,
    });
  }
  return fix({
    check,
    id: 'fix-provider-setup',
    label: 'Configurar provider',
    kind: 'manual-setup',
    risk: 'read_only',
    summary: 'Mostra quais providers precisam de credencial ou base URL antes de usar LLM real.',
    command: 'zavorth providers',
    route: '/zavorthControl/providers',
    telegramCommand: '/models',
  });
}

function readyFix(readiness: ZavorthRuntimeReadinessSnapshot): ZavorthRuntimeGuidedFix {
  return {
    id: 'open-zavorthControl-ready',
    checkId: 'zavorthControl',
    label: 'Abrir zavorthControl',
    status: readiness.status,
    kind: 'open-route',
    risk: 'read_only',
    summary: 'Zavorth esta pronto; abrir o ZavorthControl e usar normalmente.',
    command: 'zavorth go',
    route: '/zavorthControl',
    telegramCommand: '/zavorthControl',
    requiresExplicitOperatorAction: false,
    requiresApproval: false,
    canRunFromCli: true,
    canRenderButton: true,
    executionAuthority: false,
    safeByDefault: true,
  };
}

function fix(input: {
  check: ZavorthRuntimeReadinessCheck;
  id: string;
  label: string;
  kind: ZavorthRuntimeGuidedFixKind;
  risk: ZavorthRuntimeGuidedFixRisk;
  summary: string;
  command: string | null;
  route: string | null;
  telegramCommand: string | null;
  requiresExplicitOperatorAction?: boolean;
}): ZavorthRuntimeGuidedFix {
  return {
    id: input.id,
    checkId: input.check.id,
    label: input.label,
    status: input.check.status,
    kind: input.kind,
    risk: input.risk,
    summary: input.summary,
    command: input.command,
    route: input.route,
    telegramCommand: input.telegramCommand,
    requiresExplicitOperatorAction: input.requiresExplicitOperatorAction === true,
    requiresApproval: input.risk === 'approval_required',
    canRunFromCli: Boolean(input.command),
    canRenderButton: Boolean(input.route || input.telegramCommand),
    executionAuthority: false,
    safeByDefault: true,
  };
}

function normalizeId(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}
