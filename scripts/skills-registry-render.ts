import fs from 'fs';
import path from 'path';
import { SkillCatalogService } from '../src/skills/SkillCatalogService.js';
import { config } from '../src/config/index.js';

function renderMarkdown(snapshot: ReturnType<SkillCatalogService['buildSnapshot']>): string {
  const lines = [
    '# Imported Skill Registry',
    '',
    `Generated at: ${snapshot.generatedAt}`,
    '',
    `- Total skills: ${snapshot.summary.total}`,
    `- Imported skills: ${snapshot.summary.imported}`,
    `- Local skills: ${snapshot.summary.local}`,
    `- Trusted sources: ${snapshot.summary.trusted}`,
    `- Review sources: ${snapshot.summary.review}`,
    '',
    '## Entries',
  ];

  for (const entry of snapshot.entries.filter((item) => item.imported)) {
    lines.push(
      '',
      `### ${entry.name}`,
      '',
      `- Source: ${entry.sourceLabel || entry.sourceId || 'n/a'}`,
      `- License: ${entry.license || 'n/a'}`,
      `- License policy: ${entry.licensePolicy?.label || 'n/a'}`,
      `- Risk: ${entry.risk ? `${entry.risk.level} (${entry.risk.score})` : 'n/a'}`,
      `- Bundles: ${entry.bundleTags.join(', ') || 'n/a'}`,
      `- Support files: ${entry.supportFileCount}`,
      `- Upstream: ${entry.provenance?.upstreamRepository || 'n/a'}`,
      `- Original path: ${entry.provenance?.upstreamRelativePath || entry.provenance?.upstreamSkillPath || 'n/a'}`,
      `- Audit trail: ${entry.audit?.lastEventId || 'n/a'}`,
    );
  }

  lines.push('', '## Bundles', '');
  for (const bundle of snapshot.bundles.filter((entry) => entry.tag !== 'skill')) {
    lines.push(`- ${bundle.tag}: ${bundle.skillNames.join(', ')}`);
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const catalog = new SkillCatalogService();
  const snapshot = catalog.buildSnapshot();
  const outputDir = path.join(config.projectRoot, 'skill-library', 'imported');
  const jsonPath = path.join(outputDir, 'registry.json');
  const markdownPath = path.join(outputDir, 'README.md');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2), 'utf8');
  fs.writeFileSync(markdownPath, renderMarkdown(snapshot), 'utf8');

  console.log([
    'Zavorth Skill Registry',
    `JSON: ${jsonPath}`,
    `Markdown: ${markdownPath}`,
    `Imported entries: ${snapshot.entries.filter((entry) => entry.imported).length}`,
  ].join('\n'));
}

main().catch((error) => {
  console.error(`[skills-registry-render] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
