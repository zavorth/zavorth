import fs from 'fs';
import path from 'path';

export function fileExists(projectRoot: string, relativePath: string): boolean {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

export function readEnvFile(projectRoot: string): Record<string, string> {
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const env: Record<string, string> = {};
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) {
      continue;
    }
    env[match[1]] = unquoteEnv(match[2]);
  }
  return env;
}

export function redactValue(value: string): string {
  const raw = String(value || '');
  if (!raw) {
    return 'missing';
  }
  return '[redacted]';
}

export function parseMajor(version: string): number {
  const match = String(version || '').match(/^v?(\d+)/);
  return match ? Number(match[1]) : 0;
}

function unquoteEnv(value: string): string {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
