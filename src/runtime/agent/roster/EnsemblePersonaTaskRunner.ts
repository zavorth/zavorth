import { ZavorthEnsembleService } from '../../../agents/ZavorthEnsembleService.js';
import type { SwarmRole } from '../../sessions/v2/SwarmOrchestrator.js';
import type { PersonaIsolationMode } from './PersonaContract.js';
import type { PersonaTaskRunner, PersonaTaskRunnerInput, PersonaTaskRunnerResult } from './PersonaTaskRunnerContract.js';

const ISOLATED_MODES: ReadonlySet<PersonaIsolationMode> = new Set([
  'docker',
  'external-sandbox',
  'wsl',
]);

export class EnsemblePersonaTaskRunner implements PersonaTaskRunner {
  private readonly ensemble: ZavorthEnsembleService;

  constructor(ensemble?: ZavorthEnsembleService | null) {
    this.ensemble = ensemble || new ZavorthEnsembleService();
  }

  public async runPersonaTask(input: PersonaTaskRunnerInput): Promise<PersonaTaskRunnerResult> {
    const prompt = String(input.prompt || '').trim();
    if (!prompt) {
      return { ok: false, output: '', error: 'Persona task prompt cannot be empty.' };
    }

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
