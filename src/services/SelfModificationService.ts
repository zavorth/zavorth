import fs from 'fs';
import path from 'path';
import { createTwoFilesPatch, diffLines } from 'diff';
import { config } from '../config/index.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import { ChatMessage, ILlmProvider } from '../providers/ILlmProvider.js';
import { ModificationResult, SafeModificationService } from './SafeModificationService.js';
import { logger } from '../logger.js';

export interface SelfModificationRequest {
  filePath: string;
  instruction: string;
}

export interface SelfModificationStats {
  insertions: number;
  deletions: number;
  changedLines: number;
}

export interface SelfModificationPreviewResult {
  success: boolean;
  reason: string;
  filePath: string;
  absolutePath: string;
  isNewFile: boolean;
  instruction: string;
  currentContent: string;
  proposedContent: string;
  summary: string;
  diffPatch: string;
  stats: SelfModificationStats;
  warnings: string[];
  modelResponseRaw: string;
}

export interface SelfModificationApplyResult extends SelfModificationPreviewResult {
  applied: boolean;
  modificationResult?: ModificationResult;
}

export interface SelfModificationServiceOptions {
  projectRoot?: string;
  provider?: ILlmProvider;
  safeModificationService?: SafeModificationService;
  maxPromptCharacters?: number;
}

type ModelProposal = {
  fullContent?: string;
  proposedContent?: string;
  content?: string;
  summary?: string;
  warnings?: string[];
  rationale?: string;
  notes?: string[];
};

export class SelfModificationService {
  private readonly projectRoot: string;
  private provider?: ILlmProvider;
  private readonly safeModificationService: SafeModificationService;
  private readonly maxPromptCharacters: number;

  constructor(options: SelfModificationServiceOptions = {}) {
    this.projectRoot = options.projectRoot || this.findProjectRoot();
    this.provider = options.provider;
    this.safeModificationService = options.safeModificationService || new SafeModificationService(this.projectRoot);
    this.maxPromptCharacters = options.maxPromptCharacters || 30_000;
  }

  public async previewModification(request: SelfModificationRequest): Promise<SelfModificationPreviewResult> {
    const validation = this.resolveTargetPath(request.filePath);
    if (!validation.allowed) {
      return {
        success: false,
        reason: validation.reason,
        filePath: request.filePath,
        absolutePath: validation.absolutePath,
        isNewFile: false,
        instruction: request.instruction,
        currentContent: '',
        proposedContent: '',
        summary: validation.reason,
        diffPatch: '',
        stats: { insertions: 0, deletions: 0, changedLines: 0 },
        warnings: [validation.reason],
        modelResponseRaw: '',
      };
    }

    const instruction = String(request.instruction || '').trim();
    if (!instruction) {
      return this.makeFailureResult(validation.absolutePath, request.filePath, instruction, 'The modification instruction cannot be empty.');
    }

    const currentContent = await this.readCurrentContent(validation.absolutePath);
    const modelResponse = await this.requestRewrittenContent(validation.absolutePath, currentContent, instruction);
    const proposal = this.parseModelProposal(modelResponse);

    const proposedContentRaw = proposal.proposedContent || '';
    if (!proposedContentRaw.trim()) {
      return this.makeFailureResult(
        validation.absolutePath,
        request.filePath,
        instruction,
        'The model did not return enough content to generate a safe proposal.',
        currentContent,
        modelResponse,
      );
    }

    const proposedContent = proposedContentRaw.trimEnd();
    const diffPatch = createTwoFilesPatch(
      path.relative(this.projectRoot, validation.absolutePath) || path.basename(validation.absolutePath),
      path.relative(this.projectRoot, validation.absolutePath) || path.basename(validation.absolutePath),
      currentContent,
      proposedContent,
      'current',
      'proposed',
      { context: 3 },
    );
    const stats = this.computeStats(currentContent, proposedContent);
    const summary = this.composeSummary(proposal, stats, currentContent, proposedContent);
    const changed = currentContent !== proposedContent;

    return {
      success: true,
      reason: changed ? 'Preview generated successfully.' : 'The model returned the same current content.',
      filePath: request.filePath,
      absolutePath: validation.absolutePath,
      isNewFile: !fs.existsSync(validation.absolutePath),
      instruction,
      currentContent,
      proposedContent,
      summary,
      diffPatch,
      stats,
      warnings: Array.from(new Set([...(proposal.warnings || []), ...(changed ? [] : ['The proposed content is identical to the current one.'])])),
      modelResponseRaw: modelResponse,
    };
  }

  public async applyModification(
    request: SelfModificationRequest,
    preview?: SelfModificationPreviewResult,
  ): Promise<SelfModificationApplyResult> {
    const effectivePreview = preview || await this.previewModification(request);

    if (!effectivePreview.success) {
      return {
        ...effectivePreview,
        applied: false,
      };
    }

    if (effectivePreview.currentContent === effectivePreview.proposedContent) {
      return {
        ...effectivePreview,
        applied: false,
        reason: 'No changes needed. The file is already synchronized with the proposal.',
      };
    }

    const modificationResult = await this.safeModificationService.safeApply(
      effectivePreview.absolutePath,
      effectivePreview.proposedContent,
    );

    return {
      ...effectivePreview,
      applied: modificationResult.success,
      reason: modificationResult.reason,
      modificationResult,
    };
  }

  private async requestRewrittenContent(absolutePath: string, currentContent: string, instruction: string): Promise<string> {
    const relativePath = path.relative(this.projectRoot, absolutePath) || path.basename(absolutePath);
    const currentExcerpt = this.truncateForPrompt(currentContent);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          'You e o editor seguro oficial de auto-modification do Zavorth.',
          'Your task is to return only valid JSON with the complete new file content.',
          'Do not return markdown, explanation outside JSON, or partial snippets.',
          'If the change is not safe, return JSON with empty fullContent and a justification in summary.',
          'O path-alvo e sempre restrito a raiz do projeto.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Target file: ${relativePath}`,
          `Instruction: ${instruction}`,
          '',
          'Current file content:',
          '---FILE_START---',
          currentExcerpt || '(empty file)',
          '---FILE_END---',
          '',
          'Return JSON in the format:',
          '{',
          '  "fullContent": "final complete file content",',
          '  "summary": "short summary of the change",',
          '  "warnings": ["observations or risks"],',
          '  "rationale": "why the change was made"',
          '}',
        ].join('\n'),
      },
    ];

    const response = await this.getProvider().chat(messages);
    return (response.content || '').trim();
  }

  private parseModelProposal(rawResponse: string): ModelProposal {
    const fallbackText = String(rawResponse || '').trim();
    const parsedJson = this.tryParseJson(fallbackText);

    if (parsedJson) {
      const content =
        this.readString(parsedJson.fullContent) ||
        this.readString(parsedJson.proposedContent) ||
        this.readString(parsedJson.content) ||
        '';

      return {
        fullContent: content,
        proposedContent: content,
        content,
        summary: this.readString(parsedJson.summary) || this.readString(parsedJson.rationale) || '',
        warnings: this.readStringArray(parsedJson.warnings || parsedJson.notes),
        rationale: this.readString(parsedJson.rationale) || '',
        notes: this.readStringArray(parsedJson.notes),
      };
    }

    return {
      fullContent: fallbackText,
      proposedContent: fallbackText,
      content: fallbackText,
      summary: 'The model did not return JSON; using the raw text as a proposal.',
      warnings: ['Model response was not valid JSON.'],
      rationale: '',
      notes: [],
    };
  }

  private composeSummary(proposal: ModelProposal, stats: SelfModificationStats, currentContent: string, proposedContent: string): string {
    const lines: string[] = [];
    if (proposal.summary) {
      lines.push(proposal.summary.trim());
    }

    lines.push(`Diff summary: ${stats.insertions} insertions, ${stats.deletions} deletions, ${stats.changedLines} lines affected.`);

    if (currentContent === proposedContent) {
      lines.push('No real difference was detected between the current and proposed content.');
    }

    if (proposal.rationale) {
      lines.push(`Reason declared by the model: ${proposal.rationale.trim()}`);
    }

    return lines.join('\n').trim();
  }

  private computeStats(currentContent: string, proposedContent: string): SelfModificationStats {
    const changes = diffLines(currentContent, proposedContent);
    let insertions = 0;
    let deletions = 0;

    for (const change of changes) {
      const lines = change.value.split(/\r?\n/);
      const lineCount = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
      if (change.added) {
        insertions += lineCount;
      } else if (change.removed) {
        deletions += lineCount;
      }
    }

    return {
      insertions,
      deletions,
      changedLines: insertions + deletions,
    };
  }

  private async readCurrentContent(absolutePath: string): Promise<string> {
    try {
      return await fs.promises.readFile(absolutePath, 'utf-8');
    } catch (error: unknown) {logger.warn('[Self Modification] filesystem operation failed', error); return ''; }
  }

  private resolveTargetPath(filePath: string): { allowed: boolean; reason: string; absolutePath: string } {
    const absolutePath = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(this.projectRoot, filePath);
    const relative = path.relative(this.projectRoot, absolutePath);
    const insideProject =
      absolutePath === this.projectRoot ||
      (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative));

    if (!insideProject) {
      return {
        allowed: false,
        reason: 'The requested file is outside the project root and was blocked.',
        absolutePath,
      };
    }

    return {
      allowed: true,
      reason: 'ok',
      absolutePath,
    };
  }

  private makeFailureResult(
    absolutePath: string,
    filePath: string,
    instruction: string,
    reason: string,
    currentContent = '',
    modelResponseRaw = '',
  ): SelfModificationPreviewResult {
    return {
      success: false,
      reason,
      filePath,
      absolutePath,
      isNewFile: false,
      instruction,
      currentContent,
      proposedContent: '',
      summary: reason,
      diffPatch: '',
      stats: { insertions: 0, deletions: 0, changedLines: 0 },
      warnings: [reason],
      modelResponseRaw,
    };
  }

  private truncateForPrompt(content: string): string {
    if (!content) {
      return '';
    }

    if (content.length <= this.maxPromptCharacters) {
      return content;
    }

    const head = content.slice(0, Math.floor(this.maxPromptCharacters * 0.75));
    const tail = content.slice(-Math.floor(this.maxPromptCharacters * 0.25));
    return [
      head,
      '',
      '...[content truncated]...',
      '',
      tail,
    ].join('\n');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tryParseJson(input: string): any | null {
    const stripped = this.stripCodeFences(input).trim();

    const candidates = [
      stripped,
      this.extractFirstJsonObject(stripped),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch (error: unknown) {// continue
      logger.warn('[Self Modification] JSON parse failed', error);
    }
    }

    return null;
  }

  private stripCodeFences(text: string): string {
    return text
      .replace(/```(?:json|ts|javascript|js|text)?/gi, '')
      .replace(/```/g, '')
      .trim();
  }

  private extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    return text.slice(start, end + 1);
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  }

  private findProjectRoot(): string {
    let dir = process.cwd();
    for (let i = 0; i < 5; i++) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    return process.cwd();
  }

  private getProvider(): ILlmProvider {
    if (!this.provider) {
      this.provider = ProviderFactory.create((config.llmProvider || ''));
    }

    return this.provider;
  }
}
