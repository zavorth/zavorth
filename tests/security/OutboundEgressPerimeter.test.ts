import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const INSPECTED_DIRS = [
  'src/adapters',
  'src/agents',
  'src/core',
  'src/execution',
  'src/orchestrator',
  'src/providers',
  'src/services',
  'src/telegram',
  'src/tools',
];

const EXCLUDED_SEGMENTS = [
  `${path.sep}web-console-runtime-shell-script${path.sep}`,
];

function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (EXCLUDED_SEGMENTS.some((segment) => fullPath.includes(segment))) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Outbound egress perimeter', () => {
  it('does not use raw fetch in agent/server runtime paths', () => {
    const violations = INSPECTED_DIRS
      .flatMap((dir) => listSourceFiles(path.join(ROOT, dir)))
      .flatMap((file) => {
        const content = fs.readFileSync(file, 'utf8');
        return content.split(/\r?\n/)
          .map((line, index) => ({ file, line, lineNumber: index + 1 }))
          .filter(({ line }) => /\bfetch\s*\(/.test(line))
          .map(({ file, line, lineNumber }) => `${path.relative(ROOT, file)}:${lineNumber}: ${line.trim()}`);
      });

    expect(violations).toEqual([]);
  });
});
