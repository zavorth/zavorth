import { logger } from '../../../logger.js';
import fs from 'fs';
import path from 'path';
import { config } from '../../../config/index.js';
import { safeFetch } from '../../../security/SafeFetchService.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const INLINE_MEDIA_LIMIT_BYTES = 20 * 1024 * 1024;
const FILE_ACTIVE_POLL_INTERVAL_MS = 5000;
const FILE_ACTIVE_TIMEOUT_MS = 5 * 60 * 1000;

export interface GeminiVideoAnalysis {
  analysisText: string;
  source: string;
  warnings: string[];
}

export interface TextSectionInput {
  label: string;
  text: string;
}

interface GeminiFile {
  name: string;
  uri: string;
  mimeType?: string;
  state?: {
    name?: string;
  };
}

interface GeminiVideoAnalyzerOptions {
  apiKey?: string;
  model?: string;
}

export class GeminiVideoAnalyzer {
  private apiKey: string;
  private model: string;

  constructor(options: GeminiVideoAnalyzerOptions = {}) {
    this.apiKey = options.apiKey ?? config.geminiApiKey;
    this.model = options.model ?? config.geminiVideoModel;
  }

  public isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  public async analyzeYouTubeUrl(videoUrl: string, titleHint?: string): Promise<GeminiVideoAnalysis | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const prompt = this.buildVideoPrompt(titleHint, 'URL publica do YouTube');
    const analysisText = await this.generateContent([
      { file_data: { file_uri: videoUrl } },
      { text: prompt },
    ]);

    return {
      analysisText,
      source: `analise nativa do Gemini (${this.model}) via YouTube URL`,
      warnings: [],
    };
  }

  public async transcribeYouTubeUrl(
    videoUrl: string,
    titleHint?: string,
    extraInstruction?: string
  ): Promise<GeminiVideoAnalysis | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const prompt = this.buildPureTranscriptionPrompt(titleHint, 'URL publica do YouTube', extraInstruction);
    const analysisText = await this.generateContent([
      { file_data: { file_uri: videoUrl } },
      { text: prompt },
    ]);

    return {
      analysisText,
      source: `transcricao pura com Gemini (${this.model}) via YouTube URL`,
      warnings: [],
    };
  }

  public async analyzeLocalVideo(
    filePath: string,
    mimeType: string,
    titleHint?: string
  ): Promise<GeminiVideoAnalysis | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const prompt = this.buildVideoPrompt(titleHint, 'arquivo de video');
    return this.analyzeLocalMediaFile(
      filePath,
      mimeType,
      titleHint,
      prompt,
      `analise nativa do Gemini (${this.model}) com video inline`,
      `analise nativa do Gemini (${this.model}) com Files API`
    );
  }

  public async analyzeLocalAudio(
    filePath: string,
    mimeType: string,
    titleHint?: string
  ): Promise<GeminiVideoAnalysis | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const prompt = this.buildAudioPrompt(titleHint, 'arquivo de audio extraido de um video');
    return this.analyzeLocalMediaFile(
      filePath,
      mimeType,
      titleHint,
      prompt,
      `analise de audio com Gemini (${this.model}) inline`,
      `analise de audio com Gemini (${this.model}) via Files API`
    );
  }

  public async transcribeLocalAudio(
    filePath: string,
    mimeType: string,
    titleHint?: string,
    extraInstruction?: string
  ): Promise<GeminiVideoAnalysis | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const prompt = this.buildPureTranscriptionPrompt(titleHint, 'arquivo de audio', extraInstruction);
    return this.analyzeLocalMediaFile(
      filePath,
      mimeType,
      titleHint,
      prompt,
      `transcricao pura com Gemini (${this.model}) inline`,
      `transcricao pura com Gemini (${this.model}) via Files API`
    );
  }

  public async summarizeTextSections(
    sections: TextSectionInput[],
    titleHint?: string
  ): Promise<GeminiVideoAnalysis | null> {
    if (!this.isEnabled() || sections.length === 0) {
      return null;
    }

    const batches = this.buildTextBatches(sections, 45000);
    const batchSummaries: string[] = [];
    const warnings: string[] = [];

    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      const prompt = this.buildBatchSummaryPrompt(batch, index + 1, batches.length, titleHint);
      const summary = await this.generateContent([{ text: prompt }]);
      batchSummaries.push(`## Lote ${index + 1}\n${summary}`);
    }

    if (batchSummaries.length === 1) {
      return {
        analysisText: batchSummaries[0].replace(/^## Lote 1\s*/m, '').trim(),
        source: `sintese textual com Gemini (${this.model})`,
        warnings,
      };
    }

    warnings.push(`A sintese final foi consolidada em ${batchSummaries.length} lotes para lidar com um conteudo longo.`);

    const finalPrompt = this.buildFinalSummaryPrompt(batchSummaries, titleHint);
    const finalSummary = await this.generateContent([{ text: finalPrompt }]);

    return {
      analysisText: finalSummary,
      source: `sintese textual hierarquica com Gemini (${this.model})`,
      warnings,
    };
  }

  private buildVideoPrompt(titleHint: string | undefined, sourceLabel: string): string {
    const titleLine = titleHint ? `Titulo sugerido: ${titleHint}.` : 'O titulo do video nao foi fornecido.';

    return [
      'Analise este video para servir como base de conversa posterior.',
      titleLine,
      `Origem do material: ${sourceLabel}.`,
      'Responda em portugues brasileiro, em Markdown, com as secoes abaixo:',
      '1. Resumo executivo',
      '2. Pontos centrais',
      '3. Linha do tempo com timestamps importantes',
      '4. Elementos visuais relevantes',
      '5. Falas, ideias ou dados importantes',
      '6. Limites ou incertezas da analise',
      'Se houver texto na tela, mencione o que for relevante.',
      'Se a fala ou o visual nao estiverem claros, diga isso explicitamente em vez de inventar.',
      'Se for apropriado, destaque o que seria mais util para discutir este video depois.',
    ].join(' ');
  }

  private buildAudioPrompt(titleHint: string | undefined, sourceLabel: string): string {
    const titleLine = titleHint ? `Titulo sugerido: ${titleHint}.` : 'O titulo do audio nao foi fornecido.';

    return [
      'Analise este audio extraido de um video para servir como base de conversa posterior.',
      titleLine,
      `Origem do material: ${sourceLabel}.`,
      'Responda em portugues brasileiro, em Markdown, com as secoes abaixo:',
      '1. Resumo executivo',
      '2. Transcricao estruturada aproximada do que for compreensivel',
      '3. Pontos centrais',
      '4. Falas, ideias ou dados importantes',
      '5. Limites ou incertezas da analise',
      'Priorize fidelidade ao que foi dito quando o audio estiver claro.',
      'Se nao conseguir entender algum trecho, diga explicitamente que ele esta inaudivel ou incerto.',
      'Preserve nomes proprios, termos tecnicos, numeros e dados quando possivel.',
      'Se houver boa sinalizacao temporal, inclua timestamps aproximados nos trechos mais importantes.',
    ].join(' ');
  }

  private buildPureTranscriptionPrompt(
    titleHint: string | undefined,
    sourceLabel: string,
    extraInstruction?: string
  ): string {
    const titleLine = titleHint ? `Titulo sugerido: ${titleHint}.` : 'O titulo do audio nao foi fornecido.';
    const extraInstructionLine = extraInstruction?.trim()
      ? `Instrucao adicional do usuario: ${extraInstruction.trim()}`
      : '';

    return [
      'Transcreva este audio de forma fiel para servir como base textual de consulta posterior.',
      titleLine,
      `Origem do material: ${sourceLabel}.`,
      'Responda em portugues brasileiro, em Markdown.',
      'Priorize transcricao literal ou o mais proximo possivel do que foi dito, sem resumir o conteudo.',
      'Inclua timestamps aproximados em pontos de troca de assunto ou a cada bloco relevante, quando possivel.',
      'Mantenha nomes proprios, termos tecnicos, numeros e dados factuais.',
      'Quando algum trecho estiver inaudivel ou duvidoso, marque isso explicitamente em vez de inventar.',
      'Se houver muito conteudo, entregue a transcricao em blocos claros e cronologicos.',
      extraInstructionLine,
    ].join(' ');
  }

  private buildBatchSummaryPrompt(
    sections: TextSectionInput[],
    batchIndex: number,
    totalBatches: number,
    titleHint?: string
  ): string {
    const titleLine = titleHint ? `Titulo sugerido: ${titleHint}.` : 'O titulo do material nao foi fornecido.';
    const renderedSections = sections
      .map((section) => `### ${section.label}\n${section.text}`)
      .join('\n\n');

    return [
      'Voce esta resumindo um conjunto de trechos de um video longo, podcast ou documentario.',
      titleLine,
      `Este e o lote ${batchIndex} de ${totalBatches}.`,
      'Responda em portugues brasileiro, em Markdown, com as secoes:',
      '1. Resumo do lote',
      '2. Pontos centrais do lote',
      '3. Linha do tempo aproximada do lote',
      '4. Falas, ideias ou dados relevantes',
      '5. Pontos de atencao ou incertezas',
      'Se algum trecho vier de transcricao automatica, preserve a cautela e nao invente detalhes ausentes.',
      '',
      renderedSections,
    ].join('\n');
  }

  private buildFinalSummaryPrompt(batchSummaries: string[], titleHint?: string): string {
    const titleLine = titleHint ? `Titulo sugerido: ${titleHint}.` : 'O titulo do material nao foi fornecido.';

    return [
      'Voce vai consolidar resumos parciais de um video longo, podcast ou documentario.',
      titleLine,
      'Responda em portugues brasileiro, em Markdown, com as secoes abaixo:',
      '1. Resumo executivo',
      '2. Pontos centrais',
      '3. Linha do tempo aproximada',
      '4. Ideias, falas ou dados marcantes',
      '5. Pontos que valem conversa depois',
      '6. Limites ou incertezas da cobertura',
      'Nao invente detalhes que nao estejam sustentados pelos lotes.',
      '',
      batchSummaries.join('\n\n'),
    ].join('\n');
  }

  private buildTextBatches(sections: TextSectionInput[], maxCharsPerBatch: number): TextSectionInput[][] {
    const batches: TextSectionInput[][] = [];
    let currentBatch: TextSectionInput[] = [];
    let currentLength = 0;

    for (const section of sections) {
      const normalizedText = section.text.trim();
      if (!normalizedText) {
        continue;
      }

      const entryLength = section.label.length + normalizedText.length + 16;
      if (currentBatch.length > 0 && currentLength + entryLength > maxCharsPerBatch) {
        batches.push(currentBatch);
        currentBatch = [];
        currentLength = 0;
      }

      currentBatch.push({
        label: section.label,
        text: normalizedText,
      });
      currentLength += entryLength;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  private async analyzeLocalMediaFile(
    filePath: string,
    mimeType: string,
    titleHint: string | undefined,
    prompt: string,
    inlineSource: string,
    fileApiSource: string
  ): Promise<GeminiVideoAnalysis> {
    const stats = fs.statSync(filePath);

    if (stats.size <= INLINE_MEDIA_LIMIT_BYTES) {
      const base64Data = fs.readFileSync(filePath, { encoding: 'base64' });
      const analysisText = await this.generateContent([
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Data,
          },
        },
        { text: prompt },
      ]);

      return {
        analysisText,
        source: inlineSource,
        warnings: [],
      };
    }

    const uploadedFile = await this.uploadFile(filePath, mimeType, titleHint || path.basename(filePath));

    try {
      const activeFile = await this.waitForActiveFile(uploadedFile.name);
      const analysisText = await this.generateContent([
        {
          file_data: {
            mime_type: activeFile.mimeType || mimeType,
            file_uri: activeFile.uri,
          },
        },
        { text: prompt },
      ]);

      return {
        analysisText,
        source: fileApiSource,
        warnings: [],
      };
    } finally {
      await this.deleteFile(uploadedFile.name);
    }
  }

  private async generateContent(parts: Array<Record<string, unknown>>): Promise<string> {
    const response = await safeFetch(`${GEMINI_API_BASE}/models/${this.model}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 3000,
        },
      }),
    }, {
      serviceName: 'Gemini video generate content',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini generateContent falhou (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    const textParts = this.extractTextParts(payload);
    if (!textParts) {
      throw new Error('Gemini nao retornou texto util para esta analise de video.');
    }

    return textParts;
  }

  private extractTextParts(payload: any): string {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    const parts = candidates.flatMap((candidate: any) => candidate?.content?.parts || []);
    const text = parts
      .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();

    return text;
  }

  private async uploadFile(filePath: string, mimeType: string, displayName: string): Promise<GeminiFile> {
    const buffer = fs.readFileSync(filePath);

    const startResponse = await safeFetch(`${GEMINI_API_BASE.replace('/v1beta', '')}/upload/v1beta/files`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': this.apiKey,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(buffer.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: {
          display_name: displayName,
        },
      }),
    }, {
      serviceName: 'Gemini video upload start',
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      throw new Error(`Gemini upload start falhou (${startResponse.status}): ${errorText}`);
    }

    const uploadUrl = startResponse.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      throw new Error('Gemini nao retornou a URL de upload resumable.');
    }

    const uploadResponse = await safeFetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(buffer.length),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: buffer,
    }, {
      serviceName: 'Gemini video upload finalize',
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Gemini upload finalize falhou (${uploadResponse.status}): ${errorText}`);
    }

    const payload = await uploadResponse.json();
    if (!payload?.file?.name || !payload?.file?.uri) {
      throw new Error('Gemini nao retornou metadados validos apos upload do arquivo.');
    }

    return {
      name: payload.file.name,
      uri: payload.file.uri,
      mimeType: payload.file.mimeType || mimeType,
      state: payload.file.state,
    };
  }

  private async waitForActiveFile(fileName: string): Promise<GeminiFile> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < FILE_ACTIVE_TIMEOUT_MS) {
      const file = await this.getFile(fileName);
      const state = file.state?.name || 'STATE_UNSPECIFIED';

      if (state === 'ACTIVE') {
        return file;
      }

      if (state === 'FAILED') {
        throw new Error(`Gemini marcou o arquivo ${fileName} como FAILED durante o processamento.`);
      }

      await this.sleep(FILE_ACTIVE_POLL_INTERVAL_MS);
    }

    throw new Error(`Gemini nao ativou o arquivo ${fileName} dentro do tempo limite.`);
  }

  private async getFile(fileName: string): Promise<GeminiFile> {
    const encodedName = fileName.split('/').map(encodeURIComponent).join('/');
    const response = await safeFetch(`${GEMINI_API_BASE}/${encodedName}`, {
      headers: {
        'x-goog-api-key': this.apiKey,
      },
    }, {
      serviceName: 'Gemini video file status',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini files.get falhou (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    return {
      name: payload.name,
      uri: payload.uri,
      mimeType: payload.mimeType,
      state: payload.state,
    };
  }

  private async deleteFile(fileName: string): Promise<void> {
    try {
      const encodedName = fileName.split('/').map(encodeURIComponent).join('/');
      await safeFetch(`${GEMINI_API_BASE}/${encodedName}`, {
        method: 'DELETE',
        headers: {
          'x-goog-api-key': this.apiKey,
        },
      }, {
        serviceName: 'Gemini video file cleanup',
      });
    } catch (error) {
      logger.warn(`[GeminiVideoAnalyzer] Falha ao remover arquivo temporario do Gemini: ${error}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
