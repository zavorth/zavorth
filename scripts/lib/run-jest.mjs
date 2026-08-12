import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * Canonical jest invocation for repo QA checkers.
 *
 * The root jest.config.js contains CI-oriented testPathIgnorePatterns that
 * exclude the service tests a checker wants to run. Callers may override the
 * default ignore list via --testPathIgnorePatterns or rely on this helper.
 */
export function runJest(targetTests, { cwd = process.cwd(), extraArgs = [] } = {}) {
  const jestBin = path.join(cwd, 'node_modules', 'jest', 'bin', 'jest.js');
  const result = spawnSync(
    process.execPath,
    [jestBin, ...targetTests, '--runInBand', '--no-coverage', ...extraArgs],
    { stdio: 'inherit', cwd },
  );
  return result.status === 0;
}
