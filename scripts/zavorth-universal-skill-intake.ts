import path from 'path';
import { UniversalSkillIntakeService } from '../src/skills/UniversalSkillIntakeService.js';

type CliOptions = {
  sourcePath: string;
  sourceKind: 'auto' | 'directory' | 'zip';
  json: boolean;
  requirePass: boolean;
  maxFiles: number | null;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    sourcePath: path.resolve('skill-library'),
    sourceKind: 'auto',
    json: false,
    requirePass: false,
    maxFiles: null,
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
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--max-files') {
      const value = Number(argv[index + 1]);
      options.maxFiles = Number.isFinite(value) && value > 0 ? Math.floor(value) : options.maxFiles;
      index += 1;
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
  const service = new UniversalSkillIntakeService();
  const preview = await service.previewSource({
    sourcePath: options.sourcePath,
    sourceKind: options.sourceKind,
    maxFiles: options.maxFiles || undefined,
  });

  if (options.json) {
    console.log(JSON.stringify(preview, null, 2));
  } else {
    console.log(service.formatPreviewText(preview));
  }

  if (options.requirePass && preview.status !== 'pass') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[universal-skill-intake] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
