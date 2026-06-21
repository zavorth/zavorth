import fs from 'fs';
import path from 'path';
import {
  PUBLIC_ECOSYSTEM_CONTRACTS,
  PUBLIC_ECOSYSTEM_CONTRACT_VERSION,
} from '../../src/runtime/agent/index.js';

const projectRoot = path.resolve(__dirname, '..', '..');

function readText(...segments: string[]): string {
  return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

describe('Zavorth Python SDK docs', () => {
  it('keeps the Python SDK aligned with REST v1 and the public ecosystem manifest boundary', () => {
    const readme = readText('sdk', 'python', 'README.md');
    const example = readText('examples', 'clients', 'simple-bot.py');
    const protocol = readText('docs', 'protocol', 'sdk-usage.md');

    expect(PUBLIC_ECOSYSTEM_CONTRACT_VERSION).toBe('2026-05-02.z0-z1');
    expect(PUBLIC_ECOSYSTEM_CONTRACTS.length).toBeGreaterThan(0);
    expect(readme).toContain('REST v1');
    expect(readme).toContain('PUBLIC_ECOSYSTEM_CONTRACTS');
    expect(readme).toContain('nao e um SDK de runtime');
    expect(readme).toContain('docs/product-direction.md');
    expect(example).toContain('ZavorthClient');
    expect(example).toContain('public contracts');
    expect(protocol).toContain('examples/clients/simple-bot.py');
    expect(protocol).toContain('examples/clients/public-ecosystem-contracts.ts');
  });
});
