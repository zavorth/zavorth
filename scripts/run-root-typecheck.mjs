import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const heapMb = process.env.ZAVORTH_TSC_HEAP_MB || '8192';
const env = {
  ...process.env,
  NODE_OPTIONS: mergeNodeOptions(process.env.NODE_OPTIONS, `--max-old-space-size=${heapMb}`),
};

const tscBin = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

const child = spawn(
  process.execPath,
  [tscBin, '-p', 'tsconfig.json', '--noEmit', '--pretty', 'false'],
  {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Typecheck stopped by signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

function mergeNodeOptions(current, required) {
  const existing = String(current || '').trim();
  if (!existing) return required;
  if (existing.includes('--max-old-space-size=')) return existing;
  return `${existing} ${required}`;
}
