import fs from 'fs';
import path from 'path';
import { config } from '../src/config/index.js';
import { SkillCatalogReleaseService } from '../src/services/SkillCatalogReleaseService.js';

async function main(): Promise<void> {
  const service = new SkillCatalogReleaseService();
  const snapshot = service.buildSnapshot();
  const markdown = service.renderMarkdown();
  const outputDir = path.join(config.projectRoot, 'data', 'release', 'skills');
  const jsonPath = path.join(outputDir, 'skill-catalog-release.json');
  const markdownPath = path.join(outputDir, 'skill-catalog-release.md');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2), 'utf8');
  fs.writeFileSync(markdownPath, markdown, 'utf8');

  console.log([
    'Zavorth Skill Catalog Release',
    `JSON: ${jsonPath}`,
    `Markdown: ${markdownPath}`,
    `Imported skills: ${snapshot.summary.importedSkills}`,
    `Ready recipes: ${snapshot.summary.readyRecipes}/${snapshot.summary.recipes}`,
  ].join('\n'));
}

main().catch((error) => {
  console.error(`[release-skill-catalog] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
