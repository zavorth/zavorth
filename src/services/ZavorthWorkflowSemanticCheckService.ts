import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';
import type {
ZavorthQaSecurityReleaseCheckStatus,
  ZavorthQaSecurityReleaseSeverity,
  ZavorthWorkflowSemanticReceipt,
  ZavorthWorkflowSemanticSnapshot,
} from '../contracts/ZavorthQaSecurityReleaseCertificationContract.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
  packageScripts?: Record<string, string>;
};

type WorkflowSemantic = {
  semanticId: string;
  label: string;
  scriptName: string;
  severity: ZavorthQaSecurityReleaseSeverity;
  target: string;
  notes: string[];
};

const WORKFLOW_SEMANTICS: WorkflowSemantic[] = [
  {
    semanticId: 'typecheck-before-release',
    label: 'Typecheck semantic is local',
    scriptName: 'runtime:check',
    severity: 'blocking',
    target: 'Workflow typecheck behavior is represented by a local package command.',
    notes: ['The pack records semantic intent and does not copy workflow YAML.'],
  },
  {
    semanticId: 'service-regression-before-release',
    label: 'Regression semantic is local',
    scriptName: 'test',
    severity: 'required',
    target: 'Workflow regression behavior is represented by a local package command.',
    notes: ['The command can be invoked in CI but this snapshot only certifies availability.'],
  },
  {
    semanticId: 'deterministic-qa-before-release',
    label: 'Deterministic QA semantic is local',
    scriptName: 'qa:deterministic',
    severity: 'required',
    target: 'Deterministic QA behavior is represented by a local package command.',
    notes: ['This keeps test semantics tied to Zavorth-owned checks.'],
  },
  {
    semanticId: 'release-hygiene-before-release',
    label: 'Release hygiene semantic is local',
    scriptName: 'release:scan',
    severity: 'required',
    target: 'Release hygiene workflow behavior is represented by a local package command.',
    notes: ['The command is suitable for local and optional CI invocation.'],
  },
  {
    semanticId: 'surface-controls-certification-before-release',
    label: 'Surface controls certification semantic is local',
    scriptName: 'zavorth-qa-security-release-certification-pack:check',
    severity: 'blocking',
    target: 'Surface controls certification behavior is represented by a local package command.',
    notes: ['The command is the canonical local replacement for copied workflow gates.'],
  },
  {
    semanticId: 'surface-controls-qa-before-release',
    label: 'Surface controls QA semantic is local',
    scriptName: 'qa:zavorth-qa-security-release-certification-pack',
    severity: 'required',
    target: 'Surface controls QA behavior is represented by a local package command.',
    notes: ['The QA command runs the focused tests plus the certification gate.'],
  },
];

export class ZavorthWorkflowSemanticCheckService {
  private readonly now: () => Date;
  private readonly rootDir: string;
  private readonly packageScripts: Record<string, string>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = path.resolve(runtime.rootDir || process.cwd());
    this.packageScripts = runtime.packageScripts || readPackageScripts(this.rootDir);
  }

  public buildSnapshot(): ZavorthWorkflowSemanticSnapshot {
    const receipts = WORKFLOW_SEMANTICS.map((semantic) => this.buildReceipt(semantic));
    return {
      status: combineStatuses(receipts.map((receipt) => receipt.status)),
      workflowFilesObserved: this.countWorkflowFiles(),
      semanticsChecked: receipts.length,
      receipts,
      rawWorkflowYamlCopied: false,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  private buildReceipt(semantic: WorkflowSemantic): ZavorthWorkflowSemanticReceipt {
    const hasScript = Boolean(this.packageScripts[semantic.scriptName]);
    const status = hasScript ? 'pass'
      : semantic.severity === 'blocking'
        ? 'fail'
        : 'warn';
    return {
      id: `zavorth.surface-controls.workflow.${semantic.semanticId}.${this.now().getTime()}.receipt`,
      familyId: 'workflow-semantics',
      checkId: semantic.semanticId,
      semanticId: semantic.semanticId,
      label: semantic.label,
      status,
      severity: semantic.severity,
      evidenceKind: 'workflow-semantic',
      target: semantic.target,
      observed: hasScript ? `script ${semantic.scriptName} is registered` : `script ${semantic.scriptName} is missing`,
      command: `npm run ${semantic.scriptName} --silent`,
      copiedWorkflowYaml: false,
      artifactFirst: true,
      localCheckPerformed: false,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
      rawWorkflowYamlCopied: false,
      dependencyPatchAcceptedSilently: false,
      notes: semantic.notes,
    };
  }

  private countWorkflowFiles(): number {
    const workflowsDir = path.join(this.rootDir, '.github', 'workflows');
    if (!fs.existsSync(workflowsDir)) {
      return 0;
    }
    return fs.readdirSync(workflowsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(ya?ml)$/i.test(entry.name))
      .length;
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
  } catch (error: unknown) {logger.warn('[Zavorth Workflow Semantic Check] JSON parse failed', error); return {}; }
}
