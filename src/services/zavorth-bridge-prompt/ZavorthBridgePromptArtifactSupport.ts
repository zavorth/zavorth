import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import type { PendingZavorthBridgeSession } from '../../orchestrator/AgentBridgeManager.js';
import { logger } from '../../logger.js';

export type ZavorthBridgeArtifact = {
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

export class ZavorthBridgePromptArtifactSupport {
  constructor(private readonly host: any) {}

  public async tryReadResponseFile(
    responseFile: string,
  ): Promise<{ path: string; processedPath: string | null; content: string } | null> {
    const processedPath = responseFile.replace(/\.md$/i, '.processed.md');
    const candidates = [processedPath, responseFile];

    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) {
        continue;
      }

      const content = (await fs.promises.readFile(candidate, 'utf8')).trim();
      if (!content) {
        continue;
      }

      if (candidate === responseFile) {
        const targetProcessedPath = processedPath;
        await fs.promises.rename(responseFile, targetProcessedPath).catch(() => undefined);
        const persistedPath = fs.existsSync(targetProcessedPath) ? targetProcessedPath : responseFile;
        return {
          path: responseFile,
          processedPath: persistedPath === responseFile ? null : persistedPath,
          content,
        };
      }

      return {
        path: candidate,
        processedPath: candidate,
        content,
      };
    }

    return null;
  }

  public async readSession(trackingFile: string): Promise<PendingZavorthBridgeSession | null> {
    try {
      const raw = await fs.promises.readFile(trackingFile, 'utf8');
      const parsed = JSON.parse(raw) as PendingZavorthBridgeSession;
      parsed.trackingFile = trackingFile;
      return parsed;
    } catch (error) { logger.warn('[Zavorth Bridge Prompt Artifact] JSON parse failed', error); return null; }
  }

  public async markSessionCompleted(
    session: PendingZavorthBridgeSession,
    responsePath: string | null,
    artifact: ZavorthBridgeArtifact | null,
  ): Promise<void> {
    if (responsePath) {
      session.deliveredResponse = true;
    }

    if (artifact && !session.deliveredArtifactKeys.includes(artifact.key)) {
      session.deliveredArtifactKeys.push(artifact.key);
    }

    session.completedAt = new Date().toISOString();
    await this.host.bridgeManager.saveSession(session);
  }

  public async findRelevantArtifacts(session: PendingZavorthBridgeSession): Promise<ZavorthBridgeArtifact[]> {
    const artifacts = await this.host.collectArtifacts();
    const launchedAtMs = new Date(session.launchedAt).getTime();
    return artifacts
      .filter((artifact: ZavorthBridgeArtifact) => artifact.updatedAtMs >= launchedAtMs - 2000)
      .filter((artifact: ZavorthBridgeArtifact) => this.host.matchesSession(session, artifact))
      .sort((left: ZavorthBridgeArtifact, right: ZavorthBridgeArtifact) => {
        const priorityDelta = this.host.getArtifactPriority(right.artifactType) - this.host.getArtifactPriority(left.artifactType);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return right.updatedAtMs - left.updatedAtMs;
      });
  }

  public getArtifactPriority(artifactType: string): number {
    switch (artifactType) {
      case 'ARTIFACT_TYPE_WALKTHROUGH':
        return 30;
      case 'ARTIFACT_TYPE_TASK':
        return 20;
      case 'ARTIFACT_TYPE_IMPLEMENTATION_PLAN':
        return 10;
      default:
        return 0;
    }
  }

  public async collectArtifacts(): Promise<ZavorthBridgeArtifact[]> {
    if (!fs.existsSync(config.zavorthBridgeBrainDir)) {
      return [];
    }

    const entries = await fs.promises.readdir(config.zavorthBridgeBrainDir, { withFileTypes: true });
    const artifacts: ZavorthBridgeArtifact[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'tempmediaStorage') {
        continue;
      }

      const dirPath = path.join(config.zavorthBridgeBrainDir, entry.name);
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
          const contentPath = await this.host.resolveArtifactContentPath(dirPath, baseName);
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
        } catch (error: any) {
          this.host.logRepo.log('warn', 'ZavorthBridgePromptService', `Falha ao ler artefato do ZavorthBridge: ${error.message}`);
        }
      }
    }

    return artifacts;
  }

  public async resolveArtifactContentPath(dirPath: string, baseName: string): Promise<string | null> {
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

  public matchesSession(session: PendingZavorthBridgeSession, artifact: ZavorthBridgeArtifact): boolean {
    const correlationNeedles = [
      session.taskId,
      `ZAVORTH_TASK_ID:${session.taskId}`,
      path.basename(session.handoffFile),
      path.basename(session.responseFile),
    ];

    return correlationNeedles.some(
      (needle) => artifact.content.includes(needle) || artifact.summary.includes(needle),
    );
  }
}
