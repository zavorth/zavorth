import fs from 'node:fs';
import path from 'node:path';
import type {
  ZavorthDataLifecycleDataset,
  ZavorthDataLifecycleSnapshot,
  ZavorthDataLifecycleValidationIssue,
} from '../contracts/ZavorthDataLifecycleContract.js';
import { ZAVORTH_DATA_LIFECYCLE_VERSION } from '../contracts/ZavorthDataLifecycleContract.js';

type ZavorthDataLifecyclePolicyRuntime = {
  now?: () => Date;
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
};

const DATASETS: ZavorthDataLifecycleDataset[] = [
  {
    id: 'app-logs',
    label: 'Logs de application e runtime',
    surface: 'logs',
    classification: 'sensitive',
    retentionMode: 'time-boxed',
    defaultRetentionDays: 14,
    exportMode: 'operator-command',
    deletionMode: 'operator-command',
    redaction: 'required',
    encryptionExpected: false,
    storageRoots: ['logs/', 'data/logs/', '.tmp/'],
    commands: {
      inspect: 'npm run security:doctor',
      export: 'npm run zavorth:data-lifecycle -- --class app-logs --dry-run',
      delete: 'zavorth retention apply --class app-logs --confirm',
    },
    evidence: [
      'src/ai-gateway/lib/logExportRedaction.ts',
      'src/core/MinimalRuntimeRetentionService.ts',
    ],
    residualRisk: 'Logs may contain operational metadata; export must pass through redaction.',
  },
  {
    id: 'media-cache',
    label: 'Cache de media',
    surface: 'media',
    classification: 'user-content',
    retentionMode: 'time-boxed',
    defaultRetentionDays: 30,
    exportMode: 'operator-command',
    deletionMode: 'operator-command',
    redaction: 'recommended',
    encryptionExpected: false,
    storageRoots: ['data/media/', 'tmp/media/', '.tmp/media/'],
    commands: {
      inspect: 'zavorth retention report --class media-cache',
      export: 'npm run zavorth:data-lifecycle -- --class media-cache --dry-run',
      delete: 'zavorth retention apply --class media-cache --confirm',
    },
    evidence: [
      'src/telegram/StorageMaintenance.ts',
      'src/core/MinimalRuntimeArtifactRetentionCatalog.ts',
    ],
    residualRisk: 'Media files may include personal documents; they expire by time and size.',
  },
  {
    id: 'transcriptions',
    label: 'Transcriptions and video/audio context',
    surface: 'transcriptions',
    classification: 'user-content',
    retentionMode: 'time-boxed',
    defaultRetentionDays: 30,
    exportMode: 'operator-command',
    deletionMode: 'operator-command',
    redaction: 'required',
    encryptionExpected: false,
    storageRoots: ['data/video-context/', 'memory/video-context/'],
    commands: {
      inspect: 'zavorth retention report --class transcriptions',
      export: 'npm run zavorth:data-lifecycle -- --class transcriptions --dry-run',
      delete: 'zavorth retention apply --class transcriptions --confirm',
    },
    evidence: [
      'src/config/sections/runtimePathConfig.ts',
      'src/telegram/StorageMaintenance.ts',
    ],
    residualRisk: 'Transcriptions may contain private speech; keep retention short and use redaction on export.',
  },
  {
    id: 'db-backups',
    label: 'Backups e snapshots de banco',
    surface: 'backups',
    classification: 'sensitive',
    retentionMode: 'time-boxed',
    defaultRetentionDays: 7,
    exportMode: 'manual-reviewed',
    deletionMode: 'operator-command',
    redaction: 'required',
    encryptionExpected: true,
    storageRoots: ['data/backups/', 'backups/'],
    commands: {
      inspect: 'npm run security:doctor',
      export: 'npm run zavorth:data-lifecycle -- --class db-backups --dry-run',
      delete: 'zavorth backup prune --confirm',
    },
    evidence: [
      'src/ai-gateway/lib/db/backupSanitizer.ts',
      'src/config/sections/runtimePathConfig.ts',
    ],
    residualRisk: 'Backups concentrate historical data; export requires review and sanitization.',
  },
  {
    id: 'provider-cache',
    label: 'Cache de providers e respostas intermediarias',
    surface: 'cache',
    classification: 'secret-adjacent',
    retentionMode: 'time-boxed',
    defaultRetentionDays: 7,
    exportMode: 'operator-command',
    deletionMode: 'operator-command',
    redaction: 'required',
    encryptionExpected: false,
    storageRoots: ['data/cache/', '.zavorth/cache/', '.tmp/provider-cache/'],
    commands: {
      inspect: 'npm run security:continuous',
      export: 'npm run zavorth:data-lifecycle -- --class provider-cache --dry-run',
      delete: 'zavorth retention apply --class provider-cache --confirm',
    },
    evidence: [
      'src/security/SensitiveDataGuard.ts',
      'src/core/MinimalRuntimeArtifactRetentionCatalog.ts',
    ],
    residualRisk: 'Cache can approximate prompts, tool outputs, and provider metadata; never export raw secrets.',
  },
  {
    id: 'attachments',
    label: 'Attachments sent through channels',
    surface: 'attachments',
    classification: 'user-content',
    retentionMode: 'time-boxed',
    defaultRetentionDays: 30,
    exportMode: 'self-service',
    deletionMode: 'operator-command',
    redaction: 'recommended',
    encryptionExpected: false,
    storageRoots: ['data/attachments/', 'uploads/', '.tmp/attachments/'],
    commands: {
      inspect: 'zavorth retention report --class attachments',
      export: 'npm run zavorth:data-lifecycle -- --class attachments --dry-run',
      delete: 'zavorth retention apply --class attachments --confirm',
    },
    evidence: [
      'src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.ts',
      'src/core/MinimalRuntimeArtifactRetentionCatalog.ts',
    ],
    residualRisk: 'Attachments may contain personal data or secrets; preview/export must use guardrails.',
  },
  {
    id: 'session-history',
    label: 'Session, run, and message history',
    surface: 'history',
    classification: 'sensitive',
    retentionMode: 'time-boxed',
    defaultRetentionDays: 30,
    exportMode: 'self-service',
    deletionMode: 'operator-command',
    redaction: 'required',
    encryptionExpected: false,
    storageRoots: ['memory/', 'data/sessions/', 'data/runs/'],
    commands: {
      inspect: 'zavorth retention report --class session-history',
      export: 'npm run zavorth:data-lifecycle -- --class session-history --dry-run',
      delete: 'zavorth retention apply --class session-history --confirm',
    },
    evidence: [
      'src/core/MinimalRuntimeRetentionService.ts',
      'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts',
    ],
    residualRisk: 'Conversation history may contain instructions, files, and personal data.',
  },
  {
    id: 'telemetry-ledger',
    label: 'Telemetry, audit, and receipts',
    surface: 'telemetry',
    classification: 'internal',
    retentionMode: 'operator-reviewed',
    defaultRetentionDays: 90,
    exportMode: 'manual-reviewed',
    deletionMode: 'manual-reviewed',
    redaction: 'required',
    encryptionExpected: false,
    storageRoots: ['data/audit/', 'data/telemetry/', '.zavorth/ledger/'],
    commands: {
      inspect: 'npm run security:continuous',
      export: 'npm run zavorth:data-lifecycle -- --class telemetry-ledger --dry-run',
      delete: 'zavorth audit prune --confirm',
    },
    evidence: [
      'src/services/ZavorthTelemetryLedgerService.ts',
      'src/security/SensitiveDataGuard.ts',
    ],
    residualRisk: 'Receipts help audit; deletion requires balance between privacy and traceability.',
  },
  {
    id: 'approval-receipts',
    label: 'Approvals, policies e recibos assinados',
    surface: 'approvals',
    classification: 'sensitive',
    retentionMode: 'operator-reviewed',
    defaultRetentionDays: 180,
    exportMode: 'manual-reviewed',
    deletionMode: 'manual-reviewed',
    redaction: 'required',
    encryptionExpected: true,
    storageRoots: ['data/approvals/', '.zavorth/approvals/'],
    commands: {
      inspect: 'npm run zavorth:maturity',
      export: 'npm run zavorth:data-lifecycle -- --class approval-receipts --dry-run',
      delete: 'zavorth approvals prune --confirm',
    },
    evidence: [
      'src/services/ZavorthMaturityService.ts',
      'src/security/SensitiveDataGuard.ts',
    ],
    residualRisk: 'Receipts can prove consent; removal must be governed and logged.',
  },
  {
    id: 'skill-cache',
    label: 'Skills, manifests importados e cache de capabilitys',
    surface: 'skills',
    classification: 'internal',
    retentionMode: 'until-user-delete',
    defaultRetentionDays: null,
    exportMode: 'self-service',
    deletionMode: 'operator-command',
    redaction: 'recommended',
    encryptionExpected: false,
    storageRoots: ['skill-library/', '.agents/skills/', '.codex/skills/'],
    commands: {
      inspect: 'npm run capability-hub',
      export: 'npm run zavorth:data-lifecycle -- --class skill-cache --dry-run',
      delete: 'zavorth skills remove --confirm',
    },
    evidence: [
      'src/services/ZavorthSkillEcosystemImporterService.ts',
      'src/services/ZavorthSkillPermissionProfileService.ts',
    ],
    residualRisk: 'Skills can expand capabilities; keep origin, permission, and removal clear.',
  },
];

export class ZavorthDataLifecyclePolicyService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly existsSync: typeof fs.existsSync;

  public constructor(runtime: ZavorthDataLifecyclePolicyRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
  }

  public buildSnapshot(input: { datasetId?: string | null } = {}): ZavorthDataLifecycleSnapshot {
    const selected = String(input.datasetId || '').trim();
    const datasets = selected
      ? DATASETS.filter((dataset) => dataset.id === selected)
      : DATASETS.slice();
    const issues = this.validate(DATASETS);
    const releaseReady = issues.length === 0;
    const summary = {
      total: DATASETS.length,
      covered: DATASETS.length - new Set(issues.map((issue) => issue.datasetId)).size,
      exportable: DATASETS.filter((dataset) => dataset.exportMode !== 'not-stored').length,
      deletable: DATASETS.filter((dataset) => dataset.deletionMode !== 'not-stored').length,
      redactionCovered: DATASETS.filter((dataset) => dataset.redaction !== 'not-needed').length,
      releaseReady,
    };

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_DATA_LIFECYCLE_VERSION,
      summary,
      datasets,
      issues,
      defaults: {
        dryRunByDefault: true,
        destructiveDeleteRequiresExplicitFlag: true,
        rawSecretExportAllowed: false,
        userContentNeedsLifecycle: true,
      },
      commands: {
        report: 'npm run zavorth:data-lifecycle',
        json: 'npm run zavorth:data-lifecycle:json',
        check: 'npm run zavorth:data-lifecycle:check',
        dryRunDelete: 'npm run zavorth:data-lifecycle -- --dry-run',
        nextStep: releaseReady ? 'Manter todo novo armazenamento registrado nesta matriz before do merge.'
          : `Corrigir ${issues[0]?.datasetId || 'dataset'}: ${issues[0]?.message || 'lifecycle incompleto'}.`,
      },
      narrative: {
        headline: 'Politica operational de ciclo de vida de dados do Zavorth',
        operatorSummary:
          `${summary.covered}/${summary.total} dataset(s) cobertos; export=${summary.exportable}, `
          + `delete=${summary.deletable}, redaction=${summary.redactionCovered}.`,
      },
    };
  }

  public renderReport(snapshot: ZavorthDataLifecycleSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Data Lifecycle Policy',
      `Status: ${snapshot.summary.releaseReady ? 'release-ready' : 'blocked'}`,
      snapshot.narrative.operatorSummary,
      '',
      'Datasets:',
      ...snapshot.datasets.map((dataset) =>
        `- ${dataset.label}: retention=${dataset.defaultRetentionDays ?? 'until-delete'}d `
        + `export=${dataset.exportMode} delete=${dataset.deletionMode}`),
      '',
      `Next: ${snapshot.commands.nextStep}`,
    ].join('\n');
  }

  private validate(datasets: ZavorthDataLifecycleDataset[]): ZavorthDataLifecycleValidationIssue[] {
    const issues: ZavorthDataLifecycleValidationIssue[] = [];
    const ids = new Set<string>();
    for (const dataset of datasets) {
      if (ids.has(dataset.id)) {
        issues.push(this.issue(dataset.id, 'id', 'dataset duplicado'));
      }
      ids.add(dataset.id);
      if (dataset.retentionMode !== 'until-user-delete' && dataset.defaultRetentionDays === null) {
        issues.push(this.issue(dataset.id, 'defaultRetentionDays', 'retention needs duration or until-user-delete'));
      }
      if (dataset.exportMode === 'not-stored' && dataset.deletionMode !== 'not-stored') {
        issues.push(this.issue(dataset.id, 'deletionMode', 'not-stored dataset should not have separate delete'));
      }
      if (dataset.redaction === 'not-needed' && dataset.classification !== 'public') {
        issues.push(this.issue(dataset.id, 'redaction', 'non-public data needs redaction or recommendation'));
      }
      if (!dataset.commands.inspect || !dataset.commands.export || !dataset.commands.delete) {
        issues.push(this.issue(dataset.id, 'commands', 'inspect/export/delete must be defined'));
      }
      if (dataset.evidence.length === 0) {
        issues.push(this.issue(dataset.id, 'evidence', 'dataset needs technical evidence'));
      }
      if (!dataset.evidence.some((entry) => this.existsSync(path.resolve(this.projectRoot, entry)))) {
        issues.push(this.issue(dataset.id, 'evidence', 'no evidence exists in the current workspace'));
      }
    }
    return issues;
  }

  private issue(datasetId: string, field: string, message: string): ZavorthDataLifecycleValidationIssue {
    return { datasetId, field, message };
  }
}

export { DATASETS as ZAVORTH_DATA_LIFECYCLE_DATASETS };
