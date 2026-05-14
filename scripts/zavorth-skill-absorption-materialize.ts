#!/usr/bin/env tsx
import fs from 'fs';
import { ZavorthSkillAbsorptionMaterializationService } from '../src/services/ZavorthSkillAbsorptionMaterializationService.js';
import type { ZavorthLargeSkillAbsorptionSourceInput } from '../src/contracts/ZavorthLargeSkillAbsorptionContract.js';

type Args = {
  json: boolean;
  sources: ZavorthLargeSkillAbsorptionSourceInput[];
  sourcesFile: string | null;
  targetRootPath: string | null;
  apply: boolean;
  overwrite: boolean;
  approvalId: string | null;
  allowedSourceIds: string[];
  allowedSkillNames: string[];
  allowAllSkills: boolean;
  includeReviewRequiredBatches: boolean;
  bridgeDryRun: boolean;
};

const args = parseArgs(process.argv.slice(2));
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const sources = [...args.sources, ...readSourcesFile(args.sourcesFile)];
  const service = new ZavorthSkillAbsorptionMaterializationService();
  const snapshot = await service.buildSnapshot({
    sources,
    targetRootPath: args.targetRootPath,
    apply: args.apply,
    overwrite: args.overwrite,
    approvalId: args.approvalId,
    allowedSourceIds: args.allowedSourceIds,
    allowedSkillNames: args.allowedSkillNames,
    allowAllSkills: args.allowAllSkills,
    includeReviewRequiredBatches: args.includeReviewRequiredBatches,
    bridgeDryRun: args.bridgeDryRun,
  });
  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }
  if (snapshot.status === 'blocked') {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    json: false,
    sources: [],
    sourcesFile: null,
    targetRootPath: null,
    apply: false,
    overwrite: false,
    approvalId: null,
    allowedSourceIds: [],
    allowedSkillNames: [],
    allowAllSkills: false,
    includeReviewRequiredBatches: false,
    bridgeDryRun: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--source') out.sources.push({ sourcePath: argv[++index] || '' });
    else if (arg.startsWith('--source=')) out.sources.push({ sourcePath: arg.slice('--source='.length) });
    else if (arg === '--sources-file') out.sourcesFile = argv[++index] || null;
    else if (arg.startsWith('--sources-file=')) out.sourcesFile = arg.slice('--sources-file='.length);
    else if (arg === '--target-root') out.targetRootPath = argv[++index] || null;
    else if (arg.startsWith('--target-root=')) out.targetRootPath = arg.slice('--target-root='.length);
    else if (arg === '--apply') out.apply = true;
    else if (arg === '--overwrite') out.overwrite = true;
    else if (arg === '--approval-id') out.approvalId = argv[++index] || null;
    else if (arg.startsWith('--approval-id=')) out.approvalId = arg.slice('--approval-id='.length);
    else if (arg === '--allow-source') out.allowedSourceIds.push('*');
    else if (arg === '--allowed-source') out.allowedSourceIds.push(argv[++index] || '');
    else if (arg.startsWith('--allowed-source=')) out.allowedSourceIds.push(arg.slice('--allowed-source='.length));
    else if (arg === '--skills') out.allowedSkillNames.push(...splitList(argv[++index] || ''));
    else if (arg.startsWith('--skills=')) out.allowedSkillNames.push(...splitList(arg.slice('--skills='.length)));
    else if (arg === '--allow-all-skills') out.allowAllSkills = true;
    else if (arg === '--include-review-required-batches') out.includeReviewRequiredBatches = true;
    else if (arg === '--no-bridge') out.bridgeDryRun = false;
  }
  return out;
}

function readSourcesFile(filePath: string | null): ZavorthLargeSkillAbsorptionSourceInput[] {
  if (!filePath) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  const values = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { sources?: unknown[] }).sources)
      ? (parsed as { sources: unknown[] }).sources
      : [];
  return values.flatMap((entry) => {
    if (typeof entry === 'string') return [{ sourcePath: entry }];
    if (entry && typeof entry === 'object' && typeof (entry as { sourcePath?: unknown }).sourcePath === 'string') {
      return [entry as ZavorthLargeSkillAbsorptionSourceInput];
    }
    return [];
  });
}

function splitList(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

