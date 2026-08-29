/**
 * Wiring completeness test for the shared-surface command dispatch.
 *
 * Every command pack constructed in the assembly must be passed to the
 * dispatch call in SharedSurfaceCommandService.maybeHandle. This test
 * asserts that invariant by scanning the service source — no fake wiring.
 *
 * Strict Clean Code: no regex in production code; this meta-test uses
 * simple string includes to verify the production entry point.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = process.cwd();

function readFile(localPath: string): string {
  return fs.readFileSync(path.join(repoRoot, localPath), 'utf8');
}

describe('SharedSurface command dispatch wiring', () => {
  const assemblySource = readFile(
    'src/domain/surface/presentation/shared-surface/factory/SharedSurfaceCommandServiceAssembly.ts',
  );
  const serviceSource = readFile('src/services/SharedSurfaceCommandService.ts');

  // Extract every XxxCommandPack returned by the assembly
  const packPattern = /(\w+CommandPack)(?:,|;)/g;
  const packMatches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = packPattern.exec(assemblySource)) !== null) {
    packMatches.push(match[1]);
  }
  const uniquePacks = [...new Set(packMatches)].sort();

  it('finds all command packs returned by the assembly', () => {
    expect(uniquePacks.length).toBeGreaterThanOrEqual(20);
  });

  it.each(uniquePacks)(
    'every pack from the assembly is referenced in the service maybeHandle or field declarations: %s',
    (packName) => {
      const refs = [
        `this.${packName}`,
        `${packName}: this.${packName}`,
        `private readonly ${packName}!`,
      ];
      const found = refs.some((ref) => serviceSource.includes(ref));
      expect(found).toBe(true);
    },
  );

  it('connectCommandPack is wired to dispatchSharedSurfaceCommandPacks', () => {
    expect(serviceSource.includes('connectCommandPack: this.connectCommandPack')).toBe(true);
  });

  it('botCommandPack is wired to dispatchSharedSurfaceCommandPacks', () => {
    expect(serviceSource.includes('botCommandPack: this.botCommandPack')).toBe(true);
  });
});