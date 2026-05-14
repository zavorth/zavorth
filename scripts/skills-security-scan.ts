import { SkillImportService } from '../src/skills/SkillImportService.js';
import { SkillCatalogService } from '../src/skills/SkillCatalogService.js';

type CliOptions = {
  sourceId: string | null;
  sourceRootOverride: string | null;
  sourceSurface: 'skills' | 'skills_omni';
  skillNames: string[];
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    sourceId: null,
    sourceRootOverride: null,
    sourceSurface: 'skills_omni',
    skillNames: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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

function renderImportedCatalog(): void {
  const catalog = new SkillCatalogService();
  const importedEntries = catalog.listEntries().filter((entry) => entry.imported);
  const lines = [
    'Zavorth Skills Security Scan',
    '',
    `Imported skills: ${importedEntries.length}`,
    `Review required: ${importedEntries.filter((entry) => entry.risk?.reviewRequired || entry.licensePolicy?.reviewRequired).length}`,
    `Blocked risk: ${importedEntries.filter((entry) => entry.risk?.level === 'blocked').length}`,
    '',
  ];

  for (const entry of importedEntries) {
    lines.push(
      `${entry.name}: ${entry.risk ? `${entry.risk.level} (${entry.risk.score})` : 'n/a'}`,
      `  License policy: ${entry.licensePolicy?.label || 'n/a'}`,
      `  Audit: ${entry.audit?.lastEventId || 'n/a'}`,
    );
  }

  console.log(lines.join('\n'));
}

function renderSourcePreview(options: CliOptions): void {
  if (!options.sourceId) {
    throw new Error('Informe --source-id para auditar uma fonte externa. Sem isso, use o scan do catalogo importado local.');
  }

  const importer = new SkillImportService();
  const preview = importer.previewImport({
    sourceId: options.sourceId,
    sourceRootOverride: options.sourceRootOverride,
    sourceSurface: options.sourceSurface,
    skillNames: options.skillNames,
  });

  const lines = [
    'Zavorth Skills Security Scan',
    '',
    `Source: ${preview.sourceLabel} (${preview.sourceId})`,
    `Candidates: ${preview.totalCandidates}`,
    `Allowed: ${preview.allowedCount}`,
    `Blocked: ${preview.blockedCount}`,
    `Preview audit: ${preview.previewAudit?.lastEventId || 'n/a'}`,
    '',
  ];

  for (const entry of preview.entries) {
    lines.push(
      `${entry.skillName}: ${entry.allowed ? 'ALLOW' : 'BLOCK'}`,
      `  Risk: ${entry.risk.level} (${entry.risk.score})`,
      `  License policy: ${entry.licensePolicy.label}`,
      `  Reason: ${entry.reason}`,
    );
  }

  console.log(lines.join('\n'));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.sourceId && !options.sourceRootOverride) {
    renderImportedCatalog();
    return;
  }

  renderSourcePreview(options);
}

main().catch((error) => {
  console.error(`[skills-security-scan] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
