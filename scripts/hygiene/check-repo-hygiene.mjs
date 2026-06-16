import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

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

// Durable exceptions list if needed
const ALLOWED_EXCEPTIONS = [];

export function verifyHygiene() {
  let trackedFiles = [];
  try {
    const stdout = execSync('git ls-files', { encoding: 'utf8', cwd: process.cwd() });
    trackedFiles = stdout.split('\n').map(f => f.trim()).filter(Boolean);
  } catch (error) {
    console.warn('Warning: Could not run git ls-files. Falling back to local file scan.');
    // Fallback: simple recursive directory walk of tracked directories if git is not available
    const walk = (dir) => {
      let results = [];
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

  const failures = [];

  for (const file of trackedFiles) {
    // Check forbidden temp files/paths
    for (const pattern of FORBIDDEN_TEMP_FILES) {
      const regex = new RegExp(`^${pattern}`, 'i');
      if (regex.test(file)) {
        failures.push(`Temporary project artifact tracked: "${file}" (matched pattern "${pattern}")`);
      }
    }

    // Check phase-specific documentation
    for (const regex of FORBIDDEN_PHASE_PATTERNS) {
      if (regex.test(file)) {
        if (!ALLOWED_EXCEPTIONS.includes(file)) {
          failures.push(`Phase-specific documentation file tracked: "${file}" (matched pattern ${regex})`);
        }
      }
    }
  }

  return failures;
}

// If run directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/'))) {
  const failures = verifyHygiene();
  if (failures.length > 0) {
    console.error('Repository Hygiene Check FAILED:');
    failures.forEach(f => console.error(` - ${f}`));
    process.exit(1);
  } else {
    console.log('Repository Hygiene Check PASSED: no forbidden temporary files or phase-specific documentation tracked.');
  }
}
