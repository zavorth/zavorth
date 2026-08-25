import { logger } from '../logger.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { safeFetch } from '../security/SafeFetchService.js';
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

export interface GeminiVideoServiceOptions {
  apiKey?: string;
  apiBaseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export class GeminiVideoService {
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;
  private readonly model: string;
  private readonly fetchImpl?: typeof fetch;

  constructor(options: GeminiVideoServiceOptions = {}) {
    this.apiKey = options.apiKey ?? config.geminiApiKey ?? '';
    this.apiBaseUrl = String(options.apiBaseUrl || GEMINI_API_BASE).trim().replace(/\/+$/, '');
    this.model = options.model ?? config.geminiVideoModel ?? '';
    this.fetchImpl = options.fetchImpl;
  }

  public isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  public async analyzeYouTubeUrl(videoUrl: string, titleHint?: string): Promise<GeminiVideoAnalysis | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const prompt = this.buildVideoPrompt(titleHint, 'public YouTube URL');
    const analysisText = await this.generateContent([
      { file_data: { file_uri: videoUrl } },
      { text: prompt },
    ]);

    return {
      analysisText,
      source: `native Gemini analysis (${this.model}) via YouTube URL`,
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

    const prompt = this.buildPureTranscriptionPrompt(titleHint, 'public YouTube URL', extraInstruction);
    const analysisText = await this.generateContent([
      { file_data: { file_uri: videoUrl } },
      { text: prompt },
    ]);

    return {
      analysisText,
      source: `pure transcription with Gemini (${this.model}) via YouTube URL`,
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

    const prompt = this.buildVideoPrompt(titleHint, 'video file');
    return this.analyzeLocalMediaFile(
      filePath,
      mimeType,
      titleHint,
      prompt,
      `native Gemini analysis (${this.model}) with inline video`,
      `native Gemini analysis (${this.model}) with Files API`
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

    const prompt = this.buildAudioPrompt(titleHint, 'audio file extracted from a video');
    return this.analyzeLocalMediaFile(
      filePath,
      mimeType,
      titleHint,
      prompt,
      `audio analysis with Gemini (${this.model}) inline`,
      `audio analysis with Gemini (${this.model}) via Files API`
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

    const prompt = this.buildPureTranscriptionPrompt(titleHint, 'audio file', extraInstruction);
    return this.analyzeLocalMediaFile(
      filePath,
      mimeType,
      titleHint,
      prompt,
      `pure transcription with Gemini (${this.model}) inline`,
      `pure transcription with Gemini (${this.model}) via Files API`
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
      batchSummaries.push(`## Batch ${index + 1}\n${summary}`);
    }

    if (batchSummaries.length === 1) {
      return {
        analysisText: batchSummaries[0].replace(/^## Batch 1\s*/m, '').trim(),
        source: `text synthesis with Gemini (${this.model})`,
        warnings,
      };
    }

    warnings.push(`The final synthesis was consolidated into ${batchSummaries.length} batches to handle long content.`);

    const finalPrompt = this.buildFinalSummaryPrompt(batchSummaries, titleHint);
    const finalSummary = await this.generateContent([{ text: finalPrompt }]);

    return {
      analysisText: finalSummary,
      source: `hierarchical text synthesis with Gemini (${this.model})`,
      warnings,
    };
  }

  private buildVideoPrompt(titleHint: string | undefined, sourceLabel: string): string {
    const titleLine = titleHint ? `Suggested title: ${titleHint}.` : 'The video title was not provided.';

    return [
      'Analyze this video to serve as a basis for subsequent conversation.',
      titleLine,
      `Material source: ${sourceLabel}.`,
      'Respond in Brazilian Portuguese, in Markdown, with the following sections:',
      '1. Executive summary',
      '2. Key points',
      '3. Timeline with important timestamps',
      '4. Relevant visual elements',
      '5. Speeches, ideas, or important data',
      '6. Limitations or uncertainties of the analysis',
      'If there is text on screen, mention what is relevant.',
      'If the speech or visuals are not clear, state that explicitly rather than making things up.',
      'If appropriate, highlight what would be most useful for discussing this video later.',
    ].join(' ');
  }

  private buildAudioPrompt(titleHint: string | undefined, sourceLabel: string): string {
    const titleLine = titleHint ? `Suggested title: ${titleHint}.` : 'The audio title was not provided.';

    return [
      'Analyze this audio extracted from a video to serve as a basis for subsequent conversation.',
      titleLine,
      `Material source: ${sourceLabel}.`,
      'Respond in Brazilian Portuguese, in Markdown, with the following sections:',
      '1. Executive summary',
      '2. Approximate structured transcription of what is understandable',
      '3. Key points',
      '4. Speeches, ideas, or important data',
      '5. Limitations or uncertainties of the analysis',
      'Prioritize fidelity to what was said when the audio is clear.',
      'If you cannot understand a section, explicitly state that it is inaudible or uncertain.',
      'Preserve proper names, technical terms, numbers, and data when possible.',
      'If there is good temporal signaling, include approximate timestamps in the most important sections.',
    ].join(' ');
  }

  private buildPureTranscriptionPrompt(
    titleHint: string | undefined,
    sourceLabel: string,
    extraInstruction?: string
  ): string {
    const titleLine = titleHint ? `Suggested title: ${titleHint}.` : 'The audio title was not provided.';
    const extraInstructionLine = extraInstruction?.trim() ? `Additional user instruction: ${extraInstruction.trim()}`
      : '';

    return [
      'Transcribe this audio faithfully to serve as a textual reference for later consultation.',
      titleLine,
      `Material source: ${sourceLabel}.`,
      'Respond in Brazilian Portuguese, in Markdown.',
      'Prioritize literal transcription or as close as possible to what was said, without summarizing the content.',
      'Include approximate timestamps at subject change points or at each relevant block, when possible.',
      'Preserve proper names, technical terms, numbers, and factual data.',
      'When a section is inaudible or doubtful, mark that explicitly rather than making things up.',
      'If there is a lot of content, deliver the transcription in clear, chronological blocks.',
      extraInstructionLine,
    ].join(' ');
  }

  private buildBatchSummaryPrompt(
    sections: TextSectionInput[],
    batchIndex: number,
    totalBatches: number,
    titleHint?: string
  ): string {
    const titleLine = titleHint ? `Suggested title: ${titleHint}.` : 'The material title was not provided.';
    const renderedSections = sections
      .map((section) => `### ${section.label}\n${section.text}`)
      .join('\n\n');

    return [
      'You are summarizing a set of excerpts from a long video, podcast, or documentary.',
      titleLine,
      `This is batch ${batchIndex} of ${totalBatches}.`,
      'Respond in Brazilian Portuguese, in Markdown, with the following sections:',
      '1. Batch summary',
      '2. Key points of the batch',
      '3. Approximate timeline of the batch',
      '4. Relevant speeches, ideas, or data',
      '5. Points of attention or uncertainties',
      'If any section comes from automatic transcription, preserve caution and do not invent missing details.',
      '',
      renderedSections,
    ].join('\n');
  }

  private buildFinalSummaryPrompt(batchSummaries: string[], titleHint?: string): string {
    const titleLine = titleHint ? `Suggested title: ${titleHint}.` : 'The material title was not provided.';

    return [
      'You will consolidate partial summaries from a long video, podcast, or documentary.',
      titleLine,
      'Respond in Brazilian Portuguese, in Markdown, with the following sections:',
      '1. Executive summary',
      '2. Key points',
      '3. Approximate timeline',
      '4. Notable ideas, speeches, or data',
      '5. Points worth discussing later',
      '6. Limitations or uncertainties of the coverage',
      'Do not invent details that are not supported by the batches.',
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
    const response = await this.requestSafe(`${this.apiBaseUrl}/models/${this.model}:generateContent`, {
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
      throw new Error(`Gemini generateContent failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    const textParts = this.extractTextParts(payload);
    if (!textParts) {
      throw new Error('Gemini did not return useful text for this video analysis.');
    }

    return textParts;
  }

  private extractTextParts(
    payload: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> },
  ): string {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    const parts = candidates.flatMap((candidate) => candidate?.content?.parts || []);
    const text = parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();

    return text;
  }

  private async uploadFile(filePath: string, mimeType: string, displayName: string): Promise<GeminiFile> {
    const buffer = fs.readFileSync(filePath);

    const startResponse = await this.requestSafe(`${this.apiBaseUrl.replace('/v1beta', '')}/upload/v1beta/files`, {
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
      throw new Error(`Gemini upload start failed (${startResponse.status}): ${errorText}`);
    }

    const uploadUrl = startResponse.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      throw new Error('Gemini did not return a resumable upload URL.');
    }

    const uploadResponse = await this.requestSafe(uploadUrl, {
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
      throw new Error(`Gemini upload finalize failed (${uploadResponse.status}): ${errorText}`);
    }

    const payload = await uploadResponse.json();
    if (!payload?.file?.name || !payload?.file?.uri) {
      throw new Error('Gemini did not return valid metadata after file upload.');
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
        throw new Error(`Gemini marked file ${fileName} as FAILED during processing.`);
      }

      await this.sleep(FILE_ACTIVE_POLL_INTERVAL_MS);
    }

    throw new Error(`Gemini did not activate file ${fileName} within the time limit.`);
  }

  private async getFile(fileName: string): Promise<GeminiFile> {
    const encodedName = fileName.split('/').map(encodeURIComponent).join('/');
    const response = await this.requestSafe(`${this.apiBaseUrl}/${encodedName}`, {
      headers: {
        'x-goog-api-key': this.apiKey,
      },
    }, {
      serviceName: 'Gemini video file status',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini files.get failed (${response.status}): ${errorText}`);
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
      await this.requestSafe(`${this.apiBaseUrl}/${encodedName}`, {
        method: 'DELETE',
        headers: {
          'x-goog-api-key': this.apiKey,
        },
      }, {
        serviceName: 'Gemini video file cleanup',
      });
    } catch (error: unknown) {logger.warn(`[GeminiVideoService] Failed to remove Gemini temporary file: ${error}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async requestSafe(
    url: string,
    init: RequestInit,
    options: { serviceName: string }
  ): Promise<Response> {
    if (this.fetchImpl) {
      return this.fetchImpl(url, init);
    }
    return safeFetch(url, init, {
      serviceName: options.serviceName,
    });
  }
}
