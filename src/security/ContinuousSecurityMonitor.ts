import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildOperationalSecurityDoctorReport,
  REQUIRED_SECURITY_CONTROL_FILES,
  type OperationalSecurityDoctorReport,
} from './OperationalSecurityDoctor.js';

export type ContinuousSecurityMonitorStatus = 'healthy' | 'attention' | 'blocked';
export type ContinuousSecurityMonitorCheckStatus = 'pass' | 'attention' | 'fail';
export type ContinuousSecurityMonitorSeverity = 'info' | 'warn' | 'critical';

export type ContinuousSecurityFileFingerprint = {
  id: string;
  relativePath: string;
  sha256: string | null;
  present: boolean;
};

export type ContinuousSecurityCommandFingerprint = {
  id: string;
  command: string | null;
  present: boolean;
};

export type ContinuousSecuritySnapshot = {
  generatedAt: string;
  controls: ContinuousSecurityFileFingerprint[];
  commandCatalog: ContinuousSecurityCommandFingerprint[];
  packageScripts: ContinuousSecurityCommandFingerprint[];
  requiredTests: ContinuousSecurityFileFingerprint[];
  hooks: ContinuousSecurityFileFingerprint[];
  automationFiles: ContinuousSecurityFileFingerprint[];
  ciWorkflow: ContinuousSecurityFileFingerprint;
};

export type ContinuousSecurityBaseline = {
  version: 1;
  updatedAt: string;
  snapshot: Omit<ContinuousSecuritySnapshot, 'generatedAt'>;
};

export type ContinuousSecurityDrift = {
  id: string;
  severity: ContinuousSecurityMonitorSeverity;
  summary: string;
  expected: string | null;
  actual: string | null;
};

export type ContinuousSecurityMonitorCheck = {
  id: string;
  status: ContinuousSecurityMonitorCheckStatus;
  severity: ContinuousSecurityMonitorSeverity;
  summary: string;
  evidence: string[];
  recommendation: string | null;
};

export type ContinuousSecurityMonitorReport = {
  generatedAt: string;
  ok: boolean;
  strict: boolean;
  status: ContinuousSecurityMonitorStatus;
  baselinePath: string;
  baselinePresent: boolean;
  summary: {
    total: number;
    passed: number;
    attention: number;
    failed: number;
    drift: number;
  };
  doctor: Pick<OperationalSecurityDoctorReport, 'ok' | 'status' | 'summary' | 'profile' | 'narrative'>;
  snapshot: ContinuousSecuritySnapshot;
  drift: ContinuousSecurityDrift[];
  checks: ContinuousSecurityMonitorCheck[];
  recommendations: string[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type ContinuousSecurityMonitorInput = {
  projectRoot?: string | null;
  workspace?: string | null;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  strict?: boolean;
  requireBaseline?: boolean;
  baselinePath?: string | null;
};

const REQUIRED_COMMAND_CATALOG_ENTRIES = [
  'security:doctor',
  'security:continuous',
  'security:baseline',
  'security:presets',
  'security:preset:professional',
];

const REQUIRED_PACKAGE_SECURITY_SCRIPTS = [
  'security:ci',
  'security:audit',
  'security:precommit',
  'security:prepush',
  'security:hooks:install',
];

const REQUIRED_SECURITY_TESTS = [
  'tests/security/SecurityProfile.test.ts',
  'tests/security/SecurityPolicyBroker.test.ts',
  'tests/security/SecurityOperationalPreset.test.ts',
  'tests/security/OperationalSecurityDoctor.test.ts',
  'tests/security/ContinuousSecurityMonitor.test.ts',
  'tests/execution/ToolExecutor.security-policy.test.ts',
];

const REQUIRED_HOOK_FILES = [
  '.githooks/pre-commit',
  '.githooks/pre-push',
];

const REQUIRED_AUTOMATION_FILES = [
  'scripts/security-ci-check.mjs',
  'scripts/security-continuous.ts',
  'scripts/security-doctor.ts',
  'scripts/security-preset.ts',
  'scripts/command-catalog.json',
];

export function buildContinuousSecurityMonitorReport(
  input: ContinuousSecurityMonitorInput = {},
): ContinuousSecurityMonitorReport {
  const projectRoot = path.resolve(input.projectRoot || process.cwd());
  const now = input.now || (() => new Date());
  const strict = input.strict === true;
  const baselinePath = path.resolve(input.baselinePath || path.join(projectRoot, 'config', 'security-continuous-baseline.json'));
  const generatedAt = now().toISOString();
  const snapshot = buildContinuousSecuritySnapshot({ projectRoot, generatedAt });
  const baseline = readContinuousSecurityBaseline(baselinePath);
  const drift = baseline ? compareContinuousSecurityBaseline(baseline, snapshot) : [];
  const doctor = buildOperationalSecurityDoctorReport({
    env: input.env,
    workspace: input.workspace || projectRoot,
    projectRoot,
    now,
    strict: false,
  });
  const checks = [
    buildDoctorCheck(doctor, strict),
    buildCommandCatalogCheck(snapshot),
    buildPackageScriptsCheck(snapshot),
    buildRequiredTestsCheck(snapshot),
    buildHooksCheck(snapshot),
    buildAutomationFilesCheck(snapshot),
    buildCiWorkflowCheck(snapshot),
    buildBaselineCheck({
      drift,
      baselinePresent: Boolean(baseline),
      baselinePath,
      strict,
      requireBaseline: input.requireBaseline === true,
    }),
  ];
  const failed = checks.filter((check) => check.status === 'fail').length;
  const attention = checks.filter((check) => check.status === 'attention').length;
  const status: ContinuousSecurityMonitorStatus =
    failed > 0 ? 'blocked' : attention > 0 ? 'attention' : 'healthy';
  const ok = failed === 0 && (!strict || attention === 0);
  const recommendations = Array.from(new Set(
    checks
      .filter((check) => check.status !== 'pass' && check.recommendation)
      .map((check) => check.recommendation as string),
  ));

  return {
    generatedAt,
    ok,
    strict,
    status,
    baselinePath,
    baselinePresent: Boolean(baseline),
    summary: {
      total: checks.length,
      passed: checks.filter((check) => check.status === 'pass').length,
      attention,
      failed,
      drift: drift.length,
    },
    doctor: {
      ok: doctor.ok,
      status: doctor.status,
      summary: doctor.summary,
      profile: doctor.profile,
      narrative: doctor.narrative,
    },
    snapshot,
    drift,
    checks,
    recommendations,
    narrative: {
      headline: status === 'healthy'
        ? 'Seguranca continua saudavel.'
        : status === 'blocked'
          ? 'Seguranca continua bloqueada por drift ou risco operacional.'
          : 'Seguranca continua ativa com pontos de atencao.',
      operatorSummary: buildOperatorSummary(status, doctor, drift, Boolean(baseline)),
    },
  };
}

export function writeContinuousSecurityBaseline(input: ContinuousSecurityMonitorInput = {}): ContinuousSecurityBaseline {
  const projectRoot = path.resolve(input.projectRoot || process.cwd());
  const now = input.now || (() => new Date());
  const baselinePath = path.resolve(input.baselinePath || path.join(projectRoot, 'config', 'security-continuous-baseline.json'));
  const snapshot = buildContinuousSecuritySnapshot({
    projectRoot,
    generatedAt: now().toISOString(),
  });
  const baseline: ContinuousSecurityBaseline = {
    version: 1,
    updatedAt: now().toISOString(),
    snapshot: stripGeneratedAt(snapshot),
  };
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
  return baseline;
}

export function formatContinuousSecurityMonitorReport(report: ContinuousSecurityMonitorReport): string {
  const statusLabel = report.status === 'healthy'
    ? 'saudavel'
    : report.status === 'blocked'
      ? 'bloqueado'
      : 'atencao';
  const lines = [
    '[zavorth-security] continuous security monitor',
    `[zavorth-security] status: ${statusLabel} | baseline: ${report.baselinePresent ? 'presente' : 'ausente'} | drift: ${report.summary.drift}`,
    `[zavorth-security] checks: ${report.summary.passed} ok, ${report.summary.attention} atencao, ${report.summary.failed} falha`,
    `[zavorth-security] doctor: ${report.doctor.status} | perfil: ${report.doctor.profile.label} (${report.doctor.profile.source})`,
    '',
    ...report.checks.map((check) =>
      `[${check.status}] ${check.id}: ${check.summary}${check.recommendation ? ` Recomendacao: ${check.recommendation}` : ''}`,
    ),
  ];

  if (report.drift.length > 0) {
    lines.push('', 'Drift detectado');
    for (const entry of report.drift.slice(0, 12)) {
      lines.push(`- [${entry.severity}] ${entry.id}: ${entry.summary}`);
    }
  }

  if (report.recommendations.length > 0) {
    lines.push('', 'Proximos passos');
    for (const recommendation of report.recommendations.slice(0, 6)) {
      lines.push(`- ${recommendation}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function buildContinuousSecuritySnapshot(input: {
  projectRoot: string;
  generatedAt: string;
}): ContinuousSecuritySnapshot {
  return {
    generatedAt: input.generatedAt,
    controls: REQUIRED_SECURITY_CONTROL_FILES.map((modulePath) =>
      fingerprintFirstExisting(input.projectRoot, [
        path.join('src', `${modulePath}.ts`),
        path.join('dist', `${modulePath}.js`),
      ], modulePath),
    ),
    commandCatalog: fingerprintCommandCatalog(input.projectRoot),
    packageScripts: fingerprintPackageScripts(input.projectRoot),
    requiredTests: REQUIRED_SECURITY_TESTS.map((testPath) =>
      fingerprintFile(input.projectRoot, testPath, testPath),
    ),
    hooks: REQUIRED_HOOK_FILES.map((hookPath) =>
      fingerprintFile(input.projectRoot, hookPath, hookPath),
    ),
    automationFiles: REQUIRED_AUTOMATION_FILES.map((automationPath) =>
      fingerprintFile(input.projectRoot, automationPath, automationPath),
    ),
    ciWorkflow: fingerprintFile(input.projectRoot, '.github/workflows/security.yml', 'security-workflow'),
  };
}

function readContinuousSecurityBaseline(baselinePath: string): ContinuousSecurityBaseline | null {
  try {
    if (!fs.existsSync(baselinePath)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as ContinuousSecurityBaseline;
    return parsed.version === 1 && parsed.snapshot ? parsed : null;
  } catch {
    return null;
  }
}

function compareContinuousSecurityBaseline(
  baseline: ContinuousSecurityBaseline,
  snapshot: ContinuousSecuritySnapshot,
): ContinuousSecurityDrift[] {
  return [
    ...compareFileFingerprints('control', baseline.snapshot.controls, snapshot.controls),
    ...compareCommands('command', baseline.snapshot.commandCatalog, snapshot.commandCatalog),
    ...compareCommands('package-script', baseline.snapshot.packageScripts, snapshot.packageScripts),
    ...compareFileFingerprints('test', baseline.snapshot.requiredTests, snapshot.requiredTests),
    ...compareFileFingerprints('hook', baseline.snapshot.hooks, snapshot.hooks),
    ...compareFileFingerprints('automation', baseline.snapshot.automationFiles || [], snapshot.automationFiles),
    ...compareFileFingerprints('workflow', [baseline.snapshot.ciWorkflow], [snapshot.ciWorkflow]),
  ];
}

function compareFileFingerprints(
  prefix: string,
  expected: ContinuousSecurityFileFingerprint[],
  actual: ContinuousSecurityFileFingerprint[],
): ContinuousSecurityDrift[] {
  const actualById = new Map(actual.map((entry) => [entry.id, entry]));
  const drift: ContinuousSecurityDrift[] = [];
  for (const expectedEntry of expected) {
    const actualEntry = actualById.get(expectedEntry.id);
    if (!actualEntry || !actualEntry.present) {
      drift.push({
        id: `${prefix}:${expectedEntry.id}`,
        severity: 'critical',
        summary: 'Arquivo de seguranca esperado desapareceu.',
        expected: expectedEntry.relativePath,
        actual: null,
      });
      continue;
    }
    if (expectedEntry.sha256 !== actualEntry.sha256) {
      drift.push({
        id: `${prefix}:${expectedEntry.id}`,
        severity: 'warn',
        summary: 'Fingerprint mudou desde a baseline aprovada.',
        expected: expectedEntry.sha256,
        actual: actualEntry.sha256,
      });
    }
  }
  return drift;
}

function compareCommands(
  prefix: string,
  expected: ContinuousSecurityCommandFingerprint[],
  actual: ContinuousSecurityCommandFingerprint[],
): ContinuousSecurityDrift[] {
  const actualById = new Map(actual.map((entry) => [entry.id, entry]));
  const drift: ContinuousSecurityDrift[] = [];
  for (const expectedEntry of expected) {
    const actualEntry = actualById.get(expectedEntry.id);
    if (!actualEntry || !actualEntry.present) {
      drift.push({
        id: `${prefix}:${expectedEntry.id}`,
        severity: 'critical',
        summary: 'Comando de seguranca esperado desapareceu.',
        expected: expectedEntry.command,
        actual: null,
      });
      continue;
    }
    if (expectedEntry.command !== actualEntry.command) {
      drift.push({
        id: `${prefix}:${expectedEntry.id}`,
        severity: 'warn',
        summary: 'Comando de seguranca mudou desde a baseline aprovada.',
        expected: expectedEntry.command,
        actual: actualEntry.command,
      });
    }
  }
  return drift;
}

function buildDoctorCheck(
  doctor: OperationalSecurityDoctorReport,
  strict: boolean,
): ContinuousSecurityMonitorCheck {
  const lowFrictionAttention = isLowFrictionDoctorAttention(doctor);
  if (!doctor.ok) {
    return {
      id: 'operational-security-doctor',
      status: 'fail',
      severity: 'critical',
      summary: doctor.narrative.operatorSummary,
      evidence: [`status=${doctor.status}`, `failed=${doctor.summary.failed}`, `attention=${doctor.summary.attention}`],
      recommendation: 'Rode zavorth doctor security para corrigir a postura operacional antes de continuar.',
    };
  }
  if (lowFrictionAttention) {
    return {
      id: 'operational-security-doctor',
      status: 'pass',
      severity: 'info',
      summary: doctor.narrative.operatorSummary,
      evidence: ['approval-signing-key=ready-on-demand'],
      recommendation: null,
    };
  }
  if (strict && doctor.summary.attention > 0) {
    return {
      id: 'operational-security-doctor',
      status: 'fail',
      severity: 'warn',
      summary: 'Doctor operacional tem pontos de atencao em modo estrito.',
      evidence: [`attention=${doctor.summary.attention}`],
      recommendation: 'Resolva os pontos de atencao ou rode o monitor sem --strict para uso diario.',
    };
  }
  return {
    id: 'operational-security-doctor',
    status: doctor.summary.attention > 0 ? 'attention' : 'pass',
    severity: doctor.summary.attention > 0 ? 'warn' : 'info',
    summary: doctor.narrative.operatorSummary,
    evidence: buildDoctorEvidence(doctor),
    recommendation: doctor.summary.attention > 0 ? 'Revise zavorth doctor security quando for conveniente.' : null,
  };
}

function buildDoctorEvidence(doctor: OperationalSecurityDoctorReport): string[] {
  const evidence = [`status=${doctor.status}`];
  const approvalCheck = doctor.checks.find((check) => check.id === 'approval-signing-key');
  if (approvalCheck?.evidence.some((entry) => entry.includes('auto-create-on-first-approval=true'))) {
    evidence.push('approval-signing-key=ready-on-demand');
  }
  return evidence;
}

function buildCommandCatalogCheck(snapshot: ContinuousSecuritySnapshot): ContinuousSecurityMonitorCheck {
  const missing = snapshot.commandCatalog.filter((entry) => !entry.present);
  return simplePresenceCheck({
    id: 'security-command-catalog',
    okSummary: 'Comandos security:doctor, security:continuous, security:baseline e presets estao catalogados.',
    missing,
    recommendation: 'Restaure os comandos de seguranca continua e presets no scripts/command-catalog.json.',
  });
}

function buildPackageScriptsCheck(snapshot: ContinuousSecuritySnapshot): ContinuousSecurityMonitorCheck {
  const missing = snapshot.packageScripts.filter((entry) => !entry.present);
  return simplePresenceCheck({
    id: 'security-package-scripts',
    okSummary: 'Scripts canonicos de security CI/precommit/prepush estao presentes.',
    missing,
    recommendation: 'Restaure security:ci, security:precommit e security:prepush no package.json.',
  });
}

function buildRequiredTestsCheck(snapshot: ContinuousSecuritySnapshot): ContinuousSecurityMonitorCheck {
  const missing = snapshot.requiredTests.filter((entry) => !entry.present);
  return simplePresenceCheck({
    id: 'security-regression-tests',
    okSummary: 'Regressoes obrigatorias de seguranca continua estao presentes.',
    missing,
    recommendation: 'Restaure os testes de seguranca antes de aceitar mudancas nos controles.',
  });
}

function buildHooksCheck(snapshot: ContinuousSecuritySnapshot): ContinuousSecurityMonitorCheck {
  const missing = snapshot.hooks.filter((entry) => !entry.present);
  return simplePresenceCheck({
    id: 'security-git-hooks',
    okSummary: 'Hooks locais de pre-commit e pre-push estao disponiveis.',
    missing,
    recommendation: 'Rode npm run security:hooks:install para habilitar os hooks locais.',
  });
}

function buildAutomationFilesCheck(snapshot: ContinuousSecuritySnapshot): ContinuousSecurityMonitorCheck {
  const missing = snapshot.automationFiles.filter((entry) => !entry.present);
  return simplePresenceCheck({
    id: 'security-automation-files',
    okSummary: 'Scripts de automacao continua de seguranca estao presentes.',
    missing,
    recommendation: 'Restaure scripts/security-ci-check.mjs, scripts/security-continuous.ts, scripts/security-doctor.ts e scripts/security-preset.ts.',
  });
}

function buildCiWorkflowCheck(snapshot: ContinuousSecuritySnapshot): ContinuousSecurityMonitorCheck {
  if (!snapshot.ciWorkflow.present) {
    return {
      id: 'security-ci-workflow',
      status: 'fail',
      severity: 'critical',
      summary: 'Workflow de seguranca do GitHub Actions nao foi encontrado.',
      evidence: ['.github/workflows/security.yml missing'],
      recommendation: 'Restaure .github/workflows/security.yml para manter verificacao hospedada.',
    };
  }
  return {
    id: 'security-ci-workflow',
    status: 'pass',
    severity: 'info',
    summary: 'Workflow hospedado de seguranca esta presente.',
    evidence: ['.github/workflows/security.yml'],
    recommendation: null,
  };
}

function buildBaselineCheck(input: {
  drift: ContinuousSecurityDrift[];
  baselinePresent: boolean;
  baselinePath: string;
  strict: boolean;
  requireBaseline: boolean;
}): ContinuousSecurityMonitorCheck {
  if (!input.baselinePresent) {
    return {
      id: 'security-baseline',
      status: input.requireBaseline ? 'fail' : 'attention',
      severity: input.requireBaseline ? 'critical' : 'warn',
      summary: 'Baseline de seguranca continua ainda nao existe.',
      evidence: [input.baselinePath],
      recommendation: 'Rode npm run command -- security:baseline para criar a baseline aprovada.',
    };
  }
  if (input.drift.length === 0) {
    return {
      id: 'security-baseline',
      status: 'pass',
      severity: 'info',
      summary: 'Baseline aprovada confere com os controles atuais.',
      evidence: [input.baselinePath],
      recommendation: null,
    };
  }
  const critical = input.drift.some((entry) => entry.severity === 'critical');
  return {
    id: 'security-baseline',
    status: critical || input.strict ? 'fail' : 'attention',
    severity: critical ? 'critical' : 'warn',
    summary: `${input.drift.length} drift(s) detectado(s) contra a baseline aprovada.`,
    evidence: input.drift.slice(0, 12).map((entry) => `${entry.id}: ${entry.summary}`),
    recommendation: 'Revise o drift; se for legitimo, rode npm run command -- security:baseline para aprovar a nova baseline.',
  };
}

function simplePresenceCheck(input: {
  id: string;
  okSummary: string;
  missing: Array<{ id: string }>;
  recommendation: string;
}): ContinuousSecurityMonitorCheck {
  if (input.missing.length > 0) {
    return {
      id: input.id,
      status: 'fail',
      severity: 'critical',
      summary: `${input.missing.length} item(ns) obrigatorio(s) ausente(s).`,
      evidence: input.missing.map((entry) => entry.id),
      recommendation: input.recommendation,
    };
  }
  return {
    id: input.id,
    status: 'pass',
    severity: 'info',
    summary: input.okSummary,
    evidence: [],
    recommendation: null,
  };
}

function fingerprintCommandCatalog(projectRoot: string): ContinuousSecurityCommandFingerprint[] {
  const catalog = readJson(path.join(projectRoot, 'scripts', 'command-catalog.json')) as {
    commands?: Record<string, { command?: string }>;
  } | null;
  return REQUIRED_COMMAND_CATALOG_ENTRIES.map((id) => ({
    id,
    command: catalog?.commands?.[id]?.command || null,
    present: Boolean(catalog?.commands?.[id]?.command),
  }));
}

function fingerprintPackageScripts(projectRoot: string): ContinuousSecurityCommandFingerprint[] {
  const packageJson = readJson(path.join(projectRoot, 'package.json')) as {
    scripts?: Record<string, string>;
  } | null;
  return REQUIRED_PACKAGE_SECURITY_SCRIPTS.map((id) => ({
    id,
    command: packageJson?.scripts?.[id] || null,
    present: Boolean(packageJson?.scripts?.[id]),
  }));
}

function fingerprintFirstExisting(
  projectRoot: string,
  relativePaths: string[],
  id: string,
): ContinuousSecurityFileFingerprint {
  const existing = relativePaths.find((relativePath) => fs.existsSync(path.join(projectRoot, relativePath)));
  return fingerprintFile(projectRoot, existing || relativePaths[0], id);
}

function fingerprintFile(
  projectRoot: string,
  relativePath: string,
  id: string,
): ContinuousSecurityFileFingerprint {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return {
      id,
      relativePath: relativePath.replace(/\\/g, '/'),
      sha256: null,
      present: false,
    };
  }
  return {
    id,
    relativePath: relativePath.replace(/\\/g, '/'),
    sha256: sha256File(absolutePath),
    present: true,
  };
}

function readJson(filePath: string): unknown {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function isLowFrictionDoctorAttention(doctor: OperationalSecurityDoctorReport): boolean {
  if (doctor.status !== 'attention' || doctor.summary.failed > 0 || doctor.summary.attention !== 1) {
    return false;
  }
  const attentionChecks = doctor.checks.filter((check) => check.status === 'attention');
  return attentionChecks.length === 1
    && attentionChecks[0].id === 'approval-signing-key'
    && /sera criada automaticamente|será criada automaticamente/i.test(attentionChecks[0].summary);
}

function sha256File(filePath: string): string {
  return sha256Text(fs.readFileSync(filePath, 'utf8'));
}

export function fingerprintContinuousSecurityText(value: string): string {
  return sha256Text(value);
}

function sha256Text(value: string): string {
  return createHash('sha256')
    .update(value.replace(/\r\n?/g, '\n'), 'utf8')
    .digest('hex');
}

function stripGeneratedAt(snapshot: ContinuousSecuritySnapshot): Omit<ContinuousSecuritySnapshot, 'generatedAt'> {
  return {
    controls: snapshot.controls,
    commandCatalog: snapshot.commandCatalog,
    packageScripts: snapshot.packageScripts,
    requiredTests: snapshot.requiredTests,
    hooks: snapshot.hooks,
    automationFiles: snapshot.automationFiles,
    ciWorkflow: snapshot.ciWorkflow,
  };
}

function buildOperatorSummary(
  status: ContinuousSecurityMonitorStatus,
  doctor: OperationalSecurityDoctorReport,
  drift: ContinuousSecurityDrift[],
  baselinePresent: boolean,
): string {
  if (status === 'healthy') {
    return 'Doctor operacional, baseline, hooks, CI e testes de seguranca continuam alinhados.';
  }
  if (!baselinePresent) {
    return 'Monitor continuo esta ativo, mas ainda precisa de uma baseline aprovada para detectar drift historico.';
  }
  if (drift.length > 0) {
    return `${drift.length} drift(s) detectado(s) nos controles monitorados; revise antes de liberar mudancas sensiveis.`;
  }
  return `Monitor continuo ativo; doctor operacional reportou status ${doctor.status}.`;
}
