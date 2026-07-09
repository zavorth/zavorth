import { Context, InputFile } from 'grammy';
import fs from 'fs';
import path from 'path';
import { Task } from '../../../../contracts/TaskContract.js';
import { ArtifactRecord } from '../../../../contracts/ArtifactContract.js';
import { ArtifactPipelineService } from '../../../../runtime/artifacts/ArtifactPipelineService.js';
import { SmartOutputService } from '../../../../services/SmartOutputService.js';

type PersistTaskFn = (task: Task) => void;

type ReplyWithPhotoFn = (photo: InputFile, options?: { caption?: string }) => Promise<unknown>;
type ReplyWithAudioFn = (audio: InputFile, options?: { caption?: string; title?: string }) => Promise<unknown>;
type ReplyWithDocumentFn = (document: InputFile, options?: { caption?: string }) => Promise<unknown>;

interface TelegramMediaContext {
  replyWithPhoto?: ReplyWithPhotoFn;
  replyWithAudio?: ReplyWithAudioFn;
  replyWithDocument?: ReplyWithDocumentFn;
}

function asTelegramMediaContext(ctx: Context): TelegramMediaContext {
  return ctx as TelegramMediaContext;
}

export type TelegramExecutionArtifactDeliveryServiceDeps = {
  persistTask: PersistTaskFn;
};

export class TelegramExecutionArtifactDeliveryService {
  private readonly artifactPipeline = new ArtifactPipelineService();

  constructor(private readonly deps: TelegramExecutionArtifactDeliveryServiceDeps) {}

  public async sendTaskArtifacts(ctx: Context, task: Task): Promise<void> {
    const artifacts = this.artifactPipeline.normalizeArtifacts(
      Array.isArray(task.artifacts) ? task.artifacts : [],
      task.executor_used || task.command_type.replace(/^\//, '') || 'executor',
    );
    if (artifacts.length === 0) {
      return;
    }

    const deliveredKeys = new Set(
      Array.isArray(task.metadata?.deliveredArtifactKeys)
        ? task.metadata.deliveredArtifactKeys.filter(
            (value: unknown): value is string => typeof value === 'string',
          )
        : [],
    );

    const newlyDelivered: string[] = [];
    const deferredLinks: string[] = [];

    for (const artifact of artifacts) {
      const deliveryKey = this.artifactPipeline.getDeliveryKey(artifact);
      if (!deliveryKey || deliveredKeys.has(deliveryKey)) {
        continue;
      }

      const localPath = String(artifact?.path || '').trim();
      const remoteUrl = String(artifact?.url || '').trim();
      const fileName =
        String(artifact?.name || path.basename(localPath || remoteUrl || 'artifact')).trim() || 'artifact';
      const caption = this.artifactPipeline.buildCaption(task.task_id, artifact);

      try {
        if (localPath && fs.existsSync(localPath)) {
          const sent = await this.trySendArtifactFile(ctx, localPath, fileName, artifact, caption);
          if (sent) {
            deliveredKeys.add(deliveryKey);
            newlyDelivered.push(deliveryKey);
            continue;
          }
        }

        if (remoteUrl) {
          deferredLinks.push(this.artifactPipeline.formatLinkLine(artifact));
          deliveredKeys.add(deliveryKey);
          newlyDelivered.push(deliveryKey);
        }
      } catch (error: any) { const err = error; const e = error;
        if (remoteUrl) {
          deferredLinks.push(this.artifactPipeline.formatLinkLine(artifact));
          deliveredKeys.add(deliveryKey);
          newlyDelivered.push(deliveryKey);
        }
      }
    }

    if (deferredLinks.length > 0) {
      await SmartOutputService.reply(
        ctx,
        [
          task.executor_used === 'stitch' ? 'Entrega visual pronta:' : 'Resultados gerados:',
          '',
          ...deferredLinks,
        ].join('\n'),
        { includeDeleteAction: false },
      );
    }

    if (newlyDelivered.length > 0) {
      task.metadata = {
        ...(task.metadata || {}),
        deliveredArtifactKeys: Array.from(deliveredKeys),
        artifact_manifest: this.artifactPipeline.buildManifest(artifacts, {
          traceId: task.metadata?.traceId || task.metadata?.trace_id || null,
          runId: task.metadata?.runId || task.metadata?.run_id || task.task_id,
          sessionId: task.metadata?.sessionId || task.metadata?.session_id || task.chat_id || null,
          taskId: task.task_id,
          surface: task.source,
          source: task.executor_used || 'telegram-delivery',
        }),
      };
      task.artifacts = artifacts;
      this.deps.persistTask(task);
    }
  }

  private async trySendArtifactFile(
    ctx: Context,
    filePath: string,
    fileName: string,
    artifact: ArtifactRecord,
    caption: string,
  ): Promise<boolean> {
    const mimeType = String(artifact?.mimeType || '').toLowerCase();
    const imageLike = mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(fileName);
    const audioLike = mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|opus|m4a|flac|aac)$/i.test(fileName);

    const mediaCtx = asTelegramMediaContext(ctx);

    if (imageLike && typeof mediaCtx.replyWithPhoto === 'function') {
      await mediaCtx.replyWithPhoto(new InputFile(filePath, fileName), {
        caption: caption.slice(0, 1024),
      });
      return true;
    }

    if (audioLike && typeof mediaCtx.replyWithAudio === 'function') {
      await mediaCtx.replyWithAudio(new InputFile(filePath, fileName), {
        caption: caption.slice(0, 1024),
        title: fileName,
      });
      return true;
    }

    if (typeof mediaCtx.replyWithDocument === 'function') {
      await mediaCtx.replyWithDocument(new InputFile(filePath, fileName), {
        caption: caption.slice(0, 1024),
      });
      return true;
    }

    return false;
  }
}
