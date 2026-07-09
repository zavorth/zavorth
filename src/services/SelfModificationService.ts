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
      return this.makeFailureResult(validation.absolutePath, request.filePath, instruction, 'A instrução de modificação não pode ficar vazia.');
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
        'O modelo não retornou conteúdo suficiente para gerar uma proposta segura.',
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
      reason: changed ? 'Preview gerado com sucesso.' : 'O modelo retornou o mesmo conteúdo atual.',
      filePath: request.filePath,
      absolutePath: validation.absolutePath,
      isNewFile: !fs.existsSync(validation.absolutePath),
      instruction,
      currentContent,
      proposedContent,
      summary,
      diffPatch,
      stats,
      warnings: Array.from(new Set([...(proposal.warnings || []), ...(changed ? [] : ['O conteúdo proposto é idêntico ao atual.'])])),
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
        reason: 'Nenhuma alteração necessária. O arquivo já está sincronizado com a proposta.',
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
          'Voce e o editor seguro oficial de auto-modificacao do Zavorth.',
          'Sua tarefa e devolver apenas JSON valido com o novo conteudo completo do arquivo.',
          'Nao devolva markdown, explicacao fora do JSON ou trechos parciais.',
          'Se a mudanca nao for segura, retorne um JSON com fullContent vazio e uma justificativa em summary.',
          'O caminho-alvo e sempre restrito a raiz do projeto.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Arquivo alvo: ${relativePath}`,
          `Instrução: ${instruction}`,
          '',
          'Conteúdo atual do arquivo:',
          '---FILE_START---',
          currentExcerpt || '(arquivo vazio)',
          '---FILE_END---',
          '',
          'Retorne JSON no formato:',
          '{',
          '  "fullContent": "conteudo completo final do arquivo",',
          '  "summary": "resumo curto da mudança",',
          '  "warnings": ["observações ou riscos"],',
          '  "rationale": "por que a alteração foi feita"',
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
      summary: 'O modelo não retornou JSON; usando o texto bruto como proposta.',
      warnings: ['Resposta do modelo não estava em JSON válido.'],
      rationale: '',
      notes: [],
    };
  }

  private composeSummary(proposal: ModelProposal, stats: SelfModificationStats, currentContent: string, proposedContent: string): string {
    const lines: string[] = [];
    if (proposal.summary) {
      lines.push(proposal.summary.trim());
    }

    lines.push(`Resumo do diff: ${stats.insertions} inserções, ${stats.deletions} remoções, ${stats.changedLines} linhas afetadas.`);

    if (currentContent === proposedContent) {
      lines.push('Nenhuma diferença real foi detectada entre o conteúdo atual e o proposto.');
    }

    if (proposal.rationale) {
      lines.push(`Motivo declarado pelo modelo: ${proposal.rationale.trim()}`);
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
        reason: 'O arquivo solicitado fica fora da raiz do projeto e foi bloqueado.',
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
      '...[conteudo truncado]...',
      '',
      tail,
    ].join('\n');
  }

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
      this.provider = ProviderFactory.create(config.llmProvider || 'gemini');
    }

    return this.provider;
  }
}
