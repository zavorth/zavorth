import { ZavorthEnsembleService } from '../../../agents/ZavorthEnsembleService.js';
import type { LlmRuntimeService } from '../../../services/llm/LlmRuntimeService.js';
import type { ChatMessage } from '../../../providers/ILlmProvider.js';
import type { SwarmRole } from '../../sessions/v2/SwarmOrchestrator.js';
import type { PersonaIsolationMode } from './PersonaContract.js';
import type { PersonaTaskRunner, PersonaTaskRunnerInput, PersonaTaskRunnerResult } from './PersonaTaskRunnerContract.js';

const ISOLATED_MODES = new Set<PersonaIsolationMode>([
  'docker',
  'external-sandbox',
  'wsl',
]);

type PersonaLlmRuntime = Pick<LlmRuntimeService, 'chatDetailed'>;

/**
 * Dispatches a persona prompt through the central LLM runtime (LlmRuntimeService
 * chatDetailed pipeline: provider fallback chain, egress guard, telemetry) and
 * only falls back to Ensemble swarm delegation when no LLM runtime is injected.
 * LLM failures surface as honest typed errors instead of silent shell fallbacks.
 */
export class EnsemblePersonaTaskRunner implements PersonaTaskRunner {
  private readonly ensemble: ZavorthEnsembleService;
  private readonly llmRuntime: PersonaLlmRuntime | null;

  constructor(
    ensemble?: ZavorthEnsembleService | null,
    llmRuntime?: PersonaLlmRuntime | null,
  ) {
    this.ensemble = ensemble || new ZavorthEnsembleService();
    this.llmRuntime = llmRuntime || null;
  }

  public async runPersonaTask(input: PersonaTaskRunnerInput): Promise<PersonaTaskRunnerResult> {
    const prompt = String(input.prompt || '').trim();
    if (!prompt) {
      return { ok: false, output: '', error: 'Persona task prompt cannot be empty.' };
    }

    if (this.llmRuntime) {
      return this.runWithLlm(input, prompt);
    }

    return this.runWithSwarm(input, prompt);
  }

  private async runWithLlm(
    input: PersonaTaskRunnerInput,
    prompt: string,
  ): Promise<PersonaTaskRunnerResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: input.persona.systemPrompt },
      { role: 'user', content: prompt },
    ];

    try {
      const result = await this.llmRuntime!.chatDetailed(messages, [], {
        telemetry: {
          surface: 'persona-task-runner',
          runId: `persona:${input.persona.id}`,
          traceId: `persona:${input.persona.id}`,
          sessionId: input.sessionId ?? null,
        },
      });

      const output = result.response.content?.trim() || '';
      if (!output) {
        return { ok: false, output: '', error: `Persona @${input.persona.id} received an empty LLM response.` };
      }

      return { ok: true, output };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, output: '', error: `Persona @${input.persona.id} LLM dispatch failed: ${message}` };
    }
  }

  private async runWithSwarm(
    input: PersonaTaskRunnerInput,
    prompt: string,
  ): Promise<PersonaTaskRunnerResult> {
    const role: SwarmRole = {
      id: input.persona.id,
      label: `${input.persona.name} (@${input.persona.id})`,
      systemPrompt: input.persona.systemPrompt,
      isolation: {
        mode: this.resolveIsolationMode(input.persona.isolationMode),
        description: `Persona ${input.persona.id} governed execution`,
      },
    };

    try {
      const snapshot = this.ensemble.launchSwarm({
        objective: prompt,
        roles: [role],
        isolationMode: input.persona.isolationMode,
      });
      return {
        ok: true,
        output: `Persona @${input.persona.id} delegated to Zavorth Ensemble (swarm ${snapshot.swarmId}). Status: ${snapshot.status}.`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, output: '', error: message };
    }
  }

  private resolveIsolationMode(mode: PersonaIsolationMode): 'direct' | 'temp-worktree' | 'docker' | 'wsl' | 'external-sandbox' {
    return ISOLATED_MODES.has(mode) ? mode : 'direct';
  }
}
