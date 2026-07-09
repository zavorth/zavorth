#!/usr/bin/env node
import { asErrorLike } from '../src/utils/errorLike';
/**
 * Zavorth ACP Server — Runtime Bridge
 *
 * Connects the ACP server to the live Zavorth runtime,
 * enabling real tool execution via the AgentRunService pipeline.
 *
 * Usage: npx tsx scripts/zavorth-acp-runtime.ts
 */

import { config } from '../src/config/index.js';
import { ZavorthAcpServer } from '../src/acp/ZavorthAcpServer.js';
import { ToolRegistry } from '../src/tools/ToolRegistry.js';
import { LogRepository } from '../src/storage/LogRepository.js';
import { ToolExecutor } from '../src/execution/ToolExecutor.js';

function redirectConsoleToStderr() {
  console.log = (...args: unknown[]) => console.error(...args);
  console.info = (...args: unknown[]) => console.error(...args);
}

async function bootstrapAcpRuntimeServer() {
  redirectConsoleToStderr();
  console.error('[BOOT] Initializing Zavorth ACP Runtime Server...');

  // Initialize the tool registry with all available tools
  const toolRegistry = new ToolRegistry();

  // Register core tools
  const toolModules = [
    '../src/tools/ReadFileTool.js',
    '../src/tools/CreateFileTool.js',
    '../src/tools/ListDirectoryTool.js',
    '../src/tools/WebSearchTool.js',
    '../src/tools/DateTimeTool.js',
    '../src/tools/RemoteShellTool.js',
    '../src/tools/QueryExternalAiTool.js',
    '../src/tools/SandboxExecutionTool.js',
  ];

  for (const mod of toolModules) {
    try {
      const imported = await import(mod);
      const ToolClass = imported.default || imported[Object.keys(imported).find((k) => k.endsWith('Tool')) || ''];
      if (ToolClass) {
        toolRegistry.register(new ToolClass());
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error(`[BOOT] Failed to load tool ${mod}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const toolCount = toolRegistry.getAllTools().length;
  console.error(`[BOOT] Registered ${toolCount} tools.`);

  // Initialize the tool executor with security pipeline
  const logRepository = new LogRepository();
  await logRepository.init();
  const toolExecutor = new ToolExecutor(toolRegistry, logRepository);

  // Create the ACP server with live tool execution
  const server = new ZavorthAcpServer({
    onToolCall: async (name: string, args: Record<string, unknown>) => {
      console.error(`[TOOL] Executing: ${name} with ${JSON.stringify(args).slice(0, 200)}`);
      try {
        const result = await toolExecutor.executeTool(name, args);
        console.error(`[TOOL] ${name} completed successfully`);
        return result;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[TOOL] ${name} failed: ${error}`);
        throw err;
      }
    },
  });

  const snapshot = server.getSnapshot();
  console.error(`[BOOT] Server ID: ${snapshot.serverId}`);
  console.error(`[BOOT] Tools: ${snapshot.toolsRegistered.join(', ')}`);
  console.error(`[BOOT] Capabilities: ${snapshot.capabilities.join(', ')}`);
  console.error('[BOOT] Zavorth ACP Runtime Server is now listening on stdio.');
  console.error('[BOOT] Tools execute through the full Zavorth security pipeline.');

  await server.start();

  console.error('[BOOT] Zavorth ACP Runtime Server stopped.');
}

bootstrapAcpRuntimeServer().catch((err) => {
  console.error('[FATAL] Zavorth ACP Runtime Server encountered a fatal error:', err);
  process.exit(1);
});
