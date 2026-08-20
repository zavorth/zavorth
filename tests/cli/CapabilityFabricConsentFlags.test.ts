/**
 * S4 — absorb CLI consent must not silently elevate allowAll / executable.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';


describe('CapabilityFabricCli consent vs elevation (S4)', () => {
  const projectRoot = process.cwd();
  const src = readFileSync(
    path.join(projectRoot, 'src/cli/CapabilitySubsystemCli.ts'),
    'utf8',
  );

  it('does not OR consent into allowAll', () => {
    expect(src).not.toMatch(/allowAll\s*=\s*hasFlag\([^)]*--allow-all[^)]*\)\s*\|\|\s*consent/);
    expect(src).toMatch(/const allowAll = hasFlag\(args, '--allow-all'\);/);
  });

  it('documents that consent does not elevate risk flags', () => {
    expect(src).toMatch(/consent does NOT elevate risk flags/i);
    expect(src).toMatch(/--allow-executable/);
    expect(src).toMatch(/--allow-all/);
  });

  it('still requires consent for apply', () => {
    expect(src).toMatch(/apply:\s*apply && consent/);
    expect(src).toMatch(/Apply requires --consent/);
  });
});
