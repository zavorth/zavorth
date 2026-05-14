import { ToolRegistry } from '../src/tools/ToolRegistry.js';
import { WebSearchTool } from '../src/tools/WebSearchTool.js';
import { CreateFileTool } from '../src/tools/CreateFileTool.js';
import { ReadFileTool } from '../src/tools/ReadFileTool.js';
import { ListDirectoryTool } from '../src/tools/ListDirectoryTool.js';
import { DateTimeTool } from '../src/tools/DateTimeTool.js';
import { RemoteShellTool } from '../src/tools/RemoteShellTool.js';
import { QueryExternalAiTool } from '../src/tools/QueryExternalAiTool.js';
import { SandboxExecutionTool } from '../src/tools/SandboxExecutionTool.js';
import { Mem0Tool } from '../src/tools/Mem0Tool.js';
import { DesktopAutomationTool } from '../src/tools/DesktopAutomationTool.js';
import { ZavorthMcpServer } from '../src/mcp/ZavorthMcpServer.js';
import { McpToolPolicy } from '../src/mcp/McpToolPolicy.js';

function redirectConsoleToStderrForMcpStdio() {
  console.log = (...args: unknown[]) => console.error(...args);
  console.info = (...args: unknown[]) => console.error(...args);
}

async function bootstrapMcpServer() {
  redirectConsoleToStderrForMcpStdio();
  console.error('[BOOT] Initializing Zavorth Universal MCP Server...');

  // Initialize the Tool Registry with all available tools
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(new WebSearchTool());
  toolRegistry.register(new CreateFileTool());
  toolRegistry.register(new ReadFileTool());
  toolRegistry.register(new ListDirectoryTool());
  toolRegistry.register(new DateTimeTool());
  toolRegistry.register(new RemoteShellTool());
  toolRegistry.register(new QueryExternalAiTool());
  toolRegistry.register(new SandboxExecutionTool());
  toolRegistry.register(new Mem0Tool());
  toolRegistry.register(new DesktopAutomationTool());

  console.error(`[BOOT] Registered ${toolRegistry.getAllTools().length} tools into the registry.`);

  // Instantiate and run the MCP Server over Stdio
  const toolPolicy = McpToolPolicy.fromEnv();
  console.error(`[BOOT] MCP security profile: ${toolPolicy.profile}`);

  const server = new ZavorthMcpServer(toolRegistry, { toolPolicy });
  
  await server.start();
  
  console.error('[BOOT] Zavorth Universal MCP Server is now listening on stdio.');
}

bootstrapMcpServer().catch((err) => {
  console.error('[FATAL] Zavorth MCP Server encountered a fatal error:', err);
  process.exit(1);
});
