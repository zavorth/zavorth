import fs from 'fs';
import path from 'path';
import {
  UniversalSkillApprovedDashboardCanaryService,
  type UniversalSkillApprovedDashboardCanaryInput,
} from '../src/services/UniversalSkillApprovedDashboardCanaryService.js';
import type {
  ZavorthUniversalSkillExpansionPresetId,
  ZavorthUniversalSkillExpansionSourceInput,
} from '../src/contracts/ZavorthUniversalSkillExpansionContract.js';
import type { ZavorthUniversalSkillCanaryMode } from '../src/contracts/ZavorthUniversalSkillApprovedDashboardCanaryContract.js';

type CliOptions = UniversalSkillApprovedDashboardCanaryInput & {
  json: boolean;
  requirePass: boolean;
  sourcesFile: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    sources: [],
    projectRoot: null,
    targetRootPath: null,
    apply: false,
    overwrite: false,
    allowSource: false,
    allowAllCandidates: false,
    allowedSkillNames: [],
    allowedSkillIds: [],
    channel: null,
    maxSources: undefined,
    maxCandidates: undefined,
    persistReport: true,
    reportPath: null,
    discover: true,
    historyPath: null,
    persistHistory: true,
    maxHistoryEntries: undefined,
    batchSize: undefined,
    largeLibraryThreshold: undefined,
    massiveLibraryThreshold: undefined,
    persistScaleReport: true,
    scaleReportPath: null,
    approvedDashboardItemIds: null,
    selectedBatchId: null,
    canaryMode: 'dashboard-only',
    approvalId: null,
    persistCanaryReport: true,
    canaryReportPath: null,
    json: false,
    requirePass: false,
    sourcesFile: null,
  };
  let currentPreset: ZavorthUniversalSkillExpansionPresetId | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source' || arg === '--path') {
      const sourcePath = path.resolve(String(argv[index + 1] || '').trim() || '.');
      options.sources.push({ sourcePath, presetId: currentPreset || inferPresetFromPath(sourcePath) });
      index += 1;
      continue;
    }
    if (arg === '--sources-file') {
      options.sourcesFile = path.resolve(String(argv[index + 1] || '').trim());
      index += 1;
      continue;
    }
    if (arg === '--preset') {
      currentPreset = normalizePreset(argv[index + 1]);
      if (options.sources.length > 0) options.sources[options.sources.length - 1].presetId = currentPreset;
      index += 1;
      continue;
    }
    if (arg === '--kind') {
      const kind = normalizeKind(argv[index + 1]);
      if (options.sources.length > 0) options.sources[options.sources.length - 1].sourceKind = kind;
      index += 1;
      continue;
    }
    if (arg === '--label') {
      if (options.sources.length > 0) options.sources[options.sources.length - 1].sourceLabel = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--project-root') {
      options.projectRoot = path.resolve(String(argv[index + 1] || '').trim() || '.');
      index += 1;
      continue;
    }
    if (arg === '--target') {
      options.targetRootPath = path.resolve(String(argv[index + 1] || '').trim() || '.');
      index += 1;
      continue;
    }
    if (arg === '--skills') {
      options.allowedSkillNames = splitList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--skill-ids') {
      options.allowedSkillIds = splitList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--channel') {
      options.channel = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--max-sources') {
      options.maxSources = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--max-candidates') {
      options.maxCandidates = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--batch-size') {
      options.batchSize = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--large-threshold') {
      options.largeLibraryThreshold = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--massive-threshold') {
      options.massiveLibraryThreshold = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--batch') {
      options.selectedBatchId = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--canary') {
      options.canaryMode = normalizeCanaryMode(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--approval-id') {
      options.approvalId = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--dashboard-items') {
      options.approvedDashboardItemIds = splitList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--report') {
      options.reportPath = path.resolve(String(argv[index + 1] || '').trim() || 'universal-skill-expansion-qa.json');
      index += 1;
      continue;
    }
    if (arg === '--history') {
      options.historyPath = path.resolve(String(argv[index + 1] || '').trim() || 'universal-skill-real-source-onboarding-history.json');
      index += 1;
      continue;
    }
    if (arg === '--scale-report') {
      options.scaleReportPath = path.resolve(String(argv[index + 1] || '').trim() || 'universal-skill-scale-hardening.json');
      index += 1;
      continue;
    }
    if (arg === '--canary-report') {
      options.canaryReportPath = path.resolve(String(argv[index + 1] || '').trim() || 'universal-skill-approved-dashboard-canary.json');
      index += 1;
      continue;
    }
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--overwrite') {
      options.overwrite = true;
      continue;
    }
    if (arg === '--allow-source') {
      options.allowSource = true;
      continue;
    }
    if (arg === '--allow-all-candidates') {
      options.allowAllCandidates = true;
      continue;
    }
    if (arg === '--discover') {
      options.discover = true;
      continue;
    }
    if (arg === '--no-discover') {
      options.discover = false;
      continue;
    }
    if (arg === '--no-history') {
      options.persistHistory = false;
      continue;
    }
    if (arg === '--no-qa-report') {
      options.persistReport = false;
      continue;
    }
    if (arg === '--no-scale-report') {
      options.persistScaleReport = false;
      continue;
    }
    if (arg === '--no-canary-report') {
      options.persistCanaryReport = false;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--require-pass' || arg === '--gate') {
      options.requirePass = true;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const sources = [...options.sources, ...readSourcesFile(options.sourcesFile)];
  const originalLog = console.log;
  const originalWarn = console.warn;
  if (options.json) {
    console.log = () => undefined;
    console.warn = () => undefined;
  }

  const service = new UniversalSkillApprovedDashboardCanaryService({
    projectRoot: options.projectRoot || undefined,
  });
  const snapshot = await service.buildSnapshot({ ...options, sources });

  console.log = originalLog;
  console.warn = originalWarn;

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'passed') {
    process.exitCode = 1;
  }
}

function readSourcesFile(filePath: string | null): ZavorthUniversalSkillExpansionSourceInput[] {
  if (!filePath) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const sources = Array.isArray(parsed) ? parsed : parsed.sources;
  if (!Array.isArray(sources)) return [];
  return sources
    .map((source) => ({ ...source, sourcePath: path.resolve(String(source.sourcePath || source.path || '').trim()) }))
    .filter((source) => source.sourcePath);
}

function splitList(value: string | undefined): string[] {
  return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

function normalizeKind(value: string | undefined): 'auto' | 'directory' | 'zip' {
  return value === 'directory' || value === 'zip' || value === 'auto' ? value : 'auto';
}

function normalizePreset(value: string | undefined): ZavorthUniversalSkillExpansionPresetId {
  const normalized = String(value || '').trim();
  return normalized === 'workspace-skill-library'
    || normalized === 'downloaded-skill-archive'
    || normalized === 'codex-skill-root'
    || normalized === 'agent-skill-root'
    || normalized === 'generic-skill-folder'
    || normalized === 'custom'
    ? normalized
    : 'custom';
}

function normalizeCanaryMode(value: string | undefined): ZavorthUniversalSkillCanaryMode {
  return value === 'dry-run' || value === 'live' || value === 'dashboard-only' ? value : 'dashboard-only';
}

function inferPresetFromPath(sourcePath: string): ZavorthUniversalSkillExpansionPresetId {
  const normalized = sourcePath.toLowerCase();
  if (normalized.endsWith('.zip')) return 'downloaded-skill-archive';
  if (normalized.includes('.codex') || normalized.includes('codex')) return 'codex-skill-root';
  if (normalized.includes('.agents') || normalized.includes('agent')) return 'agent-skill-root';
  if (normalized.includes('skill-library')) return 'workspace-skill-library';
  return 'generic-skill-folder';
}

main().catch((error) => {
  console.error(`[universal-skill-approved-dashboard-canary] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
