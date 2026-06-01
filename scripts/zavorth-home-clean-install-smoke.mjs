import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const runner = path.join(repoRoot, 'scripts', 'zavorth-home-clean-install-smoke-runner.ts');
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

function run() {
  const result = spawnSync(process.execPath, [tsxCli, '--tsconfig', path.join(repoRoot, 'tsconfig.json'), runner], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NO_COLOR: '1',
    },
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error([
      'ZAVORTH_HOME clean install smoke failed',
      `exit=${result.status}`,
      result.error ? `error=${result.error.message}` : '',
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'));
  }
  return result.stdout;
}

process.stdout.write(run());
