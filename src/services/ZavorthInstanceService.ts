import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';

export type InstanceInfo = {
  name: string;
  homeRoot: string;
  exists: boolean;
  createdAt: string | null;
  hasMemory: boolean;
  hasConfig: boolean;
  hasCredentials: boolean;
};

const INSTANCE_SUBDIRS = [
  'data',
  'data/runtime',
  'data/memory',
  '.zavorth',
  '.zavorth/wiki',
  '.zavorth/receipts',
  '.zavorth/memory',
  'memory',
  'credentials',
  'logs',
  'tmp',
  'config',
];

const INSTANCE_FILES = [
  'MEMORY.md',
  'IDENTITY.md',
  'SOUL.md',
  'USER.md',
];

export function getInstanceName(env?: Record<string, string | undefined>): string {
  const raw = String((env || process.env)['ZAVORTH_INSTANCE'] || '').trim().toLowerCase();
  if (!raw || raw === 'default') return 'default';
  return raw.replace(/[^a-z0-9_-]/g, '').slice(0, 64) || 'default';
}

export function resolveInstanceHome(homeRoot: string, instanceName: string): string {
  const resolved = path.resolve(homeRoot);
  if (instanceName === 'default') return resolved;
  return path.join(resolved, 'instances', instanceName);
}

export function getDefaultInstanceHome(homeRoot: string): string {
  return path.resolve(homeRoot);
}

export function instanceExists(homeRoot: string, instanceName: string): boolean {
  if (instanceName === 'default') return true;
  const instanceDir = resolveInstanceHome(homeRoot, instanceName);
  return fs.existsSync(instanceDir) && fs.statSync(instanceDir).isDirectory();
}

export function listInstances(homeRoot: string): InstanceInfo[] {
  const resolved = path.resolve(homeRoot);
  const instancesDir = path.join(resolved, 'instances');
  const results: InstanceInfo[] = [];

  results.push(buildInstanceInfo(resolved, 'default'));

  if (fs.existsSync(instancesDir) && fs.statSync(instancesDir).isDirectory()) {
    try {
      const entries = fs.readdirSync(instancesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          results.push(buildInstanceInfo(path.join(instancesDir, entry.name), entry.name));
        }
      }
    } catch (error: any) {
      logger.warn('[ZavorthInstance] Failed to read instances directory', error);
    }
  }

  return results;
}

export function createInstance(homeRoot: string, instanceName: string): InstanceInfo {
  if (instanceName === 'default') {
    throw new Error('Cannot create the default instance. It already exists.');
  }
  if (!isValidInstanceName(instanceName)) {
    throw new Error(`Invalid instance name: "${instanceName}". Use lowercase alphanumeric, hyphens, or underscores (max 64 chars).`);
  }
  if (instanceExists(homeRoot, instanceName)) {
    throw new Error(`Instance "${instanceName}" already exists at ${resolveInstanceHome(homeRoot, instanceName)}.`);
  }

  const instanceDir = resolveInstanceHome(homeRoot, instanceName);

  for (const subdir of INSTANCE_SUBDIRS) {
    fs.mkdirSync(path.join(instanceDir, subdir), { recursive: true });
  }

  for (const file of INSTANCE_FILES) {
    const filePath = path.join(instanceDir, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, generateFileContent(file, instanceName), 'utf-8');
    }
  }

  const metaPath = path.join(instanceDir, '.instance-meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    name: instanceName,
    createdAt: new Date().toISOString(),
    homeRoot: instanceDir,
  }, null, 2), 'utf-8');

  return buildInstanceInfo(instanceDir, instanceName);
}

export function deleteInstance(homeRoot: string, instanceName: string, force = false): void {
  if (instanceName === 'default') {
    throw new Error('Cannot delete the default instance.');
  }
  if (!instanceExists(homeRoot, instanceName)) {
    throw new Error(`Instance "${instanceName}" does not exist.`);
  }

  const instanceDir = resolveInstanceHome(homeRoot, instanceName);
  const resolvedHome = path.resolve(homeRoot);
  const resolvedInstance = path.resolve(instanceDir);

  if (!resolvedInstance.startsWith(resolvedHome)) {
    throw new Error('Path traversal detected in instance name.');
  }

  if (!force) {
    const metaPath = path.join(instanceDir, '.instance-meta.json');
    if (fs.existsSync(metaPath)) {
      // marker for future confirmation check
    }
  }

  fs.rmSync(instanceDir, { recursive: true, force: true });
}

export function getInstancePath(homeRoot: string, instanceName: string, ...segments: string[]): string {
  const base = resolveInstanceHome(homeRoot, instanceName);
  return path.join(base, ...segments);
}

function buildInstanceInfo(instanceDir: string, name: string): InstanceInfo {
  const exists = fs.existsSync(instanceDir) && fs.statSync(instanceDir).isDirectory();
  let createdAt: string | null = null;

  if (exists) {
    const metaPath = path.join(instanceDir, '.instance-meta.json');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        createdAt = meta.createdAt || null;
      } catch (error: any) {
      // ignore
      logger.warn('[Zavorth Instance] JSON parse failed', error);
    }
    }
    if (!createdAt) {
      try {
        const stat = fs.statSync(instanceDir);
        createdAt = stat.birthtime?.toISOString() || stat.mtime.toISOString();
      } catch (error: any) {
      // ignore
      logger.warn('[Zavorth Instance] JSON parse failed', error);
    }
    }
  }

  return {
    name,
    homeRoot: instanceDir,
    exists,
    createdAt,
    hasMemory: exists && fs.existsSync(path.join(instanceDir, 'MEMORY.md')),
    hasConfig: exists && fs.existsSync(path.join(instanceDir, 'config')),
    hasCredentials: exists && fs.existsSync(path.join(instanceDir, 'credentials')),
  };
}

function generateFileContent(filename: string, instanceName: string): string {
  switch (filename) {
    case 'MEMORY.md':
      return `# Zavorth Memory — Instance: ${instanceName}\n\nCurated long-term memory for the "${instanceName}" instance.\n`;
    case 'IDENTITY.md':
      return `# IDENTITY.md — Instance: ${instanceName}\n\nCanonical identity for this Zavorth instance.\n`;
    case 'SOUL.md':
      return `# SOUL.md — Instance: ${instanceName}\n\nVoice and temperament for this Zavorth instance.\n`;
    case 'USER.md':
      return `# USER.md — Instance: ${instanceName}\n\nUser profile for this Zavorth instance.\n`;
    default:
      return '';
  }
}

function isValidInstanceName(name: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(name);
}
