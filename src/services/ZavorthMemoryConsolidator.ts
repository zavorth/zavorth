import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { ToolHookPipelineService } from './ToolHookPipelineService.js';
import { LlmRuntimeService } from './llm/LlmRuntimeService.js';
import { logger } from '../logger.js';
import type { ChatMessage } from '../providers/ILlmProvider.js';
import { asErrorLike } from '../utils/errorLike';

const MAX_GUIDELINE_CHARS = 2000;
const MAX_GUIDELINE_LINES = 20;
const GIT_DIFF_TIMEOUT_MS = 10_000;
const GIT_DIFF_MAX_BUFFER = 1024 * 1024;

const INJECTION_PATTERNS = [
  /^#\s*(system|assistant|user)\s*:/im,
  /\b(IGNORE|DISREGARD|OVERRIDE)\s+(ALL\s+)?(PREVIOUS|PRIOR|ABOVE)\s+INSTRUCTIONS/i,
  /<\|?(system|assistant|user)\|?>/i,
  /\b(you\s+are\s+now|act\s+as|pretend|new\s+role)\b/i,
];

function sanitizeGuideline(raw: string): string {
  let text = raw;
  for (const pattern of INJECTION_PATTERNS) {
    text = text.replace(pattern, '[REDACTED]');
  }
  const lines = text.split('\n');
  if (lines.length > MAX_GUIDELINE_LINES) {
    text = lines.slice(0, MAX_GUIDELINE_LINES).join('\n');
  }
  if (text.length > MAX_GUIDELINE_CHARS) {
    text = text.slice(0, MAX_GUIDELINE_CHARS);
  }
  return text.trim();
}

export class ZavorthMemoryConsolidator {
  private static readonly MAX_HEALS_PER_SESSION = 5;
  private readonly hookPipeline: ToolHookPipelineService;
  private readonly llmRuntime: LlmRuntimeService;
  private registered = false;
  private healCount = 0;
  private unsubscribers: Array<() => void> = [];

  constructor(
    hookPipeline: ToolHookPipelineService,
    llmRuntime?: LlmRuntimeService
  ) {
    this.hookPipeline = hookPipeline;
    this.llmRuntime = llmRuntime || new LlmRuntimeService();
  }

  public register(): void {
    if (this.registered) return;
    this.registered = true;

    logger.info('[MemoryConsolidator] Registering runtime.after_execute and gateway.after_dispatch listeners');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterExecute = async (payload: any) => {
      await this.consolidate(payload.workspace);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterDispatch = async (payload: any) => {
      await this.consolidate(payload.workspace);
    };

    const unsub1 = this.hookPipeline.registerListener('runtime.after_execute', afterExecute);
    const unsub2 = this.hookPipeline.registerListener('gateway.after_dispatch', afterDispatch);

    this.unsubscribers.push(unsub1, unsub2);
  }

  public unregister(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.registered = false;
  }

  public async consolidate(workspace: string | null): Promise<void> {
    const workspacePath = workspace ? path.resolve(workspace) : process.cwd();
    logger.info(`[MemoryConsolidator] Checking git modifications in workspace: ${workspacePath}`);

    try {
      if (!fs.existsSync(path.join(workspacePath, '.git'))) {
        logger.debug('[MemoryConsolidator] No .git directory found, skipping memory consolidation.');
        return;
      }

      let gitDiff: string;
      try {
        gitDiff = execFileSync('git', ['diff'], {
          cwd: workspacePath,
          encoding: 'utf8',
          timeout: GIT_DIFF_TIMEOUT_MS,
          maxBuffer: GIT_DIFF_MAX_BUFFER,
        }).trim();
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn('[MemoryConsolidator] git diff failed:', err.message);
        return;
      }

      if (!gitDiff) {
        logger.debug('[MemoryConsolidator] No git changes detected.');
        return;
      }

      if (this.healCount >= ZavorthMemoryConsolidator.MAX_HEALS_PER_SESSION) {
        logger.warn(`[MemoryConsolidator] Heal limit reached (${ZavorthMemoryConsolidator.MAX_HEALS_PER_SESSION}), skipping LLM call.`);
        return;
      }

      logger.info('[MemoryConsolidator] Git changes detected, querying LLM for persistent guidelines...');

      const systemPrompt = `You are a Memory Consolidator agent. Your job is to analyze changes made in a git diff and suggest architectural constraints, workspace patterns, or style rules that should be persisted in AGENTS.md to prevent future bugs.
Be extremely precise, concise, and focused. Do not suggest generic rules unless they are directly inspired by the diff.`;

      const prompt = `Based on the changes made, are there any architectural constraints, workspace patterns, or style rules we should persist to prevent bugs...

Here is the git diff:
\`\`\`diff
${gitDiff.slice(0, 4000)}
\`\`\``;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      const response = await this.llmRuntime.chat(messages);
      this.healCount++;

      const rawGuidelines = response?.content?.trim();
      if (!rawGuidelines) {
        logger.warn('[MemoryConsolidator] LLM returned empty guidelines.');
        return;
      }

      const guidelines = sanitizeGuideline(rawGuidelines);
      if (!guidelines) {
        logger.warn('[MemoryConsolidator] Guidelines empty after sanitization.');
        return;
      }

      const agentsMdPath = path.join(workspacePath, 'AGENTS.md');
      if (!fs.existsSync(agentsMdPath)) {
        logger.warn(`[MemoryConsolidator] AGENTS.md not found at: ${agentsMdPath}`);
        return;
      }

      const agentsContent = fs.readFileSync(agentsMdPath, 'utf8');
      if (agentsContent.length > 50000) {
        logger.warn('[MemoryConsolidator] AGENTS.md exceeds 50KB, skipping write to prevent unbounded growth.');
        return;
      }

      logger.info(`[MemoryConsolidator] Appending guidelines to ${agentsMdPath}`);
      const sectionHeader = '## Lessons from Past Runs';

      const timestamp = new Date().toISOString().split('T')[0];
      const lessonBlock = `\n\n### Lesson from ${timestamp}\n${guidelines}\n`;

      const index = agentsContent.indexOf(sectionHeader);
      if (index !== -1) {
        const insertIndex = index + sectionHeader.length;
        const updatedContent =
          agentsContent.slice(0, insertIndex) +
          lessonBlock +
          agentsContent.slice(insertIndex);
        fs.writeFileSync(agentsMdPath, updatedContent, 'utf8');
      } else {
        const newSection = `\n\n${sectionHeader}${lessonBlock}`;
        fs.writeFileSync(agentsMdPath, agentsContent + newSection, 'utf8');
      }

      logger.info('[MemoryConsolidator] Guidelines successfully appended.');
    } catch (error: unknown) {logger.error('[MemoryConsolidator] Error during memory consolidation:', error);
    }
  }
}
