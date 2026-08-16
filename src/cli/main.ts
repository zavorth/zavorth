#!/usr/bin/env node
/**
 * Zavorth CLI Modern Main Entry Point.
 * Bootstraps the full universal LLM runtime, adapter registry, configuration, and launches the interactive or headless CLI.
 */

import { AdapterRegistry } from '../adapters/llm/AdapterRegistry.js';
import { OpenAICompatibleAdapter } from '../adapters/llm/providers/OpenAICompatibleAdapter.js';
import { AnthropicAdapter } from '../adapters/llm/providers/AnthropicAdapter.js';
import { GoogleGenAiAdapter } from '../adapters/llm/providers/GoogleGenAiAdapter.js';
import { AgentLLMRuntime } from '../runtime/agent/AgentLLMRuntime.js';
import { ZavorthCli } from './ZavorthCli.js';
import { loadConfig } from '../core/config/index.js';

export async function bootstrapZavorthCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const config = loadConfig();

  const registry = new AdapterRegistry();
  registry.register(new AnthropicAdapter(), false);
  registry.register(new OpenAICompatibleAdapter({ id: 'openai', name: 'OpenAI Engine' }), false);
  registry.register(new GoogleGenAiAdapter(), false);
  registry.register(new OpenAICompatibleAdapter({ id: 'openai-compatible', name: 'Generic OpenAI-Compatible' }), true);

  const defaultAdapter = registry.getDefault();
  const llmRuntime = new AgentLLMRuntime({ registry });

  const cli = new ZavorthCli({
    config,
    llmAdapter: defaultAdapter || undefined,
    llmRuntime,
  });

  return cli.run(argv);
}

// Direct execution guard
if (process.argv[1] && process.argv[1].endsWith('main.js')) {
  bootstrapZavorthCli()
    .then((code) => {
      process.exit(code);
    })
    .catch((err) => {
      console.error('Fatal CLI Error:', err);
      process.exit(1);
    });
}
