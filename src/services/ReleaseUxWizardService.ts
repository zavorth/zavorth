import { buildRuntimeShellHtml } from '../domain/surface/presentation/web-console/WebConsoleRuntimeShellHtml.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  RELEASE_UX_CONTRACTS,
  RELEASE_UX_PACKAGE_SCRIPTS,
  RELEASE_UX_WEB_MARKERS,
  type ReleaseUxCheck,
  type ReleaseUxCheckStatus,
  type ReleaseUxChangelog,
  type ReleaseUxHumanDiff,
  type ReleaseUxRollbackPreview,
  type ReleaseUxSource,
  type ReleaseUxWizardSnapshot,
  type ReleaseUxWizardStep,
} from '../contracts/ReleaseUxWizardContract.js';

import { logger } from '../logger.js';
import {
ZavorthReleasePresenceControlPlaneService,
  type ZavorthReleaseDiffInput,
  type ZavorthReleasePresenceSnapshot,
  type ZavorthReleaseRollbackInput,
  type ZavorthReleaseStatusInput,
} from './ZavorthReleasePresenceControlPlaneService.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

type ReleasePresenceLike = Pick<
  ZavorthReleasePresenceControlPlaneService,
  'buildStatus' | 'buildDiff' | 'buildRollbackPreview'
>;

export type ReleaseUxWizardServiceOptions = {
  projectRoot?: string;
  packageJson?: PackageLike;
  html?: string;
  releasePresenceSnapshot?: ZavorthReleasePresenceSnapshot;
  releasePresence?: ReleasePresenceLike;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  now?: () => Date;
};

export class ReleaseUxWizardService {
  private readonly projectRoot: string;
  private readonly packageJson: PackageLike | null;
  private readonly html: string | null;
  private readonly releasePresenceSnapshot: ZavorthReleasePresenceSnapshot | null;
  private readonly releasePresence: ReleasePresenceLike;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly now: () => Date;

  constructor(options: ReleaseUxWizardServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.packageJson = options.packageJson || null;
    this.html = Object.prototype.hasOwnProperty.call(options, 'html') ? options.html || '' : null;
    this.releasePresenceSnapshot = options.releasePresenceSnapshot || null;
    this.releasePresence = options.releasePresence || new ZavorthReleasePresenceControlPlaneService({
      projectRoot: this.projectRoot,
    });
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || ((targetPath, encoding) => fs.readFileSync(targetPath, encoding));
    this.now = options.now || (() => new Date());
  }

  public async buildSnapshot(): Promise<ReleaseUxWizardSnapshot> {
    const releaseStatus = await this.resolveReleaseStatus();
    const releaseDiff = await this.resolveReleaseDiff();
    const rollbackPreview = await this.resolveRollbackPreview();
    const humanDiff = this.buildHumanDiff(releaseDiff);
    const rollback = this.buildRollbackPreview(rollbackPreview);
    const changelog = this.buildChangelog(releaseStatus);
    const steps = this.buildWizardSteps(releaseStatus, humanDiff, rollback, changelog);
    const checks = [
      ...this.checkPackageScripts(),
      this.checkWebMarkers(),
      this.checkReleaseControlPlane(releaseStatus, rollbackPreview),
      this.checkPreviewFirstWizard(steps, rollback),
      this.checkHumanDiff(humanDiff),
      this.checkRollbackPreview(rollback),
      this.checkChangelog(changelog),
      this.checkQuietCommands(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'release-ux-wizard',
      surface: 'release-ux',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
        steps: steps.length,
        approvalsRequired: steps.filter((step) => step.requiresApproval).length,
        changelogEntries: changelog.entries.length,
        rollbackEvidence: rollback.evidence.length,
        heavyRuntimesStarted: false,
      },
      release: {
        channel: releaseStatus.release.channel,
        version: releaseStatus.release.version,
        risk: releaseStatus.release.risk.level,
        status: releaseStatus.status,
      },
      wizard: {
        steps,
        humanDiff,
        rollback,
        changelog,
      },
      checks,
      contracts: RELEASE_UX_CONTRACTS,
      commands: {
        inspect: 'npm run release:wizard',
        json: 'npm run release:wizard:json',
        gate: 'npm run qa:release-ux',
        diff: 'npm run release:diff',
        rollbackPreview: 'npm run release:rollback-preview',
        changelog: 'npm run release:changelog',
      },
      nextRecommendedGate: {
        gate: 'tenant-team-ops',
        title: 'Tenant/Team Ops',
        reason:
          'Depois de transformar release em fluxo de produto, a ultima etapa desta ordem fecha operacao segmentada por workspace, tenant e time.',
      },
    };
  }

  public async renderReport(snapshot: ReleaseUxWizardSnapshot | null = null): Promise<string> {
    const resolved = snapshot || await this.buildSnapshot();
    const lines: string[] = [];
    lines.push('[release-ux] Release UX');
    lines.push(`status: ${resolved.status}`);
    lines.push(`ok: ${resolved.summary.ok ? 'yes' : 'no'} | pass=${resolved.summary.passed} warn=${resolved.summary.warnings} fail=${resolved.summary.failed}`);
    lines.push(`steps=${resolved.summary.steps} approvals=${resolved.summary.approvalsRequired} changelog=${resolved.summary.changelogEntries} rollbackEvidence=${resolved.summary.rollbackEvidence}`);
    lines.push('');
    lines.push('Wizard:');
    for (const step of resolved.wizard.steps) {
      lines.push(`- ${step.label}: ${step.status} | ${step.command}`);
    }
    lines.push('');
    lines.push(`Diff: ${resolved.wizard.humanDiff.summary}`);
    lines.push(`Rollback: ${resolved.wizard.rollback.preflightStatus} | ${resolved.wizard.rollback.command}`);
    lines.push('');
    for (const check of resolved.checks) {
      lines.push(`[${check.status}] ${check.title} (${check.source})`);
      lines.push(`  ${check.reason}`);
      for (const evidence of check.evidence || []) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proximo passo recomendada: ${resolved.nextRecommendedGate.gate} - ${resolved.nextRecommendedGate.title}`);
    lines.push(resolved.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private async resolveReleaseStatus(): Promise<ZavorthReleasePresenceSnapshot> {
    if (this.releasePresenceSnapshot) {
      return this.releasePresenceSnapshot;
    }
    return this.releasePresence.buildStatus({ live: false } satisfies ZavorthReleaseStatusInput);
  }

  private async resolveReleaseDiff(): Promise<ZavorthReleasePresenceSnapshot> {
    if (this.releasePresenceSnapshot) {
      return this.releasePresenceSnapshot;
    }
    return this.releasePresence.buildDiff({
      from: 'previous',
      to: 'latest',
      live: false,
    } satisfies ZavorthReleaseDiffInput);
  }

  private async resolveRollbackPreview(): Promise<ZavorthReleasePresenceSnapshot> {
    if (this.releasePresenceSnapshot) {
      return this.releasePresenceSnapshot;
    }
    return this.releasePresence.buildRollbackPreview({
      targetId: null,
      preview: true,
      live: false,
    } satisfies ZavorthReleaseRollbackInput);
  }

  private buildHumanDiff(snapshot: ZavorthReleasePresenceSnapshot): ReleaseUxHumanDiff {
    const report = snapshot.diff.report;
    const docs = report?.targets.docs;
    const remoteConsole = report?.targets.remoteConsole;
    return {
      requested: {
        from: snapshot.diff.requested.from,
        to: snapshot.diff.requested.to,
      },
      available: snapshot.diff.available,
      status: snapshot.diff.available ? 'ready' : 'attention',
      summary: snapshot.diff.summary || 'Sem historico suficiente para diff real; wizard mantem plano de comparacao.',
      docsDelta: docs
        ? `+${docs.added.length} ~${docs.changed.length} -${docs.removed.length}`
        : 'aguardando snapshots',
      remoteConsoleDelta: remoteConsole
        ? `+${remoteConsole.added.length} ~${remoteConsole.changed.length} -${remoteConsole.removed.length}`
        : 'aguardando snapshots',
      command: 'npm run release:diff',
    };
  }

  private buildRollbackPreview(snapshot: ZavorthReleasePresenceSnapshot): ReleaseUxRollbackPreview {
    const rollback = snapshot.rollback;
    const risk: ReleaseUxRollbackPreview['risk'] =
      rollback.preflight.status === 'block'
        ? 'high'
        : rollback.preflight.status === 'warn' || snapshot.release.risk.level === 'medium'
          ? 'medium'
          : snapshot.release.risk.level;
    return {
      targetId: rollback.targetId,
      targetLabel: rollback.targetLabel,
      risk,
      command: 'npm run release:rollback-preview',
      previewOnly: rollback.previewOnly,
      confirmationRequired: rollback.confirmationRequired,
      executed: false,
      preflightStatus: rollback.preflight.status,
      evidence: rollback.evidence.length > 0
        ? rollback.evidence
        : [rollback.preflight.checks.map((check) => `${check.id}:${check.status}`).join(', ') || 'sem evidencia real ainda'],
      reversalPlan: rollback.reversalPlan.length > 0
        ? rollback.reversalPlan
        : ['Selecionar snapshot arquivado.', 'Comparar diff humano.', 'Executar rollback somente apos confirmacao.'],
    };
  }

  private buildChangelog(snapshot: ZavorthReleasePresenceSnapshot): ReleaseUxChangelog {
    const entries = snapshot.changelog.entries.length > 0
      ? snapshot.changelog.entries
      : ['Sem publishes anteriores; changelog fica pronto para o primeiro release.'];
    return {
      source: snapshot.changelog.generatedFrom,
      entries,
      operatorSummary: entries.slice(0, 3).join(' '),
      command: 'npm run release:changelog',
    };
  }

  private buildWizardSteps(
    releaseStatus: ZavorthReleasePresenceSnapshot,
    humanDiff: ReleaseUxHumanDiff,
    rollback: ReleaseUxRollbackPreview,
    changelog: ReleaseUxChangelog,
  ): ReleaseUxWizardStep[] {
    const publishStatus: ReleaseUxWizardStep['status'] = releaseStatus.release.risk.level === 'high'
      ? 'attention'
      : 'ready';
    return [
      {
        id: 'readiness',
        label: 'Ler readiness de release',
        phase: 'readiness',
        command: 'npm run release:status',
        previewOnly: true,
        requiresApproval: false,
        status: releaseStatus.status === 'blocked' ? 'blocked' : publishStatus,
        summary: releaseStatus.narrative.operatorSummary,
        evidence: releaseStatus.release.risk.reasons,
      },
      {
        id: 'human-diff',
        label: 'Revisar diff humano',
        phase: 'diff',
        command: humanDiff.command,
        previewOnly: true,
        requiresApproval: false,
        status: humanDiff.status === 'ready' ? 'ready' : 'attention',
        summary: humanDiff.summary,
        evidence: [`docs=${humanDiff.docsDelta}`, `remoteConsole=${humanDiff.remoteConsoleDelta}`],
      },
      {
        id: 'release-hygiene',
        label: 'Rodar hygiene scan',
        phase: 'hygiene',
        command: 'npm run release:scan',
        previewOnly: true,
        requiresApproval: false,
        status: 'ready',
        summary: 'Busca marcadores criticos antes de publicar.',
        evidence: ['scan estatico; nao inicia runtime persistente'],
      },
      {
        id: 'publish-alpha-beta',
        label: 'Publicar alpha/beta somente apos aprovacao',
        phase: 'publish',
        command: releaseStatus.release.channel === 'beta' ? 'npm run release:beta' : 'npm run release:alpha',
        previewOnly: true,
        requiresApproval: true,
        status: publishStatus,
        summary: 'Wizard mostra comando e risco, mas nao executa publish automaticamente.',
        evidence: [`channel=${releaseStatus.release.channel}`, `risk=${releaseStatus.release.risk.level}`],
      },
      {
        id: 'rollback-preview',
        label: 'Preparar rollback preview',
        phase: 'rollback',
        command: rollback.command,
        previewOnly: true,
        requiresApproval: true,
        status: rollback.preflightStatus === 'block' ? 'blocked' : rollback.preflightStatus === 'warn' ? 'attention' : 'ready',
        summary: `preflight=${rollback.preflightStatus}; target=${rollback.targetLabel || 'nao resolvido'}`,
        evidence: rollback.evidence,
      },
      {
        id: 'changelog',
        label: 'Gerar changelog operacional',
        phase: 'changelog',
        command: changelog.command,
        previewOnly: true,
        requiresApproval: false,
        status: 'ready',
        summary: changelog.operatorSummary,
        evidence: changelog.entries.slice(0, 3),
      },
    ];
  }

  private checkPackageScripts(): ReleaseUxCheck[] {
    const scripts = this.readPackageJson()?.scripts || {};
    return RELEASE_UX_PACKAGE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `package:${scriptName}`,
        `script ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `package.json expoe ${scriptName} para o fluxo guiado de release.`
          : `package.json precisa expor ${scriptName}.`,
        'package',
        [`command=${command || '<ausente>'}`],
      );
    });
  }

  private checkWebMarkers(): ReleaseUxCheck {
    const html = this.html !== null ? this.html : buildRuntimeShellHtml('/zavorthControl');
    const missing = RELEASE_UX_WEB_MARKERS.filter((marker) => !html.includes(marker));
    return this.check(
      'web:release-ux-wizard',
      'card de release UX no /zavorthControl',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'ZavorthControl expoe readiness, diff, rollback e changelog do fluxo de release.'
        : 'ZavorthControl perdeu marcadores do release wizard.',
      'web',
      missing.map((marker) => `faltando: ${marker}`),
    );
  }

  private checkReleaseControlPlane(
    statusSnapshot: ZavorthReleasePresenceSnapshot,
    rollbackSnapshot: ZavorthReleasePresenceSnapshot,
  ): ReleaseUxCheck {
    const contracts = {
      remoteNeverRequiresLooseCredentialFirstLayer:
        statusSnapshot.contracts.remoteNeverRequiresLooseCredentialFirstLayer,
      publishRegistersVersionDiffRiskRollback:
        statusSnapshot.contracts.publishRegistersVersionDiffRiskRollback,
      rollbackPreviewDoesNotExecute:
        rollbackSnapshot.contracts.rollbackPreviewDoesNotExecute,
      rollbackHasPreflightAndEvidence:
        rollbackSnapshot.contracts.rollbackHasPreflightAndEvidence,
    };
    const failed = Object.entries(contracts)
      .filter(([, value]) => !value)
      .map(([key]) => key);
    return this.check(
      'control-plane:release-presence',
      'release presence sustenta o wizard',
      failed.length === 0 ? 'pass' : 'fail',
      failed.length === 0
        ? 'Release presence ja expoe risco, diff, rollback preview e credenciais redigidas.'
        : 'Release presence perdeu contratos necessarios para Release UX.',
      'control-plane',
      failed,
    );
  }

  private checkPreviewFirstWizard(steps: ReleaseUxWizardStep[], rollback: ReleaseUxRollbackPreview): ReleaseUxCheck {
    const unsafeSteps = steps.filter((step) => !step.previewOnly && (step.phase === 'publish' || step.phase === 'rollback'));
    const publishWithoutApproval = steps.filter((step) =>
      (step.phase === 'publish' || step.phase === 'rollback') && !step.requiresApproval);
    const ok = unsafeSteps.length === 0
      && publishWithoutApproval.length === 0
      && rollback.executed === false;
    return this.check(
      'wizard:preview-first',
      'wizard preview-first',
      ok ? 'pass' : 'fail',
      ok
        ? 'Publish e rollback aparecem como comandos aprovaveis, sem execucao automatica.'
        : 'Wizard ficou capaz de executar publish/rollback sem preview ou aprovacao.',
      'wizard',
      [
        `unsafeSteps=${unsafeSteps.map((step) => step.id).join(', ') || '<nenhum>'}`,
        `approvalMissing=${publishWithoutApproval.map((step) => step.id).join(', ') || '<nenhum>'}`,
      ],
    );
  }

  private checkHumanDiff(diff: ReleaseUxHumanDiff): ReleaseUxCheck {
    return this.check(
      'wizard:human-diff',
      'diff humano de publish',
      'pass',
      diff.available
        ? 'Diff de publish tem resumo humano e deltas por superficie.'
        : 'Historico frio: diff humano preserva plano e estado de atencao sem bloquear o gate.',
      'wizard',
      [`summary=${diff.summary}`, `docs=${diff.docsDelta}`, `remoteConsole=${diff.remoteConsoleDelta}`],
    );
  }

  private checkRollbackPreview(rollback: ReleaseUxRollbackPreview): ReleaseUxCheck {
    const ok = rollback.previewOnly
      && rollback.confirmationRequired
      && rollback.executed === false
      && rollback.evidence.length > 0
      && rollback.reversalPlan.length > 0;
    return this.check(
      'rollback:guarded-preview',
      'rollback com risco, evidencia e confirmacao',
      ok ? 'pass' : 'fail',
      ok
        ? 'Rollback preview inclui preflight, evidencia, risco e plano de reversao sem executar.'
        : 'Rollback precisa voltar a ser read-only, evidencedo e confirmado.',
      'rollback',
      [
        `risk=${rollback.risk}`,
        `preflight=${rollback.preflightStatus}`,
        `evidence=${rollback.evidence.length}`,
        `confirmation=${rollback.confirmationRequired}`,
      ],
    );
  }

  private checkChangelog(changelog: ReleaseUxChangelog): ReleaseUxCheck {
    const joined = changelog.entries.join('\n').toLowerCase();
    const unsafe = /token=|secret|password|payload bruto|raw payload/.test(joined);
    const ok = changelog.entries.length > 0 && !unsafe;
    return this.check(
      'changelog:operational',
      'changelog operacional legivel',
      ok ? 'pass' : 'fail',
      ok
        ? 'Changelog expoe resumos operacionais sem payload bruto ou segredos.'
        : 'Changelog precisa ter resumo e nao pode expor payload/secret na primeira camada.',
      'changelog',
      [`entries=${changelog.entries.length}`, `source=${changelog.source}`],
    );
  }

  private checkQuietCommands(): ReleaseUxCheck {
    const scripts = this.readPackageJson()?.scripts || {};
    const quietScripts = ['release:wizard', 'release:wizard:json', 'qa:release-ux', 'qa:release-ux-wizard'];
    const backgroundWords = ['nodemon', '--watch', ' dev', 'node-mesh-host', 'ops-maintain-recurring', 'start-ai-gateway-runtime'];
    const offenders = quietScripts.filter((scriptName) => {
      const command = ` ${String(scripts[scriptName] || '').toLowerCase()} `;
      return backgroundWords.some((word) => command.includes(word.toLowerCase()));
    });
    return this.check(
      'wizard:quiet-gate',
      'release UX nao inicia background persistente',
      offenders.length === 0 ? 'pass' : 'fail',
      offenders.length === 0
        ? 'Wizard e gate de release UX sao leituras sob demanda.'
        : 'Wizard ou gate de release UX apontam para processo persistente.',
      'wizard',
      offenders,
    );
  }

  private readPackageJson(): PackageLike | null {
    if (this.packageJson) {
      return this.packageJson;
    }
    const target = path.resolve(this.projectRoot, 'package.json');
    if (!this.existsSync(target)) {
      return null;
    }
    try {
      return JSON.parse(this.readFileSync(target, 'utf8')) as PackageLike;
    } catch (error: unknown) {logger.warn('[Release Ux Wizard] JSON parse failed', error); return null; }
  }

  private check(
    id: string,
    title: string,
    status: ReleaseUxCheckStatus,
    reason: string,
    source: ReleaseUxSource,
    evidence: string[] = [],
  ): ReleaseUxCheck {
    return {
      id,
      title,
      status,
      source,
      reason,
      evidence,
    };
  }
}
