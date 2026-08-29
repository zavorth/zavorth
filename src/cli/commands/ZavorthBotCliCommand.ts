import { PersonaRegistryService } from '../../runtime/agent/roster/PersonaRegistryService.js';
import { DynamicPersonaCompilerService } from '../../runtime/agent/roster/DynamicPersonaCompilerService.js';
import { EnsemblePersonaTaskRunner } from '../../runtime/agent/roster/EnsemblePersonaTaskRunner.js';
import { LlmRuntimeService } from '../../services/llm/LlmRuntimeService.js';
import type { PersonaTaskRunner } from '../../runtime/agent/roster/PersonaTaskRunnerContract.js';
import type { CliExecutionResult, CliWriter, ZavorthCliFlags } from '../ZavorthCliContract.js';
import { logger } from '../../logger.js';

export interface ZavorthBotCliCommandDeps {
  personaRegistryService?: PersonaRegistryService;
  dynamicCompilerService?: DynamicPersonaCompilerService;
  personaRunner?: PersonaTaskRunner;
}

export async function handleZavorthBotCliCommand(input: {
  commandName: string | null;
  args: string;
  flags: ZavorthCliFlags;
  writer: CliWriter;
  deps?: ZavorthBotCliCommandDeps;
}): Promise<CliExecutionResult | null> {
  if (String(input.commandName || '').trim().toLowerCase() !== 'bot') {
    return null;
  }

  const registry = input.deps?.personaRegistryService || new PersonaRegistryService();
  const compiler = input.deps?.dynamicCompilerService || new DynamicPersonaCompilerService();
  const runner = input.deps?.personaRunner || new EnsemblePersonaTaskRunner(null, new LlmRuntimeService());

  const tokens = String(input.args || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const subcommand = String(tokens[0] || '').trim().toLowerCase();
  const subArgs = tokens.slice(1).join(' ').trim();

  switch (subcommand) {
    case 'list':
      return handleList(registry, input.writer);
    case 'create':
      return handleCreate(registry, compiler, subArgs, input.writer);
    case 'inspect':
      return handleInspect(registry, subArgs, input.writer);
    case 'chat':
      return handleChat(registry, runner, subArgs, input.flags.sessionId, input.writer);
    default:
      return printUsage(input.writer);
  }
}

async function handleList(registry: PersonaRegistryService, writer: CliWriter): Promise<CliExecutionResult> {
  await registry.initialize();
  const personas = registry.listPersonas();

  if (personas.length === 0) {
    const body = 'No personas currently registered. Create one using: zavorth bot create <intent>';
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  const lines = [
    'Zavorth Autonomous Personas Roster',
    '',
    ...personas.map((p) => {
      const modeBadge = p.isolationMode === 'docker' ? 'docker' : 'direct';
      const passiveBadge = p.passiveInspectionEnabled ? 'observer' : 'task';
      return `• @${p.id} (${p.name}) — ${p.role}\n  Mode: ${modeBadge} | ${passiveBadge} | Tools: ${p.allowedTools?.length ?? 'all'}`;
    }),
    '',
    'Use: zavorth bot inspect <id> for details.',
  ];
  const body = lines.join('\n');
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

async function handleCreate(
  registry: PersonaRegistryService,
  compiler: DynamicPersonaCompilerService,
  intentDescription: string,
  writer: CliWriter,
): Promise<CliExecutionResult> {
  if (!intentDescription) {
    const body = 'Usage: zavorth bot create <intent>\nExample: zavorth bot create SQL database optimizer for slow postgres queries';
    writer.error(body);
    return { ok: false, handled: true, output: [body], error: body };
  }

  await registry.initialize();
  try {
    const compiled = await compiler.compileFromIntent({ userIntent: intentDescription });
    const persona = await registry.registerPersona(compiled);
    const body = [
      `Persona Created: @${persona.id}`,
      '',
      `- Name: ${persona.name}`,
      `- Role: ${persona.role}`,
      `- Isolation Mode: ${persona.isolationMode}`,
      `- Allowed Tools: ${persona.allowedTools && persona.allowedTools.length > 0 ? persona.allowedTools.join(', ') : 'All Workspace Tools'}`,
      '',
      `Invoke by typing: @${persona.id} <your task> or zavorth bot chat ${persona.id} <your task>`,
    ].join('\n');
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[Zavorth Bot CLI] failed to create persona from intent`, error);
    const body = `Failed to create persona: ${message}`;
    writer.error(body);
    return { ok: false, handled: true, output: [body], error: body };
  }
}

async function handleInspect(registry: PersonaRegistryService, rawId: string, writer: CliWriter): Promise<CliExecutionResult> {
  if (!rawId) {
    const body = 'Usage: zavorth bot inspect <id>';
    writer.error(body);
    return { ok: false, handled: true, output: [body], error: body };
  }

  await registry.initialize();
  const persona = registry.getPersona(rawId);
  if (!persona) {
    const body = `Persona @${rawId} not found in the roster.`;
    writer.error(body);
    return { ok: false, handled: true, output: [body], error: body };
  }

  const body = [
    `Persona Details: @${persona.id}`,
    '',
    `- Name: ${persona.name}`,
    `- Role: ${persona.role}`,
    `- Avatar: ${persona.avatar}`,
    `- Isolation Mode: ${persona.isolationMode}`,
    `- Passive Inspection: ${persona.passiveInspectionEnabled ? 'Active' : 'Disabled'}`,
    `- Allowed Domains: ${persona.allowedDomains && persona.allowedDomains.length > 0 ? persona.allowedDomains.map((d) => `\`${d}\``).join(', ') : 'None'}`,
    `- Allowed Tools: ${persona.allowedTools && persona.allowedTools.length > 0 ? persona.allowedTools.map((t) => `\`${t}\``).join(', ') : 'Default Workspace Tools'}`,
    '',
    'System Prompt Instructions:',
    '---',
    persona.systemPrompt,
    '---',
  ].join('\n');
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

async function handleChat(
  registry: PersonaRegistryService,
  runner: PersonaTaskRunner,
  args: string,
  sessionId: string,
  writer: CliWriter,
): Promise<CliExecutionResult> {
  const tokens = String(args || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const targetId = String(tokens[0] || '').trim().toLowerCase();
  const prompt = tokens.slice(1).join(' ').trim();

  if (!targetId || !prompt) {
    const body = 'Usage: zavorth bot chat <id> <prompt>\nExample: zavorth bot chat executor write tests for auth module';
    writer.error(body);
    return { ok: false, handled: true, output: [body], error: body };
  }

  await registry.initialize();
  const persona = registry.getPersona(targetId);
  if (!persona) {
    const body = `Persona @${targetId} not found.`;
    writer.error(body);
    return { ok: false, handled: true, output: [body], error: body };
  }

  try {
    const result = await runner.runPersonaTask({
      persona,
      prompt,
      sessionId: sessionId || null,
    });
    if (result.ok) {
      const body = `[Persona: @${persona.id} (${persona.role})]\n${result.output}`;
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    const body = `Persona @${persona.id} failed to dispatch: ${result.error || 'unknown error'}`;
    writer.error(body);
    return { ok: false, handled: true, output: [body], error: body };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[Zavorth Bot CLI] persona task runner threw for @${persona.id}`, error);
    const body = `Persona @${persona.id} failed to dispatch: ${message}`;
    writer.error(body);
    return { ok: false, handled: true, output: [body], error: body };
  }
}

function printUsage(writer: CliWriter): CliExecutionResult {
  const body = [
    'Zavorth Bot Command Reference',
    '',
    '  zavorth bot list               List all registered personas in the roster',
    '  zavorth bot create <intent>    Synthesize and register a new persona from natural language',
    '  zavorth bot inspect <id>       View detailed configuration and system prompt of a persona',
    '  zavorth bot chat <id> <prompt> Dispatch a prompt directly to a specialized persona',
  ].join('\n');
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}
