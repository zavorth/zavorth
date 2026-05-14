import fs from "fs";
import path from "path";

import {
  DEFAULT_VIDEO_REQUEST,
  MAX_TRANSCRIPT_EXCERPT_CHARS,
  type ProcessedVideoContext,
  type VideoMetadata,
} from "./VideoHandlerTypes.js";
import { VideoHandlerFormatSupport } from "./VideoHandlerFormatSupport.js";

export class VideoHandlerContextSupport {
  public static buildPreparedMessage(
    context: ProcessedVideoContext,
    requestInstruction: string,
  ): string {
    const lines: string[] = [];
    const metadata = context.metadata;
    const excerpt = this.buildTranscriptExcerpt(context.transcript);

    lines.push("[Contexto de video preparado automaticamente]");
    lines.push(`Origem: ${metadata.sourceLabel}`);
    lines.push(`Titulo: ${metadata.title}`);

    if (metadata.author) {
      lines.push(`Autor/canal: ${metadata.author}`);
    }

    if (metadata.sourceUrl) {
      lines.push(`URL: ${metadata.sourceUrl}`);
    }

    if (typeof metadata.durationSeconds === "number") {
      lines.push(
        `Duracao aproximada: ${VideoHandlerFormatSupport.formatDuration(metadata.durationSeconds)}`,
      );
    }

    if (
      typeof metadata.width === "number" &&
      typeof metadata.height === "number"
    ) {
      lines.push(`Resolucao: ${metadata.width}x${metadata.height}`);
    }

    if (typeof metadata.fileSizeBytes === "number") {
      lines.push(
        `Tamanho do arquivo: ${VideoHandlerFormatSupport.formatMegabytes(metadata.fileSizeBytes)} MB`,
      );
    }

    lines.push(`Fonte principal do conteudo: ${context.transcriptSource}`);
    lines.push(`Arquivo de contexto completo: ${context.contextFilePath}`);

    if (metadata.description) {
      lines.push("Descricao do video:");
      lines.push(metadata.description);
    }

    if (context.warnings.length > 0) {
      lines.push("Limitacoes ou observacoes:");
      for (const warning of context.warnings) {
        lines.push(`- ${warning}`);
      }
    }

    if (excerpt) {
      lines.push("Trecho da transcricao/contexto extraido:");
      lines.push(excerpt);
    } else {
      lines.push("Nenhuma transcricao textual foi obtida automaticamente.");
    }

    lines.push(
      `Pedido do usuario: ${requestInstruction || DEFAULT_VIDEO_REQUEST}`,
    );
    lines.push(
      "Se o pedido exigir mais detalhes do que o trecho acima cobre, use a ferramenta `read_file` no arquivo de contexto completo antes de responder com seguranca.",
    );
    lines.push(
      "Se a transcricao ou a analise estiverem incompletas, deixe essa limitacao explicita na resposta.",
    );

    return lines.join("\n\n");
  }

  public static buildTranscriptExcerpt(transcript: string): string {
    const normalized = transcript.trim();
    if (!normalized) {
      return "";
    }

    if (normalized.length <= MAX_TRANSCRIPT_EXCERPT_CHARS) {
      return normalized;
    }

    return `${normalized.slice(0, MAX_TRANSCRIPT_EXCERPT_CHARS).trim()}\n\n...[Trecho truncado. Leia o arquivo de contexto completo se precisar do restante]`;
  }

  public static writeContextFile(
    metadata: VideoMetadata,
    transcript: string,
    transcriptSource: string,
    warnings: string[],
    contextDir: string,
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = VideoHandlerFormatSupport.slugify(metadata.title || "video");
    const filePath = path.join(contextDir, `${timestamp}_${slug}.md`);
    const lines: string[] = [];
    lines.push(`# Contexto de video: ${metadata.title}`);
    lines.push("");
    lines.push(`- Origem: ${metadata.sourceLabel}`);

    if (metadata.sourceUrl) {
      lines.push(`- URL: ${metadata.sourceUrl}`);
    }

    if (metadata.author) {
      lines.push(`- Autor/canal: ${metadata.author}`);
    }

    if (typeof metadata.durationSeconds === "number") {
      lines.push(
        `- Duracao aproximada: ${VideoHandlerFormatSupport.formatDuration(metadata.durationSeconds)}`,
      );
    }

    if (
      typeof metadata.width === "number" &&
      typeof metadata.height === "number"
    ) {
      lines.push(`- Resolucao: ${metadata.width}x${metadata.height}`);
    }

    if (typeof metadata.fileSizeBytes === "number") {
      lines.push(
        `- Tamanho do arquivo: ${VideoHandlerFormatSupport.formatMegabytes(metadata.fileSizeBytes)} MB`,
      );
    }

    lines.push(`- Fonte do conteudo textual: ${transcriptSource}`);

    if (metadata.description) {
      lines.push("");
      lines.push("## Descricao");
      lines.push(metadata.description);
    }

    if (warnings.length > 0) {
      lines.push("");
      lines.push("## Observacoes");
      for (const warning of warnings) {
        lines.push(`- ${warning}`);
      }
    }

    lines.push("");
    lines.push("## Transcricao ou contexto textual");
    lines.push(
      transcript ||
        "Nao foi possivel extrair uma transcricao textual automatica deste video.",
    );

    fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
    return filePath;
  }
}
