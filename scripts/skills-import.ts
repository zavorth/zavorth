import path from 'path';
import { config } from '../src/config/index.js';
import { SkillImportService } from '../src/skills/SkillImportService.js';
import { SkillTrustPolicyService } from '../src/services/SkillTrustPolicyService.js';

type CliOptions = {
  apply: boolean;
  overwrite: boolean;
  sourceId: string | null;
  sourceRootOverride: string | null;
  sourceSurface: 'skills' | 'skills_omni';
  skillNames: string[];
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    overwrite: false,
    sourceId: null,
    sourceRootOverride: null,
    sourceSurface: 'skills',
    skillNames: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--overwrite') {
      options.overwrite = true;
      continue;
    }
    if (arg === '--source-id') {
      options.sourceId = String(argv[index + 1] || '').trim() || null;
      index += 1;
      continue;
    }
    if (arg === '--source-root') {
      options.sourceRootOverride = String(argv[index + 1] || '').trim() || null;
      index += 1;
      continue;
    }
    if (arg === '--surface') {
      const value = String(argv[index + 1] || '').trim();
      if (value === 'skills' || value === 'skills_omni') {
        options.sourceSurface = value;
      }
      index += 1;
      continue;
    }
    if (arg === '--skills') {
      options.skillNames = String(argv[index + 1] || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      index += 1;
    }
  }

  return options;
}

function resolveAllowlistedSkills(sourceId: string): string[] {
  const trustPolicy = new SkillTrustPolicyService();
  const rule = trustPolicy.readPolicy().rules.find((entry) => entry.sourceId === sourceId);
  return rule?.mode === 'explicit' ? rule.skillNames.slice() : [];
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.sourceId) {
    throw new Error('Provide --source-id explicitly. External imports without declared source stay blocked.');
  }

  const skillNames = options.skillNames.length > 0
    ? options.skillNames
    : resolveAllowlistedSkills(options.sourceId);
  const importer = new SkillImportService();
  const preview = importer.previewImport({
    sourceId: options.sourceId,
    sourceRootOverride: options.sourceRootOverride,
    sourceSurface: options.sourceSurface,
    skillNames,
  });

  const lines = [
    'Zavorth Skill Import',
    '',
    `Source: ${preview.sourceLabel} (${preview.sourceId})`,
    `Source path: ${preview.sourcePath}`,
    `Target path: ${preview.targetRootPath}`,
    `Candidates: ${preview.totalCandidates}`,
    `Allowed: ${preview.allowedCount}`,
    `Blocked: ${preview.blockedCount}`,
    `Safe: ${preview.safeCount}`,
  ];

  for (const entry of preview.entries) {
    lines.push(
      '',
      `${entry.skillName}: ${entry.allowed ? 'ALLOW' : 'BLOCK'}`,
      `Reason: ${entry.reason}`,
      `License: ${entry.license || 'n/a'}`,
      `License policy: ${entry.licensePolicy.label} (${entry.licensePolicy.summary})`,
      `Risk: ${entry.risk.level} (${entry.risk.score})`,
      `Importable files: ${entry.importableFiles.length}`,
      ...(entry.issues.slice(0, 4).map((issue) => `Issue [${issue.severity}] ${issue.relativePath}: ${issue.message}`)),
    );
  }

  console.log(lines.join('\n'));
  if (preview.previewAudit?.lastEventId) {
    console.log(`\nPreview audit: ${preview.previewAudit.lastEventId}`);
  }

  if (!options.apply) {
    console.log('\nPreview only. Re-run with --apply to materialize the curated import.');
    return;
  }

  const result = importer.importAllowedSkills({
    sourceId: options.sourceId,
    sourceRootOverride: options.sourceRootOverride,
    sourceSurface: options.sourceSurface,
    skillNames,
    overwrite: options.overwrite,
  });

  console.log([
    '',
    'Import result',
    `Imported: ${result.importedCount}`,
    `Skipped: ${result.skippedCount}`,
    `Skills: ${result.importedSkillNames.join(', ') || 'none'}`,
    `Import audit: ${result.importAudit?.lastEventId || 'n/a'}`,
    `Registry hint: npm.cmd exec tsx -- scripts/skills-registry-render.ts`,
    `Workspace: ${path.relative(config.projectRoot, result.targetRootPath).replace(/\\/g, '/') || '.'}`,
  ].join('\n'));
}

main().catch((error) => {
  console.error(`[skills-import] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
