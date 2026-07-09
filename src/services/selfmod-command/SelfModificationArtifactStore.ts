import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';
import type {
ChangeSetManifest,
  FilePreviewArtifact,
  GoalPreviewChange,
  PreviewArtifact,
} from './SelfModificationCommandTypes.js';

type SelfModificationArtifactStoreOptions = {
  previewDir: string;
  goalPreviewDir: string;
  historyDir: string;
};

export class SelfModificationArtifactStore {
  private readonly previewDir: string;
  private readonly goalPreviewDir: string;
  private readonly historyDir: string;

  constructor(options: SelfModificationArtifactStoreOptions) {
    this.previewDir = options.previewDir;
    this.goalPreviewDir = options.goalPreviewDir;
    this.historyDir = options.historyDir;
  }

  public ensureDirectories(extraDirectories: string[] = []): void {
    for (const directory of [
      this.previewDir,
      this.goalPreviewDir,
      this.historyDir,
      ...extraDirectories,
    ]) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  public writeShadowWorkspace(shadowWorkspaceDir: string, changes: GoalPreviewChange[]): void {
    fs.mkdirSync(shadowWorkspaceDir, { recursive: true });
    for (const change of changes) {
      const targetPath = path.join(shadowWorkspaceDir, change.relativePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, change.generatedContent, 'utf8');
    }
  }

  public writePreviewArtifact(artifact: PreviewArtifact): void {
    fs.writeFileSync(
      this.getPreviewArtifactPath(artifact.previewId, artifact.kind),
      JSON.stringify(artifact, null, 2),
      'utf8',
    );
  }

  public readPreviewArtifact(previewId: string): PreviewArtifact | null {
    const filePreviewPath = this.getPreviewArtifactPath(previewId, 'file');
    if (fs.existsSync(filePreviewPath)) {
      return JSON.parse(fs.readFileSync(filePreviewPath, 'utf8')) as FilePreviewArtifact;
    }

    const goalPreviewPath = this.getPreviewArtifactPath(previewId, 'goal');
    if (fs.existsSync(goalPreviewPath)) {
      return JSON.parse(fs.readFileSync(goalPreviewPath, 'utf8')) as ChangeSetManifest;
    }

    return null;
  }

  public deletePreviewArtifact(previewId: string, kind: 'file' | 'goal'): void {
    const artifactPath = this.getPreviewArtifactPath(previewId, kind);
    if (fs.existsSync(artifactPath)) {
      fs.unlinkSync(artifactPath);
    }
  }

  public tryDeletePreviewArtifact(previewId: string, kind: 'file' | 'goal'): void {
    try {
      this.deletePreviewArtifact(previewId, kind);
    } catch (error: unknown) {// Artefato residual nao deve invalidar o sucesso do apply.
      logger.warn('[Self Modification Artifact Store] file cleanup failed', error);
    }
  }

  public getPreviewArtifactPath(previewId: string, kind: 'file' | 'goal'): string {
    const baseDir = kind === 'goal' ? this.goalPreviewDir : this.previewDir;
    return path.join(baseDir, `${previewId}.json`);
  }

  public getHistoryArtifactPath(changeId: string): string {
    return path.join(this.historyDir, `${changeId}.json`);
  }
}
