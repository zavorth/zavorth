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
          'After turning release into a product flow, the final item in this order closes operation segmented by workspace, tenant, and team.',
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
    lines.push(`next passo recomendada: ${resolved.nextRecommendedGate.gate} - ${resolved.nextRecommendedGate.title}`);
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
      summary: snapshot.diff.summary || 'without enough history for real diff; wizard keeps the comparison plan.',
      docsDelta: docs ? `+${docs.added.length} ~${docs.changed.length} -${docs.removed.length}`
        : 'waiting for snapshots',
      remoteConsoleDelta: remoteConsole ? `+${remoteConsole.added.length} ~${remoteConsole.changed.length} -${remoteConsole.removed.length}`
        : 'waiting for snapshots',
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
        : [rollback.preflight.checks.map((check) => `${check.id}:${check.status}`).join(', ') || 'without evidence real ainda'],
      reversalPlan: rollback.reversalPlan.length > 0
        ? rollback.reversalPlan
        : ['Select archived snapshot.', 'Compare human-readable diff.', 'run rollback only after confirmation.'],
    };
  }

  private buildChangelog(snapshot: ZavorthReleasePresenceSnapshot): ReleaseUxChangelog {
    const entries = snapshot.changelog.entries.length > 0
      ? snapshot.changelog.entries
      : ['No previous publishes; changelog is ready for the first release.'];
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
        label: 'Read release readiness',
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
        label: 'review diff humano',
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
        label: 'run hygiene scan',
        phase: 'hygiene',
        command: 'npm run release:scan',
        previewOnly: true,
        requiresApproval: false,
        status: 'ready',
        summary: 'Searches critical markers before publishing.',
        evidence: ['static scan; does not start persistent runtime'],
      },
      {
        id: 'publish-alpha-beta',
        label: 'Publish alpha/beta only after approval',
        phase: 'publish',
        command: releaseStatus.release.channel === 'beta' ? 'npm run release:beta' : 'npm run release:alpha',
        previewOnly: true,
        requiresApproval: true,
        status: publishStatus,
        summary: 'Wizard shows command and risk, but does not execute publish automatically.',
        evidence: [`channel=${releaseStatus.release.channel}`, `risk=${releaseStatus.release.risk.level}`],
      },
      {
        id: 'rollback-preview',
        label: 'Prepare rollback preview',
        phase: 'rollback',
        command: rollback.command,
        previewOnly: true,
        requiresApproval: true,
        status: rollback.preflightStatus === 'block' ? 'blocked' : rollback.preflightStatus === 'warn' ? 'attention' : 'ready',
        summary: `preflight=${rollback.preflightStatus}; target=${rollback.targetLabel || 'not resolved'}`,
        evidence: rollback.evidence,
      },
      {
        id: 'changelog',
        label: 'Generate operational changelog',
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
        command ? `package.json exposes ${scriptName} for the guided release flow.`
          : `package.json must expose ${scriptName}.`,
        'package',
        [`command=${command || '<missing>'}`],
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
        ? 'ZavorthControl exposes readiness, diff, rollback, and release-flow changelog.'
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
        ? 'Release presence already exposes risk, diff, rollback preview, and redacted credentials.'
        : 'Release presence lost contracts required for Release UX.',
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
      ok ? 'Publish and rollback appear as approvable commands, without automatic execution.'
        : 'Wizard became able to execute publish/rollback without preview or approval.',
      'wizard',
      [
        `unsafeSteps=${unsafeSteps.map((step) => step.id).join(', ') || '<none>'}`,
        `approvalMissing=${publishWithoutApproval.map((step) => step.id).join(', ') || '<none>'}`,
      ],
    );
  }

  private checkHumanDiff(diff: ReleaseUxHumanDiff): ReleaseUxCheck {
    return this.check(
      'wizard:human-diff',
      'diff humano de publish',
      'pass',
      diff.available ? 'Diff de publish tem summary humano e deltas por surface.'
        : 'Cold history: human diff preserves plan and attention state without blocking the gate.',
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
      'rollback com risk, evidence e confirmation',
      ok ? 'pass' : 'fail',
      ok ? 'Rollback preview includes preflight, evidence, risk, and reversal plan without running.'
        : 'Rollback must return to read-only, evidenced, and confirmed.',
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
      'changelog operational legivel',
      ok ? 'pass' : 'fail',
      ok ? 'Changelog exposes operational summaries without raw payloads or secrets.'
        : 'Changelog needs a summary and must not expose payload/secret in the first layer.',
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
      'release UX does not start persistent background',
      offenders.length === 0 ? 'pass' : 'fail',
      offenders.length === 0
        ? 'Wizard e gate de release UX sao reads sob demanda.'
        : 'Wizard ou gate de release UX apontam para process persistente.',
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
