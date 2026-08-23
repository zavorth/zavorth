/**
 * Wave 1 hygiene contract: runtime persona and memory workspace state
 * (USER.md, SOUL.md and siblings) are generated per installation by the
 * first-run personalization flow and must never be versioned. The repository
 * ships factory-neutral *.md.example templates instead.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../');

const RUNTIME_PERSONA_FILES = [
  'USER.md',
  'SOUL.md',
  'IDENTITY.md',
  'MEMORY.md',
  'TEAM-CONTEXT.md',
  'KNOWLEDGE.md',
  'BOOTSTRAP.md',
  'DOMAIN.md',
  'LEARNING-STYLE.md',
  'ERROR-HANDLING.md',
  'OUTPUT-FORMAT.md',
  'TIME-AUTOMATION.md',
];

describe('RuntimePersonaStateHygiene', () => {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  const gitignoreLines = new Set(
    gitignore
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );

  it('ships a factory-neutral example template for every runtime persona file', () => {
    const missing = RUNTIME_PERSONA_FILES.filter(
      (fileName) => !fs.existsSync(path.join(root, `${fileName}.example`)),
    );
    expect(missing).toEqual([]);
  });

  it('ignores every runtime persona file at the repository root', () => {
    const uncovered = RUNTIME_PERSONA_FILES.filter((fileName) => !gitignoreLines.has(`/${fileName}`));
    expect(uncovered).toEqual([]);
  });

  it('keeps first-run personalization defaults as the regeneration source of truth', () => {
    const personalizationSource = fs.readFileSync(
      path.join(root, 'src', 'services', 'FirstRunPersonalizationService.ts'),
      'utf8',
    );
    for (const constantName of ['DEFAULT_IDENTITY', 'DEFAULT_SOUL', 'DEFAULT_USER', 'DEFAULT_DOMAIN']) {
      expect(personalizationSource).toContain(`const ${constantName}`);
    }
    expect(personalizationSource).toContain("path.join(this.projectRoot, 'USER.md')");
  });
});
