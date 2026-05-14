import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targets = ['dist', 'dist-ops'];

for (const target of targets) {
  const absolute = path.resolve(root, target);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove build output outside workspace: ${absolute}`);
  }
  if (fs.existsSync(absolute)) {
    fs.rmSync(absolute, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 250,
    });
  }
}
