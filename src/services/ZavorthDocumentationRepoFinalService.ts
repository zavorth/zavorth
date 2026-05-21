import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  ZAVORTH_DOCUMENTATION_REPO_FINAL_CONTRACT_VERSION,
  type ZavorthDocumentationRepoFinalCheck,
  type ZavorthDocumentationRepoFinalSnapshot,
  type ZavorthDocumentationRepoFinalStatus,
} from '../contracts/ZavorthDocumentationRepoFinalContract.js';

type Runtime = {
  now?: () => Date;
  root?: string;
};

type ScriptResult = {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
};

type DocsAudit = {
  totalDocs?: number;
  summary?: {
    publicDocsNeedingFix?: number;
    archiveOrDelete?: number;
    moveInternal?: number;
    missingLinks?: number;
    missingPathRefs?: number;
    missingNpmScripts?: number;
  };
  rootNoise?: Array<{ file: string; exists: boolean; tracked: boolean }>;
};

export class ZavorthDocumentationRepoFinalService {
  private readonly now: () => Date;
  private readonly root: string;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.root = runtime.root || process.cwd();
  }

  public buildSnapshot(): ZavorthDocumentationRepoFinalSnapshot {
    const docsAuditResult = this.runNode(['scripts/docs-public-repo-audit.mjs', '--json']);
    const docsAudit = docsAuditResult.ok ? this.parseJson<DocsAudit>(docsAuditResult.stdout) : null;
    const publicIdentity = this.runNode(['scripts/zavorth-public-identity-scan.mjs']);
    const liveCertification = this.runNode(['scripts/zavorth-live-certification-matrix-check.mjs']);
    const checks = [
      this.checkDocsAudit(docsAuditResult, docsAudit),
      this.checkPublicIdentity(publicIdentity),
      this.checkLiveCertification(liveCertification),
      this.checkRootNoise(docsAudit),
      this.checkReadmeAndDocs(),
      this.checkSurfacePosture(),
      this.checkPackagePosture(),
      this.checkWorkspaceWiring(),
    ];
    const summary = summarize(checks, docsAudit);
    const status = resolveStatus(checks);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_DOCUMENTATION_REPO_FINAL_CONTRACT_VERSION,
      source: 'ZavorthDocumentationRepoFinalService',
      status,
      summary,
      checks,
      guarantees: {
        dashboardIsPrimarySurface: true,
        satelliteAndCliRemainValidSurfaces: true,
        retiredVisualSurfacesAreNotUserFacing: true,
        docsDoNotPublishImplementationDiaries: true,
        publicIdentityIsZavorthNative: true,
        proprietaryDistributionIsExplicit: true,
        liveCertificationRemainsWired: true,
        commandCenterCanExecute: false,
      },
      commands: {
        inspect: 'npm run zavorth:documentation-repo-final',
        inspectJson: 'npm run zavorth:documentation-repo-final:json',
        check: 'npm run zavorth:documentation-repo-final:check --silent',
        workspace: 'npm run workspace:check',
        next: 'Product closure complete',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthDocumentationRepoFinalSnapshot): string {
    const lines = [
      'Zavorth Documentation And Repo Final - Intent model5',
      '',
      `Status: ${snapshot.status}`,
      `Checks: ${snapshot.summary.passed}/${snapshot.summary.checks} passed, ${snapshot.summary.attention} attention, ${snapshot.summary.failed} failed`,
      `Docs audited: ${snapshot.summary.publicDocsAudited}`,
      `Root noise files present: ${snapshot.summary.rootNoiseFilesPresent}`,
      '',
      'Checks:',
    ];
    for (const check of snapshot.checks) {
      lines.push(`- ${check.label}: ${check.status}`);
      lines.push(`  observed: ${check.observed}`);
      lines.push(`  target: ${check.target}`);
      for (const detail of check.details.slice(0, 8)) lines.push(`  - ${detail}`);
    }
    lines.push('', 'Guarantees:');
    lines.push('- /control is the final user web surface.');
    lines.push('- /satellite and CLI remain valid user surfaces.');
    lines.push('- retired visual surfaces are not promoted to normal users.');
    lines.push('- public docs and repo identity are Zavorth-native and proprietary.');
    lines.push('- this gate performs no live provider calls, channel sends, workspace mutations or external writes.');
    return lines.join('\n');
  }

  private checkDocsAudit(result: ScriptResult, docsAudit: DocsAudit | null): ZavorthDocumentationRepoFinalCheck {
    if (!result.ok || !docsAudit) {
      return check('docs-audit', 'Public documentation audit runs', 'failed', `exit=${result.status}`, 'audit json available', [
        result.stderr || result.stdout || 'no output',
      ]);
    }
    const summary = docsAudit.summary || {};
    const failures = [
      summary.publicDocsNeedingFix || 0,
      summary.missingLinks || 0,
      summary.missingPathRefs || 0,
      summary.missingNpmScripts || 0,
    ];
    const passed = failures.every((value) => value === 0);
    const attention = (summary.archiveOrDelete || 0) + (summary.moveInternal || 0);
    return check(
      'docs-audit',
      'Public documentation audit runs',
      passed ? (attention > 0 ? 'attention' : 'passed') : 'failed',
      `docs=${docsAudit.totalDocs || 0}; fix=${summary.publicDocsNeedingFix || 0}; archive=${summary.archiveOrDelete || 0}; internal=${summary.moveInternal || 0}`,
      '0 public fixes, 0 missing links, 0 missing paths, 0 missing npm scripts',
      attention > 0 ? ['Non-public docs still have archival/internal recommendations; they are not public fixes.'] : [],
    );
  }

  private checkPublicIdentity(result: ScriptResult): ZavorthDocumentationRepoFinalCheck {
    return check(
      'public-identity',
      'Public identity scan is clean',
      result.ok ? 'passed' : 'failed',
      result.ok ? 'Zavorth-native' : `exit=${result.status}`,
      'public identity surfaces stay Zavorth-native',
      result.ok ? [] : [result.stderr || result.stdout || 'no output'],
    );
  }

  private checkLiveCertification(result: ScriptResult): ZavorthDocumentationRepoFinalCheck {
    return check(
      'live-certification',
      'Live certification matrix remains wired',
      result.ok ? 'passed' : 'failed',
      result.ok ? 'checkpoint-13 gate passed' : `exit=${result.status}`,
      'live certification matrix passes without live side effects',
      result.ok ? [] : [result.stderr || result.stdout || 'no output'],
    );
  }

  private checkRootNoise(docsAudit: DocsAudit | null): ZavorthDocumentationRepoFinalCheck {
    const present = (docsAudit?.rootNoise || []).filter((entry) => entry.exists || entry.tracked);
    return check(
      'root-noise',
      'Old phase/root noise files are gone',
      present.length === 0 ? 'passed' : 'failed',
      `${present.length} present/tracked`,
      '0 legacy planning files in root',
      present.map((entry) => `${entry.file}: exists=${entry.exists}; tracked=${entry.tracked}`),
    );
  }

  private checkReadmeAndDocs(): ZavorthDocumentationRepoFinalCheck {
    const files = [
      'README.md',
      'docs/README.md',
      'docs/overview.md',
      'docs/web-dashboard.md',
      'docs/protocol/runtime-api-v1.md',
    ];
    const issues: string[] = [];
    for (const file of files) {
      const text = this.read(file);
      if (!text) {
        issues.push(`${file}: missing`);
        continue;
      }
      if (/zavorth@alpha|NPM ALPHA|alpha\.3/i.test(text)) issues.push(`${file}: still publishes alpha install language`);
      if (/Worker\s+\d+|mock-live-harness|Post-291|291 plan/i.test(text)) issues.push(`${file}: contains old implementation diary wording`);
    }
    const readme = this.read('README.md') || '';
    if (!readme.includes('assets/brand/zavorth-readme-banner.png')) issues.push('README.md: missing official banner');
    if (!readme.includes('/control')) issues.push('README.md: missing /control as primary surface');
    if (!readme.includes('npm install -g zavorth@latest')) issues.push('README.md: missing latest install path');
    if (!/proprietary/i.test(readme)) issues.push('README.md: missing proprietary positioning');

    return check(
      'public-docs-posture',
      'README and public docs are product-facing',
      issues.length === 0 ? 'passed' : 'failed',
      issues.length === 0 ? 'clean' : `${issues.length} issues`,
      'English, current install path, dashboard-first, no phase diary',
      issues,
    );
  }

  private checkSurfacePosture(): ZavorthDocumentationRepoFinalCheck {
    const webDoc = this.read('docs/web-dashboard.md') || '';
    const apiDoc = this.read('docs/protocol/runtime-api-v1.md') || '';
    const issues = [];
    if (!/\/control/.test(webDoc)) issues.push('docs/web-dashboard.md: /control is not named as final user surface');
    if (!/\/satellite/.test(webDoc)) issues.push('docs/web-dashboard.md: satellite is not named as companion surface');
    if (!/not final-user surfaces/i.test(webDoc)) issues.push('docs/web-dashboard.md: maintenance shell posture is unclear');
    if (!/does not execute actions by itself/i.test(apiDoc)) issues.push('runtime-api-v1.md: dashboard display-only posture is unclear');
    if (!/Policy Broker/i.test(apiDoc)) issues.push('runtime-api-v1.md: Policy Broker requirement is missing');

    return check(
      'surface-posture',
      'Surface posture is unambiguous',
      issues.length === 0 ? 'passed' : 'failed',
      issues.length === 0 ? 'command-center/satellite/CLI clear' : `${issues.length} issues`,
      '/control primary, /satellite companion, CLI power user, maintenance shells internal',
      issues,
    );
  }

  private checkPackagePosture(): ZavorthDocumentationRepoFinalCheck {
    const pkg = this.readJson('package.json');
    const license = this.read('LICENSE');
    const issues = [];
    if (pkg?.license !== 'UNLICENSED') issues.push(`package.json: license=${JSON.stringify(pkg?.license)}`);
    if (!String(pkg?.name || '').includes('zavorth')) issues.push('package.json: name is not zavorth');
    if (!String(pkg?.description || '').includes('Zavorth')) issues.push('package.json: description is not Zavorth-facing');
    if (!license || !/proprietary|all rights reserved/i.test(license)) issues.push('LICENSE: proprietary language missing');
    if (!fs.existsSync(path.join(this.root, 'assets/brand/zavorth-readme-banner.png'))) issues.push('assets/brand/zavorth-readme-banner.png: missing');
    if (!fs.existsSync(path.join(this.root, 'assets/brand/zavorth-social-preview.png'))) issues.push('assets/brand/zavorth-social-preview.png: missing');

    return check(
      'package-posture',
      'Package and brand assets are product-ready',
      issues.length === 0 ? 'passed' : 'failed',
      issues.length === 0 ? 'proprietary + brand assets present' : `${issues.length} issues`,
      'UNLICENSED/proprietary, Zavorth identity, banner and social preview present',
      issues,
    );
  }

  private checkWorkspaceWiring(): ZavorthDocumentationRepoFinalCheck {
    const pkg = this.readJson('package.json');
    const scripts = pkg?.scripts || {};
    const required = [
      'zavorth:documentation-repo-final',
      'zavorth:documentation-repo-final:json',
      'zavorth:documentation-repo-final:check',
    ];
    const issues = required.filter((script) => !scripts[script]).map((script) => `missing script ${script}`);
    const workspace = String(scripts['workspace:check'] || '');
    if (!workspace.includes('zavorth:documentation-repo-final:check')) issues.push('workspace:check missing documentation final gate');
    const daily = String(scripts['daily:certify'] || '');
    if (!daily.includes('zavorth:documentation-repo-final:check')) issues.push('daily:certify does not use final closure gate');

    return check(
      'workspace-wiring',
      'Final gate is wired into package scripts',
      issues.length === 0 ? 'passed' : 'failed',
      issues.length === 0 ? 'wired' : `${issues.length} issues`,
      'scripts and workspace:check include documentation repo final gate',
      issues,
    );
  }

  private runNode(args: string[]): ScriptResult {
    const result = spawnSync(process.execPath, args, {
      cwd: this.root,
      encoding: 'utf8',
      timeout: 120000,
    });
    return {
      ok: result.status === 0,
      status: result.status,
      stdout: result.stdout || '',
      stderr: result.stderr || result.error?.message || '',
    };
  }

  private read(relativePath: string): string | null {
    try {
      return fs.readFileSync(path.join(this.root, relativePath), 'utf8');
    } catch {
      return null;
    }
  }

  private readJson(relativePath: string): Record<string, any> | null {
    const text = this.read(relativePath);
    if (!text) return null;
    return this.parseJson<Record<string, any>>(text);
  }

  private parseJson<T>(text: string): T | null {
    try {
      return JSON.parse(text) as T;
    } catch {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1)) as T;
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

function check(
  id: string,
  label: string,
  status: ZavorthDocumentationRepoFinalStatus,
  observed: string,
  target: string,
  details: string[] = [],
): ZavorthDocumentationRepoFinalCheck {
  return { id, label, status, observed, target, details };
}

function resolveStatus(checks: ZavorthDocumentationRepoFinalCheck[]): ZavorthDocumentationRepoFinalStatus {
  if (checks.some((entry) => entry.status === 'failed')) return 'failed';
  if (checks.some((entry) => entry.status === 'attention')) return 'attention';
  return 'passed';
}

function summarize(checks: ZavorthDocumentationRepoFinalCheck[], docsAudit: DocsAudit | null) {
  const failed = checks.filter((entry) => entry.status === 'failed').length;
  const attention = checks.filter((entry) => entry.status === 'attention').length;
  const passed = checks.filter((entry) => entry.status === 'passed').length;
  const rootNoiseFilesPresent = (docsAudit?.rootNoise || []).filter((entry) => entry.exists || entry.tracked).length;
  return {
    checks: checks.length,
    passed,
    attention,
    failed,
    publicDocsAudited: docsAudit?.totalDocs || 0,
    publicDocsNeedingFix: docsAudit?.summary?.publicDocsNeedingFix || 0,
    archiveOrDeleteCandidates: docsAudit?.summary?.archiveOrDelete || 0,
    moveInternalCandidates: docsAudit?.summary?.moveInternal || 0,
    rootNoiseFilesPresent,
    rawSecretsSerialized: false as const,
    workspaceMutationPerformed: false as const,
    externalIoPerformed: false as const,
  };
}
