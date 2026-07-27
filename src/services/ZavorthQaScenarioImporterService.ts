import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';
import type {
ZavorthQaScenarioCheck,
  ZavorthQaScenarioImporterSnapshot,
  ZavorthQaSecurityReleaseCheckStatus,
  ZavorthQaSecurityReleaseSeverity,
} from '../contracts/ZavorthQaSecurityReleaseCertificationContract.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
  packageScripts?: Record<string, string>;
};

type ScenarioSpec = {
  scenarioId: string;
  scenarioKind: ZavorthQaScenarioCheck['scenarioKind'];
  label: string;
  scriptName: string;
  severity: ZavorthQaSecurityReleaseSeverity;
  target: string;
  notes: string[];
};

const SCENARIOS: ScenarioSpec[] = [
  {
    scenarioId: 'runtime-contract-typecheck',
    scenarioKind: 'runtime',
    label: 'Runtime contract typecheck is available',
    scriptName: 'runtime:check',
    severity: 'blocking',
    target: 'TypeScript runtime contracts can be checked locally before release.',
    notes: ['Used as the minimum local certification gate for runtime API drift.'],
  },
  {
    scenarioId: 'focused-service-regression',
    scenarioKind: 'runtime',
    label: 'Focused service regression suite is available',
    scriptName: 'test',
    severity: 'required',
    target: 'Jest service tests can be invoked locally for focused regressions.',
    notes: ['The pack records the local test entrypoint without running the full suite by default.'],
  },
  {
    scenarioId: 'provider-runtime-gate',
    scenarioKind: 'provider',
    label: 'Provider runtime activation gate is available',
    scriptName: 'provider-runtime-activation:check',
    severity: 'required',
    target: 'Provider runtime activation is represented by a local check command.',
    notes: ['This remains a local gate and does not call provider APIs.'],
  },
  {
    scenarioId: 'channel-runtime-gate',
    scenarioKind: 'channel',
    label: 'Channel runtime activation gate is available',
    scriptName: 'channel-live-activation:check',
    severity: 'required',
    target: 'Channel activation behavior is represented by a local check command.',
    notes: ['This remains a local gate and does not send messages.'],
  },
  {
    scenarioId: 'memory-artifact-terminal-gate',
    scenarioKind: 'runtime',
    label: 'Memory artifact runtime closure gate is available',
    scriptName: 'memory-artifacts-runtime-live-closure:check',
    severity: 'required',
    target: 'Memory, artifact and runtime closure can be certified locally.',
    notes: ['This gives Surface controls a runnable gate for artifact-first runtime behavior.'],
  },
  {
    scenarioId: 'native-companion-device-gate',
    scenarioKind: 'device',
    label: 'Native companion device pack gate is available',
    scriptName: 'zavorth-native-companion-device-pack:check',
    severity: 'required',
    target: 'Runtime gateway companion device behavior remains runnable from the Surface controls pack.',
    notes: ['Native wrappers stay owner-gated while browser-first and desktop bridges are certified locally.'],
  },
  {
    scenarioId: 'release-hardening-gate',
    scenarioKind: 'release',
    label: 'Release hardening profile gate is available',
    scriptName: 'release-certification-hardening:check',
    severity: 'blocking',
    target: 'Release hardening checks can be run locally before handoff.',
    notes: ['Surface controls links release acceptance to an existing local release hardening gate.'],
  },
  {
    scenarioId: 'privacy-security-gate',
    scenarioKind: 'security',
    label: 'Privacy scan gate is available',
    scriptName: 'privacy:scan',
    severity: 'blocking',
    target: 'Privacy/security hygiene can be checked locally before release.',
    notes: ['The scan command is recorded as evidence and is not run implicitly.'],
  },
];

export class ZavorthQaScenarioImporterService {
  private readonly now: () => Date;
  private readonly rootDir: string;
  private readonly packageScripts: Record<string, string>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = path.resolve(runtime.rootDir || process.cwd());
    this.packageScripts = runtime.packageScripts || readPackageScripts(this.rootDir);
  }

  public buildSnapshot(): ZavorthQaScenarioImporterSnapshot {
    const receipts = SCENARIOS.map((scenario) => this.buildReceipt(scenario));
    const status = combineStatuses(receipts.map((receipt) => receipt.status));

    return {
      status,
      scenariosImported: receipts.length,
      receipts,
      qaDirectoriesDiscovered: this.discoverQaDirectories(),
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  private buildReceipt(scenario: ScenarioSpec): ZavorthQaScenarioCheck {
    const scriptValue = this.packageScripts[scenario.scriptName];
    const status = scriptValue ? 'pass'
      : scenario.severity === 'blocking'
        ? 'fail'
        : 'warn';
    const observed = scriptValue ? `script ${scenario.scriptName} is registered`
      : `script ${scenario.scriptName} is missing`;

    return {
      id: `zavorth.surface-controls.qa.${scenario.scenarioId}.${this.now().getTime()}.receipt`,
      familyId: 'qa-scenarios',
      checkId: scenario.scenarioId,
      scenarioId: scenario.scenarioId,
      scenarioKind: scenario.scenarioKind,
      label: scenario.label,
      status,
      severity: scenario.severity,
      evidenceKind: 'local-command',
      target: scenario.target,
      observed,
      command: `npm run ${scenario.scriptName} --silent`,
      artifactFirst: true,
      localCheckPerformed: false,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
      rawWorkflowYamlCopied: false,
      dependencyPatchAcceptedSilently: false,
      notes: scenario.notes,
    };
  }

  private discoverQaDirectories(): string[] {
    const qaRoot = path.join(this.rootDir, 'qa');
    if (!fs.existsSync(qaRoot)) {
      return [];
    }
    return fs.readdirSync(qaRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `qa/${entry.name}`)
      .sort();
  }
}

function combineStatuses(statuses: ZavorthQaSecurityReleaseCheckStatus[]): ZavorthQaSecurityReleaseCheckStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  return 'pass';
}

function readPackageScripts(rootDir: string): Record<string, string> {
  const packagePath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return {};
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, string> };
    return parsed.scripts || {};
  } catch (error: unknown) {logger.warn('[Zavorth Qa Scenario Importer] JSON parse failed', error); return {}; }
}
