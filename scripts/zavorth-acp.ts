import { ZavorthAcpServer } from '../src/acp/ZavorthAcpServer.js';
import { buildDefaultManifest } from '../src/acp/AcpServerManifest.js';

function redirectConsoleToStderr() {
  console.log = (...args: unknown[]) => console.error(...args);
  console.info = (...args: unknown[]) => console.error(...args);
}

async function bootstrapAcpServer() {
  redirectConsoleToStderr();
  console.error('[BOOT] Initializing Zavorth ACP Server...');

  const manifest = buildDefaultManifest('zavorth-acp');

  const server = new ZavorthAcpServer({
    manifest,
    onToolCall: async (name, args) => {
      console.error(`[TOOL] ${name} called with: ${JSON.stringify(args).slice(0, 200)}`);
      return `[Zavorth ACP] Tool "${name}" received. Connect to the full Zavorth runtime for live execution.`;
    },
  });

  const snapshot = server.getSnapshot();
  console.error(`[BOOT] Server ID: ${snapshot.serverId}`);
  console.error(`[BOOT] Tools: ${snapshot.toolsRegistered.join(', ')}`);
  console.error(`[BOOT] Capabilities: ${snapshot.capabilities.join(', ')}`);
  console.error('[BOOT] Zavorth ACP Server is now listening on stdio.');

  await server.start();

  console.error('[BOOT] Zavorth ACP Server stopped.');
}

bootstrapAcpServer().catch((err) => {
  console.error('[FATAL] Zavorth ACP Server encountered a fatal error:', err);
  process.exit(1);
});
