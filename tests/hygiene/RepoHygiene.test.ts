import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('Repository Hygiene Check', () => {
  it('should ensure no temporary project files or phase-specific docs are tracked in git', () => {
    let trackedFiles: string[] = [];
    try {
      const stdout = execSync('git ls-files', { encoding: 'utf8', cwd: process.cwd() });
      trackedFiles = stdout.split('\n').map(f => f.trim()).filter(Boolean);
    } catch (error) {
      const walk = (dir: string): string[] => {
        let results: string[] = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
          file = path.join(dir, file);
          const stat = fs.statSync(file);
          if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('dist') && !file.includes('.git')) {
              results = results.concat(walk(file));
            }
          } else {
            results.push(path.relative(process.cwd(), file).replace(/\\/g, '/'));
          }
        });
        return results;
      };
      trackedFiles = walk(process.cwd());
    }

    const FORBIDDEN_TEMP_FILES = [
      'task.md',
      'walkthrough.md',
      'verification_report.md',
      'proof_.*\\.txt',
      'grep_.*\\.txt',
      'scratch/',
      'tmp/',
      '\\.phase/',
      'project-artifacts/'
    ];

    const FORBIDDEN_PHASE_PATTERNS = [
      /docs\/.*\/phase-21/i,
      /docs\/.*-21[A-Z]/i,
      /docs\/.*-21S-A/i,
      /docs\/.*-21R-A/i
    ];

    const ALLOWED_EXCEPTIONS: string[] = [];
    const failures: string[] = [];

    for (const file of trackedFiles) {
      for (const pattern of FORBIDDEN_TEMP_FILES) {
        const regex = new RegExp(`^${pattern}`, 'i');
        if (regex.test(file)) {
          failures.push(`Temporary project artifact tracked: "${file}" (matched pattern "${pattern}")`);
        }
      }

      for (const regex of FORBIDDEN_PHASE_PATTERNS) {
        if (regex.test(file)) {
          if (!ALLOWED_EXCEPTIONS.includes(file)) {
            failures.push(`Phase-specific documentation file tracked: "${file}" (matched pattern ${regex})`);
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
