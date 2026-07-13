import { ZavorthProviderReadinessMatrixService } from './ZavorthProviderReadinessMatrixService.js';
import type {
  ZavorthRuntimeReadinessCheck,
  ZavorthRuntimeReadinessCheckId,
  ZavorthRuntimeReadinessSnapshot,
  ZavorthRuntimeReadinessStatus,
} from './ZavorthRuntimeReadinessService.js';

import type { ZavorthProviderReadinessMatrixSnapshot } from '../contracts/ZavorthProviderReadinessMatrixContract.js';
import { logger } from '../logger.js';
import { tService } from '../i18n/services.js';

export const ZAVORTH_RUNTIME_GUIDED_FIXES_CONTRACT_VERSION = 'zavorth-runtime-guided-fixes/1' as const;

export type ZavorthRuntimeGuidedFixKind =
  | 'open-route'
  | 'run-command'
  | 'provider-setup'
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
      tService('guided_fixes.title'),
      `${tService('guided_fixes.status_label')}: ${snapshot.status}`,
      snapshot.pending > 0
        ? tService('guided_fixes.pending_action_needed', { count: String(snapshot.pending) })
        : tService('guided_fixes.no_pending'),
      '',
      ...snapshot.fixes.map((fix, index) => [
        `${index + 1}. ${fix.label}`,
        `   ${fix.summary}`,
        fix.command ? `   ${tService('guided_fixes.command_label')}: ${fix.command}` : null,
        fix.route ? `   ${tService('guided_fixes.screen_label')}: ${fix.route}` : null,
        fix.telegramCommand ? `   ${tService('guided_fixes.telegram_label')}: ${fix.telegramCommand}` : null,
      ].filter(Boolean).join('\n')),
      '',
      tService('guided_fixes.disclaimer'),
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
        label: tService('guided_fixes.label_telegram_guide'),
        kind: 'manual-setup',
        risk: 'read_only',
        summary: tService('guided_fixes.summary_telegram_guide'),
        command: 'zavorth connectors doctor telegram',
        route: '/zavorthControl/providers',
        telegramCommand: '/status',
      });
    }
    if (check.id === 'zavorthControl') {
      return fix({
        check,
        id: 'fix-zavorthControl',
        label: tService('guided_fixes.label_reopen_control'),
        kind: 'run-command',
        risk: 'read_only',
        summary: tService('guided_fixes.summary_reopen_control'),
        command: 'zavorth go',
        route: '/zavorthControl',
        telegramCommand: '/zavorthControl',
      });
    }
    if (check.id === 'approvals') {
      return fix({
        check,
        id: 'fix-approvals',
        label: tService('guided_fixes.label_review_approvals'),
        kind: 'inspect',
        risk: 'read_only',
        summary: tService('guided_fixes.summary_review_approvals'),
        command: 'zavorth gateway approvals',
        route: '/zavorthControl/logs',
        telegramCommand: '/echoapprovals',
      });
    }
    if (check.id === 'transaction-plane') {
      return fix({
        check,
        id: 'fix-transaction-plane',
        label: tService('guided_fixes.label_check_transaction'),
        kind: 'inspect',
        risk: 'read_only',
        summary: tService('guided_fixes.summary_check_transaction'),
        command: 'zavorth transaction-live-executor-gate',
        route: '/zavorthControl/health',
        telegramCommand: '/status',
      });
    }
    if (check.id === 'skill-imports') {
      return fix({
        check,
        id: 'fix-skill-imports',
        label: tService('guided_fixes.label_check_skill_imports'),
        kind: 'inspect',
        risk: 'read_only',
        summary: tService('guided_fixes.summary_check_skill_imports'),
        command: 'npx tsx scripts/skills-security-scan.ts',
        route: '/zavorthControl/health',
        telegramCommand: '/status',
      });
    }
    if (check.id === 'memory-continuity') {
      return fix({
        check,
        id: 'fix-memory-continuity',
        label: tService('guided_fixes.label_review_memory'),
        kind: 'inspect',
        risk: 'read_only',
        summary: tService('guided_fixes.summary_review_memory'),
        command: 'zavorth memory review --json',
        route: '/zavorthControl/logs',
        telegramCommand: '/status',
      });
    }
    return fix({
      check,
      id: 'fix-natural-first',
      label: tService('guided_fixes.label_test_natural_input'),
      kind: 'inspect',
      risk: 'read_only',
      summary: tService('guided_fixes.summary_test_natural_input'),
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
      tService('guided_fixes.title'),
      snapshot.pending > 0
        ? tService('guided_fixes.pending_action_needed', { count: String(snapshot.pending) })
        : tService('guided_fixes.no_pending'),
      '',
      ...fixes.map((fix) => `${fix.label}: ${fix.summary}${fix.command ? ` ${tService('guided_fixes.command_label')}: ${fix.command}.` : ''}`),
    ].join('\n');
  }
}

function providerFix(
  check: ZavorthRuntimeReadinessCheck,
  providerSnapshot: ZavorthProviderReadinessMatrixSnapshot | null,
): ZavorthRuntimeGuidedFix {
  const readyEntry = providerSnapshot?.entries.find((entry) => entry.status === 'ready');
  const providerId = normalizeId(providerSnapshot?.activeProvider) || readyEntry?.id || '';
  if (!providerId) {
    return fix({
      check,
      id: 'choose-provider',
      label: 'Choose a provider',
      kind: 'provider-setup',
      risk: 'low',
      summary: 'No default provider is selected. Pick the provider and model you want before live proof.',
      command: 'zavorth providers switch',
      route: '/zavorthControl/providers',
      telegramCommand: '/models',
      requiresExplicitOperatorAction: true,
    });
  }
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
