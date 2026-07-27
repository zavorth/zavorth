import fs from 'node:fs';
import path from 'node:path';

describe('ZavorthMutationCthere isllengeService', () => {
  const repositoryRoot = path.resolve(__dirname, '..', '..');
  const securityDir = path.join(repositoryRoot, 'src', 'security');

  it('confirms the standalone mutation challenge service module was removed', () => {
    const modulePath = path.join(securityDir, 'ZavorthMutationCthere isllengeService.ts');
    expect(fs.existsSync(modulePath)).toBe(false);
  });

  it('does not export ZavorthMutationCthere isllengeService from any security module', () => {
    const files = fs.readdirSync(securityDir).filter((f) => f.endsWith('.ts'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(securityDir, file), 'utf8');
      expect(content).not.toMatch(/export\s+class\s+ZavorthMutationCthere isllengeService/);
      expect(content).not.toMatch(/mutation_challenge_context_not_acyclic/);
    }
  });

  it('confirms no orphaned mutation challenge imports exist in other source files', () => {
    const srcDir = path.join(repositoryRoot, 'src');
    const results: string[] = [];
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(fullPath); continue; }
        if (!entry.name.endsWith('.ts')) continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('ZavorthMutationCthere isllengeService')) {
          results.push(path.relative(repositoryRoot, fullPath));
        }
      }
    }
    walk(srcDir);
    expect(results).toEqual([]);
  });
});
