import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

describe('Zavorth CLI happy path commands', () => {
  it('offers simple entry commands that point users to setup, channels, learning and tools', () => {
    const source = readFileSync(join(root, 'src/cli/ZavorthCliLiveNamespaces.ts'), 'utf8');

    for (const command of ['start', 'setup', 'connect', 'learn', 'tools']) {
      expect(source).toContain(`'${command}'`);
      expect(source).toContain(`case '${command}'`);
    }

    expect(source).toContain('runHappyPath');
    expect(source).toContain('Zavorth start');
    expect(source).toContain('Connect channels');
    expect(source).toContain('Review learned memory');

    const happyPathBlock = source.slice(
      source.indexOf('async function runHappyPath'),
      source.indexOf('async function runBackground'),
    );
    expect(happyPathBlock).not.toMatch(/transaction plane|policy broker|quarantine/i);
  });
});
