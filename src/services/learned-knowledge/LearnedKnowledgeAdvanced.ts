/**
 * Advanced Knowledge surface — file index (Mnemos vault) + dream cycle status.
 * Status and deterministic CLI paths only; never silent-promotes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { knowledgeWikiPresent } from './KnowledgeFactsRecall.js';
import {
  readDreamLastPreview,
} from './LearnedKnowledgeDreamReceipt.js';
import {
  isPathInside,
  safeRealpath,
  toPublicPath,
} from './LearnedKnowledgePathSafety.js';

export type LearnedKnowledgeFileIndexStatus = {
  available: boolean;
  /** Public-safe path (project-relative or (external)/name) — never a full host path. */
  vaultPath: string | null;
  fileCount: number | null;
  directoryCount: number | null;
  lastModifiedAt: string | null;
  truncatedScan: boolean;
  dockerConsentPath: string;
  summary: string;
  cli: string;
  setupHint: string;
};

export type LearnedKnowledgeDreamCycleStatus = {
  available: boolean;
  previewOnly: true;
  summary: string;
  cli: string;
  slash: string;
  schedulerCli: string;
  lastRunAt: string | null;
  lastRunMode: 'preview' | 'unknown' | null;
  lastCandidateCount: number | null;
  lastQuarantineCount: number | null;
  lastStatus: string | null;
  nextEligibleHint: string;
};

export type LearnedKnowledgeAdvancedStatus = {
  fileIndex: LearnedKnowledgeFileIndexStatus;
  dreamCycle: LearnedKnowledgeDreamCycleStatus;
  preferenceSpineNote: string;
};

const MAX_VAULT_ENTRIES = 400;
const MAX_VAULT_DEPTH = 5;

function resolveVaultAbsPath(projectRoot: string): string | null {
  const envVault = String(
    process.env.MNEMOS_VAULT_DIR
    || process.env.ZAVORTH_MNEMOS_VAULT
    || process.env.ZAVORTH_MNEMOS_VAULT_DIR
    || '',
  ).trim();
  const candidates = [
    envVault || null,
    path.join(projectRoot, 'data', 'mnemos_vault'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const resolved = path.resolve(candidate);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        return resolved;
      }
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Shallow vault inventory — capped walk contained under vault root (symlink-safe).
 */
export function scanVaultInventory(vaultPath: string): {
  fileCount: number;
  directoryCount: number;
  lastModifiedAt: string | null;
  truncatedScan: boolean;
} {
  let fileCount = 0;
  let directoryCount = 0;
  let newestMs = 0;
  let visited = 0;
  let truncatedScan = false;

  const vaultRoot = safeRealpath(vaultPath);
  if (!vaultRoot) {
    return { fileCount: 0, directoryCount: 0, lastModifiedAt: null, truncatedScan: false };
  }

  const walk = (dir: string, depth: number) => {
    if (truncatedScan || visited >= MAX_VAULT_ENTRIES) {
      truncatedScan = true;
      return;
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (visited >= MAX_VAULT_ENTRIES) {
        truncatedScan = true;
        return;
      }
      if (
        entry.name === '.'
        || entry.name === '..'
        || entry.name === 'node_modules'
        || entry.name === '.git'
      ) {
        continue;
      }
      const full = path.join(dir, entry.name);
      const contained = safeRealpath(full);
      if (!contained || (!isPathInside(contained, vaultRoot) && contained !== vaultRoot)) {
        continue;
      }
      visited += 1;
      try {
        const st = fs.statSync(contained);
        if (st.mtimeMs > newestMs) newestMs = st.mtimeMs;
        if (entry.isDirectory() || st.isDirectory()) {
          directoryCount += 1;
          if (depth < MAX_VAULT_DEPTH) walk(contained, depth + 1);
        } else if (entry.isFile() || st.isFile()) {
          fileCount += 1;
        }
      } catch {
        // skip unreadable
      }
    }
  };

  walk(vaultRoot, 0);
  return {
    fileCount,
    directoryCount,
    lastModifiedAt: newestMs > 0 ? new Date(newestMs).toISOString() : null,
    truncatedScan,
  };
}

export function buildLearnedKnowledgeAdvanced(options: {
  projectRoot?: string | null;
} = {}): LearnedKnowledgeAdvancedStatus {
  const projectRoot = path.resolve(String(options.projectRoot || process.cwd()));
  const vaultAbs = resolveVaultAbsPath(projectRoot);
  const vaultAvailable = Boolean(vaultAbs);
  const vaultPublic = toPublicPath(vaultAbs, projectRoot);
  const wiki = knowledgeWikiPresent(projectRoot);

  let fileCount: number | null = null;
  let directoryCount: number | null = null;
  let lastModifiedAt: string | null = null;
  let truncatedScan = false;

  if (vaultAbs) {
    try {
      const inv = scanVaultInventory(vaultAbs);
      fileCount = inv.fileCount;
      directoryCount = inv.directoryCount;
      lastModifiedAt = inv.lastModifiedAt;
      truncatedScan = inv.truncatedScan;
    } catch {
      // leave null metrics
    }
  }

  const metricsBits: string[] = [];
  if (vaultAvailable && fileCount != null) {
    metricsBits.push(`${fileCount} file(s)`);
    if (directoryCount != null) metricsBits.push(`${directoryCount} dir(s)`);
    if (lastModifiedAt) metricsBits.push(`last change ${lastModifiedAt.slice(0, 10)}`);
    if (truncatedScan) metricsBits.push('scan capped');
  }

  const fileIndex: LearnedKnowledgeFileIndexStatus = {
    available: vaultAvailable,
    vaultPath: vaultPublic,
    fileCount,
    directoryCount,
    lastModifiedAt,
    truncatedScan,
    dockerConsentPath: 'plan_mnemos_scope → enable_mnemos · default data/mnemos_vault',
    summary: vaultAvailable
      ? `File vault present at ${vaultPublic}${metricsBits.length ? ` · ${metricsBits.join(' · ')}` : ''}. Consent-scoped scan only.`
      : 'File vault not found. Use plan_mnemos_scope → enable_mnemos to choose vault + scan scope (default data/mnemos_vault).',
    cli: 'zavorth knowledge advanced',
    setupHint: vaultAvailable ? 'Vault ready. Indexing still requires explicit enable_mnemos consent for scan dirs.'
      : 'PlanMnemosScope → enable_mnemos (vault_dir + scan_dirs); Docker path when Mnemos engine is needed.',
  };

  const last = readDreamLastPreview(projectRoot);
  let nextEligibleHint = 'Preview anytime: zavorth knowledge consolidate (no auto schedule in hub).';
  if (last?.generatedAt) {
    const lastMs = Date.parse(last.generatedAt);
    if (Number.isFinite(lastMs)) {
      const nextMs = lastMs + 24 * 60 * 60 * 1000;
      const nextIso = new Date(nextMs).toISOString();
      const ready = Date.now() >= nextMs;
      nextEligibleHint = ready ? `Cadence hint (24h): eligible again since ${nextIso.slice(0, 16)}Z · run consolidate when ready`
        : `Cadence hint (24h): next eligible around ${nextIso.slice(0, 16)}Z (preview still allowed anytime)`;
    }
  }

  const dreamParts = [
    'PREVIEW only (no durable write)',
    wiki ? 'wiki present' : 'wiki missing — ingest first',
  ];
  if (last) {
    dreamParts.push(
      `last preview ${last.generatedAt.slice(0, 16)}Z`,
      `candidates=${last.candidateCount}`,
      `quarantine=${last.quarantineCount}`,
      `status=${last.dreamStatus}`,
    );
  } else {
    dreamParts.push('no preview run recorded yet');
  }

  const dreamCycle: LearnedKnowledgeDreamCycleStatus = {
    available: true,
    previewOnly: true,
    summary: `Dream cycle · ${dreamParts.join(' · ')}. Promotion still requires explicit approval.`,
    cli: 'zavorth knowledge consolidate',
    slash: '/knowledge consolidate',
    schedulerCli: 'npm run mnemos:dream-cycle --silent',
    lastRunAt: last?.generatedAt || null,
    lastRunMode: last ? 'preview' : null,
    lastCandidateCount: last ? last.candidateCount : null,
    lastQuarantineCount: last ? last.quarantineCount : null,
    lastStatus: last?.dreamStatus || null,
    nextEligibleHint,
  };

  return {
    fileIndex,
    dreamCycle,
    preferenceSpineNote:
      'Preference / spine learning stays separate from Workflows (experience-skill drafts). Advanced file index does not auto-promote skills.',
  };
}

// Re-export receipt helpers for callers that imported them from Advanced.
export {
  dreamLastPreviewPath,
  readDreamLastPreview,
  writeDreamLastPreview,
  type DreamLastPreviewReceipt,
} from './LearnedKnowledgeDreamReceipt.js';
