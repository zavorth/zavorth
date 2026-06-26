# ACP Server (IDE Integration)

Zavorth includes a built-in ACP (Agent Client Protocol) server that allows IDEs like VS Code, Zed, and JetBrains to connect as AI assistants.

## What It Does

The ACP server exposes Zavorth's capabilities over the Agent Client Protocol, enabling:

- **Code assistance** — read, search, and analyze files from within the IDE
- **File operations** — read, write, edit files with approval gates
- **Shell execution** — run commands with security policies
- **Web search** — search the web for documentation and references

## Quick Start

### Start the ACP Server

```bash
# Via npm script
npx tsx scripts/zavorth-acp.ts

# Or via zavorth CLI
zavorth acp start
```

The server listens on **stdio** using newline-delimited JSON-RPC.

### Configure VS Code

Add to `.vscode/settings.json`:

```json
{
  "zavorth.acp.enabled": true,
  "zavorth.acp.serverCommand": "npx tsx scripts/zavorth-acp.ts"
}
```

### Configure Zed

Add to `~/.config/zed/settings.json`:

```json
{
  "agent_servers": [
    {
      "name": "Zavorth",
      "command": "npx",
      "args": ["tsx", "scripts/zavorth-acp.ts"]
    }
  ]
}
```

## Protocol

The ACP server uses JSON-RPC 2.0 over stdio. The protocol sequence is:

```
1. Initialize
   Client → Server: {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"vscode"}}}
   Server → Client: {"jsonrpc":"2.0","id":1,"result":{"serverInfo":{"name":"Zavorth ACP Server"},"capabilities":{...}}}

2. Start Session
   Client → Server: {"jsonrpc":"2.0","id":2,"method":"session/start","params":{"sessionId":"...","cwd":"/path"}}
   Server → Client: {"jsonrpc":"2.0","id":2,"result":{"sessionId":"...","status":"started"}}

3. Send Message
   Client → Server: {"jsonrpc":"2.0","id":3,"method":"message/send","params":{"sessionId":"...","content":"explain this code"}}
   Server → Client: {"jsonrpc":"2.0","method":"message/event","params":{"type":"text","content":"This code..."}}
   Server → Client: {"jsonrpc":"2.0","id":3,"result":{"status":"completed"}}

4. End Session
   Client → Server: {"jsonrpc":"2.0","id":4,"method":"session/end","params":{"sessionId":"..."}}
```

## Available Tools

| Tool | Description | Approval Required |
|------|-------------|-------------------|
| `Read` | Read file contents | No |
| `Glob` | Find files by pattern | No |
| `Grep` | Search file contents | No |
| `LS` | List directory contents | No |
| `Write` | Write file contents | Yes |
| `Edit` | Edit file contents | Yes |
| `Bash` | Execute shell command | Yes |
| `WebSearch` | Search the web | No |

Tools requiring approval will prompt the user before execution.

## API Reference

### Server Options

```typescript
import { ZavorthAcpServer } from '../src/acp/ZavorthAcpServer.js';

const server = new ZavorthAcpServer({
  manifest: customManifest,  // optional, uses default if not provided
  onToolCall: async (name, args) => {
    // Custom tool handler
    return `Result for ${name}`;
  },
});
```

### Manifest

```typescript
import { buildDefaultManifest } from '../src/acp/AcpServerManifest.js';

const manifest = buildDefaultManifest('my-server');
// manifest.serverId, manifest.serverName, manifest.entries[0].tools
```

### Snapshot

```typescript
const snapshot = server.getSnapshot();
// {
//   contractVersion: '...',
//   generatedAt: '...',
//   serverId: 'zavorth-acp',
//   status: 'listening',
//   activeSessions: 0,
//   totalSessions: 5,
//   toolsRegistered: ['Read', 'Write', 'Bash', ...],
//   capabilities: ['chat', 'tools', 'filesystem', ...],
// }
```

## Security

- Tools requiring approval (`Write`, `Edit`, `Bash`) prompt the user before execution
- The server integrates with Zavorth's security policy engine
- All tool calls are logged in the session receipt
- The server runs with the same security constraints as the CLI

## Architecture

```
IDE (VS Code/Zed/JetBrains)
  ↓ stdio (JSON-RPC)
ZavorthAcpServer
  ↓ tool dispatch
ToolRegistry → ToolExecutor
  ↓
Runtime (filesystem, shell, web)
```

The ACP server follows the same pattern as the MCP server (`scripts/zavorth-mcp.ts`) but uses the Agent Client Protocol instead of Model Context Protocol.

## Testing

```bash
npx jest tests/acp/ZavorthAcpServer.test.ts
```

12 tests covering manifest, lifecycle, initialize, session management, tool listing, message handling, and error cases.

## Comparison with MCP

| Feature | ACP Server | MCP Server |
|---------|-----------|------------|
| Protocol | Agent Client Protocol | Model Context Protocol |
| Purpose | IDE integration | External tool integration |
| Transport | Stdio JSON-RPC | Stdio JSON-RPC |
| Tool Discovery | `tools/list` | `ListToolsRequest` |
| Tool Execution | `message/send` | `CallToolRequest` |
| Approval Gates | Integrated | Via `McpToolPolicy` |
