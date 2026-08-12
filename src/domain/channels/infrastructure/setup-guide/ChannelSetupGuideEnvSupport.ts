import fs from 'fs';
import path from 'path';

export function readEnvFileMap(
  envFilePath: string,
  runtime: {
    existsSync?: typeof fs.existsSync;
    readFileSync?: typeof fs.readFileSync;
  } = {},
): Record<string, string> {
  const existsSync = runtime.existsSync || fs.existsSync.bind(fs);
  const readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  if (!existsSync(envFilePath)) {
    return {};
  }

  const text = readFileSync(envFilePath, 'utf8');
  const result: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = String(rawLine || '').trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }
    result[key] = deserializeEnvValue(rawValue);
  }
  return result;
}

export function upsertEnvFileValues(
  envFilePath: string,
  values: Record<string, string | undefined>,
  runtime: {
    existsSync?: typeof fs.existsSync;
    readFileSync?: typeof fs.readFileSync;
    writeFileSync?: typeof fs.writeFileSync;
    mkdirSync?: typeof fs.mkdirSync;
  } = {},
): string[] {
  const existsSync = runtime.existsSync || fs.existsSync.bind(fs);
  const readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  const writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  const mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);

  const currentText = existsSync(envFilePath) ? readFileSync(envFilePath, 'utf8') : '';
  const lines = currentText ? currentText.split(/\r?\n/) : [];
  const writtenKeys: string[] = [];

  for (const [rawKey, rawValue] of Object.entries(values || {})) {
    const key = String(rawKey || '').trim();
    if (!key || rawValue === undefined) {
      continue;
    }
    const nextLine = `${key}=${serializeEnvValue(rawValue)}`;
    const matcher = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
    const index = lines.findIndex((line) => matcher.test(line));
    if (index >= 0) {
      lines[index] = nextLine;
    } else {
      lines.push(nextLine);
    }
    writtenKeys.push(key);
  }

  const nextText = lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
  mkdirSync(path.dirname(envFilePath), { recursive: true });
  writeFileSync(envFilePath, nextText, 'utf8');
  return writtenKeys;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
}

function serializeEnvValue(value: string): string {
  const normalized = String(value ?? '');
  if (!normalized) {
    return '';
  }
  if (/^[A-Za-z0-9._\-/:=+@,]+$/.test(normalized)) {
    return normalized;
  }
  return `"${normalized
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/"/g, '\\"')}"`;
}

function deserializeEnvValue(value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }
  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    return normalized.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return normalized;
}
