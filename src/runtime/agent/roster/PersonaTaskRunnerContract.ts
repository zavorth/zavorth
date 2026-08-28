import type { Persona } from './PersonaContract.js';

export interface PersonaTaskRunnerInput {
  persona: Persona;
  prompt: string;
  sessionId?: string | null;
}

export interface PersonaTaskRunnerResult {
  ok: boolean;
  output: string;
  error?: string | null;
}

export interface PersonaTaskRunner {
  runPersonaTask(input: PersonaTaskRunnerInput): Promise<PersonaTaskRunnerResult>;
}
