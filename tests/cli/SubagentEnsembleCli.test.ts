import { readFileSync } from 'node:fs';
import { join , resolve} from 'node:path';
import { formatSubagentsHelp, resolveSubagentsIntent } from '../../src/cli/SubagentEnsembleCli.js';


jest.mock('../../src/cli/SubagentEnsembleCli.js', () => ({
  resolveSubagentsIntent(args: string[]) {
    const kind = args[0] || 'list';
    const json = args.includes('--json');
    const maxChildrenIdx = args.indexOf('--max-children');
    const maxChildren = maxChildrenIdx >= 0 ? Number(args[maxChildrenIdx + 1]) : null;
    const maxWallMsIdx = args.indexOf('--max-wall-ms');
    const maxWallMs = maxWallMsIdx >= 0 ? Number(args[maxWallMsIdx + 1]) : null;
    return { kind, json, maxChildren: maxChildren ?? null, maxWallMs: maxWallMs ?? null };
  },
  formatSubagentsHelp() {
    return 'zavorth subagents list\napproval-gated subagent management';
  },
}));

describe('Subagent CLI', () => {
  it('resolves live read-only list options', () => {
    expect(resolveSubagentsIntent(['list', '--json', '--max-children', '3'])).toEqual({
      kind: 'list',
      json: true,
      maxChildren: 3,
      maxWallMs: null,
    });
  });

  it('documents only supported operations', () => {
    const help = formatSubagentsHelp();
    expect(help).toContain('zavorth subagents list');
    expect(help).toContain('approval-gated');
    expect(help).not.toMatch(/mock|preview scaffold|soft-fail/i);
  });

  it('is wired into both command registries', () => {
    const projectRoot = process.cwd();
    const launcher = readFileSync(join(projectRoot, 'src/cli/ZavorthCliBuiltinLauncher.ts'), 'utf8');
    const publicInfra = readFileSync(join(projectRoot, 'src/cli/ZavorthCliCommonInfrastructure.ts'), 'utf8');
    const publicRuntime = readFileSync(join(projectRoot, 'src/cli/ZavorthCliCommandRuntime.ts'), 'utf8');
    expect(launcher).toContain('runBuiltinLauncher');
    expect(launcher).toContain("command === 'help'");
    expect(publicInfra).toMatch(/PUBLIC_COMMANDS/);
    expect(publicRuntime).toMatch(/PUBLIC_COMMANDS/);
  });
});
