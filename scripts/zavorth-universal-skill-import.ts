import path from 'path';
import { UniversalSkillTrustImportService } from '../src/skills/UniversalSkillTrustImportService.js';

type CliOptions = {
  sourcePath: string;
  sourceKind: 'auto' | 'directory' | 'zip';
  targetRootPath: string | null;
  json: boolean;
  apply: boolean;
  overwrite: boolean;
  allowSource: boolean;
  allowAllCandidates: boolean;
  allowedSkillNames: string[];
  allowedSkillIds: string[];
  requirePass: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    sourcePath: path.resolve('skill-library'),
    sourceKind: 'auto',
    targetRootPath: null,
    json: false,
    apply: false,
    overwrite: false,
    allowSource: false,
    allowAllCandidates: false,
    allowedSkillNames: [],
    allowedSkillIds: [],
    requirePass: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source' || arg === '--path') {
      options.sourcePath = path.resolve(String(argv[index + 1] || '').trim() || options.sourcePath);
      index += 1;
      continue;
    }
    if (arg === '--kind') {
      const value = String(argv[index + 1] || '').trim();
      if (value === 'directory' || value === 'zip' || value === 'auto') {
        options.sourceKind = value;
      }
      index += 1;
      continue;
    }
    if (arg === '--target') {
      options.targetRootPath = path.resolve(String(argv[index + 1] || '').trim());
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
    if (arg === '--json') {
      options.json = true;
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
    if (arg === '--require-pass' || arg === '--gate') {
      options.requirePass = true;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new UniversalSkillTrustImportService();
  const snapshot = await service.buildSnapshot({
    sourcePath: options.sourcePath,
    sourceKind: options.sourceKind,
    targetRootPath: options.targetRootPath || undefined,
    apply: options.apply,
    overwrite: options.overwrite,
    allowSource: options.allowSource,
    allowAllCandidates: options.allowAllCandidates,
    allowedSkillNames: options.allowedSkillNames,
    allowedSkillIds: options.allowedSkillIds,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'passed') {
    process.exitCode = 1;
  }
}

function splitList(value: string | undefined): string[] {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

main().catch((error) => {
  console.error(`[universal-skill-import] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
