#!/usr/bin/env tsx
import fs from 'fs';
import { ZavorthLargeSkillAbsorptionService } from '../src/services/ZavorthLargeSkillAbsorptionService.js';
import type { ZavorthLargeSkillAbsorptionSourceInput } from '../src/contracts/ZavorthLargeSkillAbsorptionContract.js';

type Args = {
  json: boolean;
  projectRoot: string | null;
  sources: ZavorthLargeSkillAbsorptionSourceInput[];
  sourcesFile: string | null;
  maxSources: number | null;
  maxCandidates: number | null;
  maxCandidatesPerBatch: number | null;
  maxPromptCharsPerChunk: number | null;
  maxArchiveBytes: number | null;
  maxFileBytes: number | null;
  maxFiles: number | null;
  securityProfile: string | null;
};

const args = parseArgs(process.argv.slice(2));
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const sources = [...args.sources, ...readSourcesFile(args.sourcesFile)];
  const service = new ZavorthLargeSkillAbsorptionService();
  const snapshot = await service.buildSnapshot({
    projectRoot: args.projectRoot,
    sources,
    maxSources: args.maxSources,
    maxCandidates: args.maxCandidates,
    maxCandidatesPerBatch: args.maxCandidatesPerBatch,
    maxPromptCharsPerChunk: args.maxPromptCharsPerChunk,
    maxArchiveBytes: args.maxArchiveBytes,
    maxFileBytes: args.maxFileBytes,
    maxFiles: args.maxFiles,
    securityProfile: args.securityProfile,
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
    projectRoot: null,
    sources: [],
    sourcesFile: null,
    maxSources: null,
    maxCandidates: null,
    maxCandidatesPerBatch: null,
    maxPromptCharsPerChunk: null,
    maxArchiveBytes: null,
    maxFileBytes: null,
    maxFiles: null,
    securityProfile: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--source') {
      out.sources.push({ sourcePath: argv[index + 1] || '' });
      index += 1;
      continue;
    }
    if (arg.startsWith('--source=')) {
      out.sources.push({ sourcePath: arg.slice('--source='.length) });
      continue;
    }
    if (arg === '--sources-file') {
      out.sourcesFile = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg.startsWith('--sources-file=')) {
      out.sourcesFile = arg.slice('--sources-file='.length);
      continue;
    }
    if (arg === '--project-root') {
      out.projectRoot = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg.startsWith('--project-root=')) {
      out.projectRoot = arg.slice('--project-root='.length);
      continue;
    }
    if (arg === '--max-sources') {
      out.maxSources = Number(argv[index + 1] || 0);
      index += 1;
      continue;
    }
    if (arg.startsWith('--max-sources=')) {
      out.maxSources = Number(arg.slice('--max-sources='.length));
      continue;
    }
    if (arg === '--max-candidates') {
      out.maxCandidates = Number(argv[index + 1] || 0);
      index += 1;
      continue;
    }
    if (arg.startsWith('--max-candidates=')) {
      out.maxCandidates = Number(arg.slice('--max-candidates='.length));
      continue;
    }
    if (arg === '--batch-size' || arg === '--max-candidates-per-batch') {
      out.maxCandidatesPerBatch = Number(argv[index + 1] || 0);
      index += 1;
      continue;
    }
    if (arg.startsWith('--batch-size=')) {
      out.maxCandidatesPerBatch = Number(arg.slice('--batch-size='.length));
      continue;
    }
    if (arg.startsWith('--max-candidates-per-batch=')) {
      out.maxCandidatesPerBatch = Number(arg.slice('--max-candidates-per-batch='.length));
      continue;
    }
    if (arg === '--max-chunk-chars') {
      out.maxPromptCharsPerChunk = Number(argv[index + 1] || 0);
      index += 1;
      continue;
    }
    if (arg.startsWith('--max-chunk-chars=')) {
      out.maxPromptCharsPerChunk = Number(arg.slice('--max-chunk-chars='.length));
      continue;
    }
    if (arg === '--max-files') {
      out.maxFiles = Number(argv[index + 1] || 0);
      index += 1;
      continue;
    }
    if (arg.startsWith('--max-files=')) {
      out.maxFiles = Number(arg.slice('--max-files='.length));
      continue;
    }
    if (arg === '--max-file-bytes') {
      out.maxFileBytes = Number(argv[index + 1] || 0);
      index += 1;
      continue;
    }
    if (arg.startsWith('--max-file-bytes=')) {
      out.maxFileBytes = Number(arg.slice('--max-file-bytes='.length));
      continue;
    }
    if (arg === '--max-archive-bytes') {
      out.maxArchiveBytes = Number(argv[index + 1] || 0);
      index += 1;
      continue;
    }
    if (arg.startsWith('--max-archive-bytes=')) {
      out.maxArchiveBytes = Number(arg.slice('--max-archive-bytes='.length));
      continue;
    }
    if (arg === '--security-profile') {
      out.securityProfile = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg.startsWith('--security-profile=')) {
      out.securityProfile = arg.slice('--security-profile='.length);
    }
  }

  return out;
}

function readSourcesFile(filePath: string | null): ZavorthLargeSkillAbsorptionSourceInput[] {
  if (!filePath) {
    return [];
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  const values = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { sources?: unknown[] }).sources)
      ? (parsed as { sources: unknown[] }).sources
      : [];
  return values.flatMap((entry) => {
    if (typeof entry === 'string') {
      return [{ sourcePath: entry }];
    }
    if (entry && typeof entry === 'object' && typeof (entry as { sourcePath?: unknown }).sourcePath === 'string') {
      return [entry as ZavorthLargeSkillAbsorptionSourceInput];
    }
    return [];
  });
}
