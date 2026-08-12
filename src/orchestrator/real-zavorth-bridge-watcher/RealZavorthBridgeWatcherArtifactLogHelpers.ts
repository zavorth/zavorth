import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';export type ZavorthBridgeArtifact = {
  artifactType: string;
  baseName: string;
  brainDir: string;
  content: string;
  contentPath: string;
  key: string;
  summary: string;
  updatedAt: string;
  updatedAtMs: number;
};

export type ZavorthBridgeLogEvent = {
  line: string;
  timestampIso: string;
  timestampMs: number;
};

export async function collectArtifacts(brainDir: string): Promise<ZavorthBridgeArtifact[]> {
  const entries = await fs.promises.readdir(brainDir, { withFileTypes: true });
  const artifacts: ZavorthBridgeArtifact[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'tempmediaStorage') {
      continue;
    }

    const dirPath = path.join(brainDir, entry.name);
    const files = await fs.promises.readdir(dirPath);
    const metadataFiles = files.filter((file) => file.endsWith('.metadata.json'));

    for (const metadataFile of metadataFiles) {
      const metadataPath = path.join(dirPath, metadataFile);
      try {
        const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8')) as {
          artifactType?: string;
          summary?: string;
          updatedAt?: string;
        };
        const baseName = metadataFile.replace(/\.metadata\.json$/i, '');
        const contentPath = await resolveArtifactContentPath(dirPath, baseName);
        if (!contentPath) {
          continue;
        }

        const content = (await fs.promises.readFile(contentPath, 'utf8')).trim();
        const stats = await fs.promises.stat(contentPath);
        const updatedAt = metadata.updatedAt || stats.mtime.toISOString();
        const updatedAtMs = Number.isFinite(Date.parse(updatedAt)) ? Date.parse(updatedAt) : stats.mtimeMs;

        artifacts.push({
          artifactType: metadata.artifactType || 'ARTIFACT_TYPE_UNKNOWN',
          baseName,
          brainDir: entry.name,
          content,
          contentPath,
          key: `${entry.name}:${baseName}:${updatedAt}`,
          summary: metadata.summary || '',
          updatedAt,
          updatedAtMs,
        });
      } catch (error: unknown) {// Ignore malformed metadata or content files and keep scanning.
      logger.warn('[Real Zavorth Bridge Watcher Artifact Log Helpers] operation failed', error);
    }
    }
  }

  return artifacts.sort((left, right) => right.updatedAtMs - left.updatedAtMs);
}

export async function collectRecentLogEvents(logsDir: string): Promise<ZavorthBridgeLogEvent[]> {
  const latestLogFile = await findLatestZavorthBridgeLogFile(logsDir);
  if (!latestLogFile) {
    return [];
  }

  const raw = await fs.promises.readFile(latestLogFile, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const interesting = lines
    .map((line) => parseZavorthBridgeLogEvent(line))
    .filter((event): event is ZavorthBridgeLogEvent => Boolean(event))
    .filter((event) => isInterestingZavorthBridgeLogLine(event.line));

  return interesting.slice(-30);
}

export async function findLatestZavorthBridgeLogFile(logsDir: string): Promise<string | null> {
  const sessions = await fs.promises.readdir(logsDir, { withFileTypes: true });
  const candidates: { path: string; mtimeMs: number }[] = [];

  for (const session of sessions) {
    if (!session.isDirectory()) {
      continue;
    }

    const candidate = path.join(logsDir, session.name, 'window1', 'exthost', 'google.zavorthBridge', 'ZavorthBridge.log');
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const stats = await fs.promises.stat(candidate);
    candidates.push({ path: candidate, mtimeMs: stats.mtimeMs });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates[0].path;
}

export function parseZavorthBridgeLogEvent(line: string): ZavorthBridgeLogEvent | null {
  const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})/);
  if (!match) {
    return null;
  }

  const timestampIso = match[1].replace(' ', 'T');
  const timestampMs = Date.parse(timestampIso);
  if (!Number.isFinite(timestampMs)) {
    return null;
  }

  return {
    line,
    timestampIso,
    timestampMs,
  };
}

export function isInterestingZavorthBridgeLogLine(line: string): boolean {
  return [
    'Model output error',
    'internal: internal error',
    'CEL: Sending error',
    'No supercomplete response',
  ].some((needle) => line.includes(needle));
}

export function isAutomationTriggerZavorthBridgeLogLine(line: string): boolean {
  return ['Model output error', 'internal: internal error', 'CEL: Sending error'].some((needle) => line.includes(needle));
}

export async function resolveArtifactContentPath(dirPath: string, baseName: string): Promise<string | null> {
  const files = await fs.promises.readdir(dirPath);
  const resolvedCandidates = files
    .filter((file) => file === `${baseName}.resolved` || file.startsWith(`${baseName}.resolved.`))
    .map((file) => path.join(dirPath, file));

  if (resolvedCandidates.length > 0) {
    const stats = await Promise.all(
      resolvedCandidates.map(async (candidate) => ({
        candidate,
        mtimeMs: (await fs.promises.stat(candidate)).mtimeMs,
      })),
    );
    stats.sort((left, right) => right.mtimeMs - left.mtimeMs);
    return stats[0].candidate;
  }

  const directPath = path.join(dirPath, baseName);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  return null;
}
