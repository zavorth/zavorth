import fs from 'fs';
import path from 'path';
import { ArtifactDeliveryChannel, ArtifactRecord } from '../contracts/ArtifactContract.js';
import type { ExecutionLifecycleRecord } from '../contracts/ExecutionLifecycleContract.js';
import { ExecutionLifecycleLinkService } from './ExecutionLifecycleLinkService.js';
import { logger } from '../logger.js';

type ArtifactLifecycleContext = {
  traceId?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  taskId?: string | null;
  surface?: string | null;
  source?: string | null;
};

export type ArtifactManifest = {
  total: number;
  photos: number;
  documents: number;
  links: number;
  missing_local_files: number;
  generated_at: string;
  by_kind: Record<string, number>;
  by_delivery_channel: Record<ArtifactDeliveryChannel, number>;
  primary_artifact_key: string | null;
  primary_artifact_name: string | null;
  local_paths: string[];
  remote_urls: string[];
  package_mode: 'none' | 'single' | 'bundle';
  lifecycle: ExecutionLifecycleRecord[];
};

export class ArtifactPipelineService {
  private readonly lifecycleLinks = new ExecutionLifecycleLinkService();

  public normalizeArtifacts(rawArtifacts: unknown[], sourceHint = 'executor'): ArtifactRecord[] {
    const records = Array.isArray(rawArtifacts)
      ? rawArtifacts
          .map((artifact, index) => this.normalizeArtifact(artifact, sourceHint, index))
          .filter((artifact): artifact is ArtifactRecord => Boolean(artifact))
      : [];

    const deduped = new Map<string, ArtifactRecord>();
    for (const artifact of records) {
      if (!deduped.has(artifact.key)) {
        deduped.set(artifact.key, artifact);
      }
    }

    return Array.from(deduped.values());
  }

  public getDeliveryKey(artifact: Partial<ArtifactRecord> | null | undefined): string | null {
    const key = String(
      artifact?.key ||
      artifact?.path ||
      artifact?.url ||
      artifact?.name ||
      artifact?.id ||
      '',
    ).trim();

    return key || null;
  }

  public buildCaption(taskId: string, artifact: Partial<ArtifactRecord> | null | undefined): string {
    const label = this.describeArtifact(artifact);
    const detail = String(artifact?.summary || artifact?.description || '').trim();
    const isStitch = String(artifact?.source || '').trim().toLowerCase() === 'stitch';
    return [
      isStitch ? `Visual delivery for task ${taskId.substring(0, 8)}` : `Artifact for task ${taskId.substring(0, 8)}`,
      label,
      detail && detail !== label ? detail : '',
    ].filter(Boolean).join('\n');
  }

  public formatLinkLine(artifact: Partial<ArtifactRecord> | null | undefined): string {
    const name = String(artifact?.name || artifact?.url || artifact?.path || 'artifact').trim();
    const label = this.describeArtifact(artifact);
    const url = String(artifact?.url || '').trim();
    return `- ${name} (${label})${url ? `: ${url}` : ''}`;
  }

  public formatArtifactLine(artifact: Partial<ArtifactRecord> | null | undefined): string {
    const name = String(artifact?.name || artifact?.url || artifact?.path || 'artifact').trim();
    const label = this.describeArtifact(artifact);
    const location = String(artifact?.path || artifact?.url || '').trim();
    const summary = String(artifact?.summary || artifact?.description || '').trim();
    const parts = [label];

    if (location) {
      parts.push(location);
    }
    if (summary && summary !== label) {
      parts.push(summary);
    }

    return `${name} - ${parts.join(' | ')}`;
  }

  public buildManifest(artifacts: ArtifactRecord[], context: ArtifactLifecycleContext = {}): ArtifactManifest {
    const manifest = artifacts.reduce<ArtifactManifest>((currentManifest, artifact) => {
      const normalizedKind = String(artifact.kind || artifact.type || 'file').trim().toLowerCase() || 'file';
      currentManifest.total += 1;
      currentManifest.by_kind[normalizedKind] = (currentManifest.by_kind[normalizedKind] || 0) + 1;
      currentManifest.by_delivery_channel[artifact.deliveryChannel] += 1;

      if (artifact.deliveryChannel === 'photo') {
        currentManifest.photos += 1;
      } else if (artifact.deliveryChannel === 'document') {
        currentManifest.documents += 1;
      } else if (artifact.deliveryChannel === 'link') {
        currentManifest.links += 1;
      }

      if (artifact.path && !artifact.exists) {
        currentManifest.missing_local_files += 1;
      }

      if (artifact.path && artifact.exists) {
        currentManifest.local_paths.push(artifact.path);
      }

      if (artifact.url) {
        currentManifest.remote_urls.push(artifact.url);
      }

      if (!currentManifest.primary_artifact_key) {
        currentManifest.primary_artifact_key = artifact.key;
        currentManifest.primary_artifact_name = artifact.name;
      }

      return currentManifest;
    }, {
      total: 0,
      photos: 0,
      documents: 0,
      links: 0,
      missing_local_files: 0,
      generated_at: new Date().toISOString(),
      by_kind: {},
      by_delivery_channel: {
        photo: 0,
        document: 0,
        link: 0,
        none: 0,
      },
      primary_artifact_key: null,
      primary_artifact_name: null,
      local_paths: [],
      remote_urls: [],
      package_mode: 'none',
      lifecycle: [],
    });

    manifest.package_mode = manifest.total <= 0
      ? 'none'
      : (manifest.total === 1 ? 'single' : 'bundle');
    manifest.lifecycle = this.lifecycleLinks.buildArtifactLifecycle(artifacts, {
      traceId: context.traceId || null,
      runId: context.runId || context.taskId || null,
      sessionId: context.sessionId || null,
      parentId: context.taskId || context.runId || null,
      surface: context.surface || null,
      source: context.source || 'artifact-pipeline',
    });

    return manifest;
  }

  public extractLocalPaths(artifacts: ArtifactRecord[]): string[] {
    return artifacts
      .map((artifact) => String(artifact.path || '').trim())
      .filter((value) => value.length > 0);
  }

  private normalizeArtifact(rawArtifact: unknown, sourceHint: string, index: number): ArtifactRecord | null {
    if (!rawArtifact) {
      return null;
    }

    const objectArtifact = typeof rawArtifact === 'object' ? rawArtifact as Record<string, unknown> : null;
    const rawString = typeof rawArtifact === 'string' ? rawArtifact.trim() : '';
    const rawPath = String(objectArtifact?.path || objectArtifact?.file || '').trim() || this.inferPath(rawString);
    const rawUrl = String(objectArtifact?.url || '').trim() || this.inferUrl(rawString);
    const rawName = String(objectArtifact?.name || objectArtifact?.id || '').trim();
    const rawMimeType = String(objectArtifact?.mimeType || objectArtifact?.mime_type || '').trim().toLowerCase() || null;
    const exists = rawPath ? fs.existsSync(rawPath) : false;
    const stats = exists ? fs.statSync(rawPath) : null;
    const name = rawName || this.deriveName(rawPath, rawUrl, rawString, index);
    const mimeType = rawMimeType || this.inferMimeType(rawPath, rawUrl, name);
    const deliveryChannel = this.resolveDeliveryChannel(rawPath, rawUrl, mimeType, name, exists);
    const type = String(objectArtifact?.type || '').trim() || this.deriveType(deliveryChannel, mimeType, name);
    const kind = String(objectArtifact?.kind || '').trim() || this.deriveKind(type, mimeType, name);
    const summary = String(objectArtifact?.summary || '').trim() || this.deriveSummary(kind, deliveryChannel, name);
    const description = String(objectArtifact?.description || '').trim() || null;
    const previewText = String(objectArtifact?.previewText || '').trim() || null;
    const source = String(objectArtifact?.source || sourceHint || 'executor').trim();
    const key = this.getDeliveryKey({
      key: String(objectArtifact?.key || '').trim(),
      path: rawPath,
      url: rawUrl,
      name,
      id: String(objectArtifact?.id || '').trim(),
    });

    if (!key) {
      return null;
    }

    return {
      id: this.buildArtifactId(source, name, index),
      key,
      type,
      kind,
      name,
      source,
      path: rawPath || null,
      url: rawUrl || null,
      mimeType,
      summary,
      description,
      previewText,
      sizeBytes: stats?.size ?? null,
      exists,
      deliveryChannel,
      createdAt: new Date().toISOString(),
    };
  }

  private inferPath(value: string): string {
    if (!value) {
      return '';
    }

    if (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('.\\') || value.startsWith('..\\')) {
      return value;
    }

    return '';
  }

  private inferUrl(value: string): string {
    return /^https?:\/\//i.test(value) ? value : '';
  }

  private deriveName(rawPath: string, rawUrl: string, rawString: string, index: number): string {
    if (rawPath) {
      return path.basename(rawPath);
    }

    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl);
        return path.basename(parsed.pathname) || `artifact-${index + 1}`;
      } catch (error: unknown) {logger.warn('[Artifact Pipeline] network request failed', error); return ''; }
    }

    return rawString || `artifact-${index + 1}`;
  }

  private inferMimeType(rawPath: string, rawUrl: string, name: string): string | null {
    const ext = path.extname(rawPath || rawUrl || name).toLowerCase();
    switch (ext) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      case '.html':
      case '.htm':
        return 'text/html';
      case '.json':
        return 'application/json';
      case '.zip':
        return 'application/zip';
      case '.md':
        return 'text/markdown';
      case '.txt':
        return 'text/plain';
      case '.pdf':
        return 'application/pdf';
      default:
        return null;
    }
  }

  private resolveDeliveryChannel(
    rawPath: string,
    rawUrl: string,
    mimeType: string | null,
    name: string,
    exists: boolean,
  ): ArtifactDeliveryChannel {
    if (rawPath && exists) {
      if (String(mimeType || '').startsWith('image/') || /\.(png|jpe...g|gif|webp)$/i.test(name)) {
        return 'photo';
      }
      return 'document';
    }

    if (rawUrl) {
      return 'link';
    }

    return 'none';
  }

  private deriveType(deliveryChannel: ArtifactDeliveryChannel, mimeType: string | null, name: string): string {
    if (deliveryChannel === 'photo') {
      return 'image';
    }
    if (deliveryChannel === 'link') {
      return 'link';
    }
    if (String(mimeType || '').includes('html') || /\.html...$/i.test(name)) {
      return 'html';
    }
    if (/\.zip$/i.test(name)) {
      return 'archive';
    }
    return 'file';
  }

  private deriveKind(type: string, mimeType: string | null, name: string): string {
    if (type === 'html' || String(mimeType || '').includes('html') || /\.html...$/i.test(name)) {
      return 'html_export';
    }
    if (type === 'archive' || /\.zip$/i.test(name)) {
      return 'archive';
    }
    if (type === 'image') {
      return 'image_preview';
    }
    if (String(mimeType || '').includes('json') || /\.json$/i.test(name)) {
      return 'manifest';
    }
    if (/\.md$/i.test(name)) {
      return 'report';
    }
    return type;
  }

  private deriveSummary(kind: string, deliveryChannel: ArtifactDeliveryChannel, name: string): string {
    switch (kind) {
      case 'html_export':
        return 'Generated HTML';
      case 'archive':
        return 'Compressed file';
      case 'image_preview':
        return 'Imagem gerada';
      case 'manifest':
        return 'artifact manifest';
      case 'report':
        return 'Generated report';
      default:
        if (deliveryChannel === 'link') {
          return 'remote artifact link';
        }
        return `Generated file: ${name}`;
    }
  }

  private describeArtifact(artifact: Partial<ArtifactRecord> | null | undefined): string {
    const kind = String(artifact?.kind || artifact?.type || '').trim().toLowerCase();
    switch (kind) {
      case 'stitch_screenshot':
      case 'stitch_image_url':
        return 'Preview da interface';
      case 'stitch_html':
      case 'stitch_html_url':
        return 'HTML da interface';
      case 'stitch_manifest':
        return 'generation manifest';
      case 'html_export':
      case 'html':
        return 'HTML';
      case 'archive':
        return 'ZIP';
      case 'image_preview':
      case 'image':
        return 'Imagem';
      case 'manifest':
        return 'manifest';
      case 'report':
        return 'Report';
      case 'link':
        return 'Link';
      default:
        return String(artifact?.summary || artifact?.type || 'File').trim() || 'File';
    }
  }

  private buildArtifactId(source: string, name: string, index: number): string {
    const normalized = `${source}-${name}-${index + 1}`
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || `artifact-${index + 1}`;
  }
}
