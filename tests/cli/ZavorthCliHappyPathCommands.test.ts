import { readFileSync } from 'fs';
import {join, resolve} from 'path';


const root = resolve(__dirname, '../../');

describe('Zavorth CLI happy path commands', () => {
  it('routes start/open to ops-go and keeps connect/learn/tools as read-only live surfaces', () => {
    const cli = readFileSync(join(root, 'src/zavorth-cli.ts'), 'utf8');
    const live = readFileSync(join(root, 'src/cli/ZavorthCliLiveNamespaces.ts'), 'utf8');
    const launcher = readFileSync(join(root, 'src/cli/ZavorthCliBuiltinLauncher.ts'), 'utf8');

    // Daily open surface: start/open are live (ops-go), not guide-only.
    expect(cli).toMatch(/if \(command === 'start'\)[\s\S]{0,200}?runPromotedScript\('ops-go'/);
    expect(cli).toMatch(/if \(command === 'open' \|\| command === 'control'\)[\s\S]{0,200}?runPromotedScript\('ops-go'/);
    expect(launcher).toMatch(/if \(command === 'start' \|\| command === 'quickstart'\)[\s\S]{0,200}?runPromotedScript\('ops-go'/);

    // Secondary daily surfaces stay read-only live status (no silent installs/sends).
    for (const command of ['connect', 'learn', 'tools']) {
      expect(live).toContain(`'${command}'`);
      expect(live).toContain(`case '${command}'`);
    }
    expect(live).toContain('runDailySurface');
    expect(live).toContain("sideEffects: 'read-only'");

    const dailySurfaceBlock = live.slice(
      live.indexOf('async function runDailySurface'),
      live.indexOf('export async function runBackground'),
    );
    expect(dailySurfaceBlock).not.toMatch(/transaction plane|policy broker|quarantine/i);
  });
});
