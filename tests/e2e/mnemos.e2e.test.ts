import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const runE2e = process.env.ZAVORTH_RUN_MNEMOS_E2E === '1';
const maybeIt = runE2e ? it : it.skip;

function hasDocker(): boolean {
  try {
    execFileSync('docker', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('Mnemos MCP E2E', () => {
  maybeIt('builds, connects, scans, indexes and searches through Docker MCP', async () => {
    if (!hasDocker()) {
      console.warn('[mnemos-e2e] Docker unavailable; skipping real E2E body.');
      return;
    }

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mnemos-e2e-'));
    const vault = path.join(root, 'vault');
    const db = path.join(root, 'db');
    const scan = path.join(root, 'scan');
    fs.mkdirSync(vault, { recursive: true });
    fs.mkdirSync(db, { recursive: true });
    fs.mkdirSync(scan, { recursive: true });
    const sourcePath = path.join(scan, 'echo-memory-note.md');
    fs.writeFileSync(sourcePath, 'Echo lembra que Mnemos indexa memoria local com seguranca.', 'utf8');

    execFileSync('docker', ['build', '-t', 'mnemos-cognitive-engine:latest', 'apps/mnemos'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      timeout: 10 * 60 * 1000,
    });

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['scripts/start-mnemos-mcp.mjs'],
      env: {
        ...process.env,
        MNEMOS_CONTAINER_NAME: `mnemos-e2e-${Date.now()}`,
        MNEMOS_VAULT_DIR: vault,
        MNEMOS_DB_DIR: db,
        MNEMOS_SCAN_DIRS: scan,
      },
    });
    const client = new Client({ name: 'zavorth-mnemos-e2e', version: '1.0.0' }, { capabilities: {} });

    try {
      await client.connect(transport);
      const status = await client.callTool({ name: 'vault_status', arguments: {} });
      expect(JSON.stringify(status.content)).toContain('total_documents');

      const scanResult = await client.callTool({
        name: 'scan_local_metadata',
        arguments: { keywords: ['echo'] },
      });
      expect(JSON.stringify(scanResult.content)).toContain('echo-memory-note.md');

      const understandingResult = await client.callTool({
        name: 'understand_file',
        arguments: { file_path: '/scan_volumes/0/echo-memory-note.md' },
      });
      expect(JSON.stringify(understandingResult.content)).toContain('mnemos-universal-file-understanding');

      const indexResult = await client.callTool({
        name: 'index_file',
        arguments: { file_path: '/scan_volumes/0/echo-memory-note.md' },
      });
      expect(JSON.stringify(indexResult.content)).toContain('success');

      const searchResult = await client.callTool({
        name: 'search_memory',
        arguments: { query: 'memoria local segura' },
      });
      expect(JSON.stringify(searchResult.content)).toContain('hits');
    } finally {
      await transport.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 15 * 60 * 1000);
});
