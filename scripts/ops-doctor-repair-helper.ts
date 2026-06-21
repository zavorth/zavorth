#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';
import { config } from '../src/config/index.js';

const DEFAULT_SOURCE_REGISTRY = {
  version: 1,
  updatedAt: null,
  sources: [
    {
      id: 'zavorth-native',
      label: 'Zavorth native curated shortlist',
      kind: 'workspace',
      trust: 'review',
      enabled: false,
      ingestionMode: 'local-scan',
      path: 'skill-library/native',
      createIfMissing: false,
      ownership: 'zavorth-native',
      license: 'Zavorth-Internal',
      notes: [
        'Small curated Zavorth-native shortlist only; bulk third-party imports must not live here.',
        'Disabled and review-gated by default until explicitly enabled by owner policy.'
      ]
    },
    {
      id: 'workspace-agents',
      label: 'Workspace .agents skills',
      kind: 'workspace',
      trust: 'trusted',
      enabled: true,
      ingestionMode: 'local-scan',
      path: '.agents/skills',
      createIfMissing: true,
      ownership: 'workspace',
      registrySource: 'zavorth:local-workspace'
    },
    {
      id: 'workspace-library',
      label: 'Workspace skill library',
      kind: 'workspace',
      trust: 'trusted',
      enabled: true,
      ingestionMode: 'local-scan',
      path: 'skill-library',
      createIfMissing: true,
      ownership: 'workspace',
      registrySource: 'zavorth:local-workspace'
    },
    {
      id: 'workspace-imported-library',
      label: 'Workspace imported skill library',
      kind: 'workspace',
      trust: 'review',
      enabled: false,
      ingestionMode: 'local-scan',
      path: 'skill-library/imported',
      createIfMissing: false,
      ownership: 'curated-import',
      registrySource: 'zavorth:curated-import'
    }
  ]
};

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    return error?.code !== 'ESRCH';
  }
}

function clearLocks() {
  console.log('[zavorth-repair] Running clear-locks...');
  
  // 1. Check host supervisor lock
  const hostLockFile = config.hostSupervisorLockFile;
  if (fs.existsSync(hostLockFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(hostLockFile, 'utf8'));
      const pid = Number(data.pid) || 0;
      if (pid && !isProcessAlive(pid)) {
        fs.unlinkSync(hostLockFile);
        console.log(`[zavorth-repair] Removed stuck supervisor lock file: ${hostLockFile}`);
      }
    } catch {
      fs.unlinkSync(hostLockFile);
      console.log(`[zavorth-repair] Removed corrupt supervisor lock file: ${hostLockFile}`);
    }
  }

  // 2. Check telegram worker lock
  const workerLockFile = config.telegramProcessLockFile;
  if (fs.existsSync(workerLockFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(workerLockFile, 'utf8'));
      const pid = Number(data.pid) || 0;
      if (pid && !isProcessAlive(pid)) {
        fs.unlinkSync(workerLockFile);
        console.log(`[zavorth-repair] Removed stuck telegram worker lock file: ${workerLockFile}`);
      }
    } catch {
      fs.unlinkSync(workerLockFile);
      console.log(`[zavorth-repair] Removed corrupt telegram worker lock file: ${workerLockFile}`);
    }
  }

  // 3. Clean database WAL/SHM if both supervisor and worker are dead/not active
  let superActive = false;
  let workerActive = false;
  if (fs.existsSync(hostLockFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(hostLockFile, 'utf8'));
      const pid = Number(data.pid) || 0;
      if (pid && isProcessAlive(pid)) superActive = true;
    } catch {}
  }
  if (fs.existsSync(workerLockFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(workerLockFile, 'utf8'));
      const pid = Number(data.pid) || 0;
      if (pid && isProcessAlive(pid)) workerActive = true;
    } catch {}
  }

  if (!superActive && !workerActive) {
    const dbPath = config.dbPath;
    if (dbPath && dbPath !== ':memory:') {
      const walFile = dbPath + '-wal';
      const shmFile = dbPath + '-shm';
      if (fs.existsSync(walFile)) {
        try {
          fs.unlinkSync(walFile);
          console.log(`[zavorth-repair] Cleaned database WAL file: ${walFile}`);
        } catch (e: any) {
          console.error(`[zavorth-repair] Failed to clean WAL file: ${e.message}`);
        }
      }
      if (fs.existsSync(shmFile)) {
        try {
          fs.unlinkSync(shmFile);
          console.log(`[zavorth-repair] Cleaned database SHM file: ${shmFile}`);
        } catch (e: any) {
          console.error(`[zavorth-repair] Failed to clean SHM file: ${e.message}`);
        }
      }
    }
  }
}

function repairSkillSources() {
  console.log('[zavorth-repair] Running repair-skill-sources...');
  const projectRoot = config.projectRoot;
  const configDir = path.join(projectRoot, 'config');
  const configFile = path.join(configDir, 'skill-sources.json');

  let doc = DEFAULT_SOURCE_REGISTRY;
  let needsWrite = false;

  if (!fs.existsSync(configFile)) {
    needsWrite = true;
    console.log(`[zavorth-repair] Config file missing. Preparing default configuration.`);
  } else {
    try {
      doc = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      if (!doc || !Array.isArray(doc.sources)) {
        throw new Error('Invalid format');
      }
    } catch {
      needsWrite = true;
      doc = DEFAULT_SOURCE_REGISTRY;
      console.log(`[zavorth-repair] Config file is invalid or corrupt. Preparing to overwrite with default config.`);
    }
  }

  if (needsWrite) {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configFile, JSON.stringify(doc, null, 2), 'utf8');
    console.log(`[zavorth-repair] Restored config file at: ${configFile}`);
  }

  // Ensure all configured local workspaces directories are created
  doc.sources.forEach((source: any) => {
    if (source.enabled && source.createIfMissing !== false && source.path) {
      const targetDir = path.isAbsolute(source.path)
        ? path.resolve(source.path)
        : path.resolve(projectRoot, source.path);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`[zavorth-repair] Created missing skill source directory: ${targetDir}`);
      }
    }
  });
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('clear-locks')) {
    clearLocks();
  }
  if (args.includes('repair-skill-sources')) {
    repairSkillSources();
  }
}

main();
