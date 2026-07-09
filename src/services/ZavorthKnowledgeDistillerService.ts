import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';
import { ExternalAiRelayService } from './ExternalAiRelayService.js';

export class ZavorthKnowledgeDistillerService {
  private readonly knowledgePath: string;

  constructor(options?: { knowledgePath?: string }) {
    this.knowledgePath = options?.knowledgePath || path.join(process.cwd(), 'KNOWLEDGE.md');
  }

  /**
   * Distills rules from a conversation log file and merges them into KNOWLEDGE.md.
   *
   * @param logFilePath - Path to the transcript.jsonl file
   * @returns true if new rules were distilled and written; false otherwise.
   */
  public async distillAndSave(logFilePath: string): Promise<boolean> {
    if (!fs.existsSync(logFilePath)) {
      logger.warn(`[Knowledge Distiller] Log file not found: ${logFilePath}`);
      return false;
    }

    try {
      logger.info(`[Knowledge Distiller] Parsing transcript logs from ${logFilePath}...`);
      const logContent = fs.readFileSync(logFilePath, 'utf-8');
      const lines = logContent.split('\n').filter(Boolean);

      let transcriptSummary = '';
      let interactionCount = 0;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'USER_INPUT' && entry.content) {
            transcriptSummary += `User Request: ${entry.content}\n`;
            interactionCount++;
          } else if (entry.type === 'PLANNER_RESPONSE' && entry.content) {
            transcriptSummary += `Assistant Response: ${entry.content}\n`;
          }
        } catch {
          // ignore corrupted lines
        }
      }

      if (interactionCount === 0 || !transcriptSummary.trim()) {
        logger.info('[Knowledge Distiller] No user interactions found in log file.');
        return false;
      }

      logger.info('[Knowledge Distiller] Querying LLM to distill lessons...');
      const relayService = new ExternalAiRelayService();
      
      const systemPrompt = `You are a professional software architect.
Your job is to extract code guidelines, architectural decisions, tool constraints, or package settings resolved during the session.
Format the output as a concise markdown list of rules.
Avoid duplicate or generic rules (e.g. "Write clean code"). Focus on specific decisions made in this session.
Do not include any explanation or intro text. Output ONLY the list items (starting with '-').`;

      const prompt = `Here is the conversation log summary of the session:
---
${transcriptSummary}
---

Please extract any new project rules, code guidelines, tool usage constraints, or workspace behaviors resolved in this session.
Return only the markdown list items.`;

      const result = await relayService.execute({
        provider: 'gemini',
        task: 'chat',
        prompt,
        systemPrompt,
      });

      if (!result || !result.rawResponse) {
        logger.warn('[Knowledge Distiller] LLM returned empty response.');
        return false;
      }

      const distilledRules = result.rawResponse.trim();
      if (!distilledRules.startsWith('-')) {
        logger.info('[Knowledge Distiller] No new distinct rules distilled.');
        return false;
      }

      // Merge into KNOWLEDGE.md
      let originalContent = '';
      if (fs.existsSync(this.knowledgePath)) {
        originalContent = fs.readFileSync(this.knowledgePath, 'utf-8');
      }

      let updatedContent = originalContent;
      const sectionHeader = '## Distilled Rules from Recent Runs';

      if (updatedContent.includes(sectionHeader)) {
        // Append under existing section
        const parts = updatedContent.split(sectionHeader);
        updatedContent = `${parts[0]}${sectionHeader}\n${distilledRules}\n${parts[1] || ''}`;
      } else {
        // Create new section
        updatedContent = `${updatedContent.trim()}\n\n${sectionHeader}\n${distilledRules}\n`;
      }

      fs.writeFileSync(this.knowledgePath, updatedContent.trim() + '\n', 'utf-8');
      logger.info(`[Knowledge Distiller] Distilled rules written to ${this.knowledgePath}`);
      return true;

    } catch (error) {
      logger.error(`[Knowledge Distiller] Failed to distill knowledge: ${error}`);
      return false;
    }
  }
}
