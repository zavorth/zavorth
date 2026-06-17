import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('zavorth-mcp-install safe CLI', () => {
  let root: string;
  let manifestPath: string;
  let policyPath: string;
  let discoveryPath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-safe-mcp-cli-'));
    manifestPath = path.join(root, 'mcp-servers.json');
    policyPath = path.join(root, 'mcp-tool-policy.json');
    discoveryPath = path.join(root, 'discovery.json');
    fs.writeFileSync(manifestPath, '[]', 'utf8');
    fs.writeFileSync(policyPath, JSON.stringify({ version: 1, updatedAt: null, profile: 'safe', allowlist: [], tools: {} }), 'utf8');
    fs.writeFileSync(discoveryPath, JSON.stringify({
      tools: [{ name: 'search', description: 'Search', inputSchema: { type: 'object' }, risk: 'safe' }],
      stdout: 'Authorization Bearer secret',
      stderr: '',
    }), 'utf8');
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  function run(args: string[]) {
    const script = path.resolve('scripts/zavorth-mcp-install.ts');
    return execSync(`npx tsx "${script}" ${args.map((arg) => `"${arg}"`).join(' ')}`, {
      env: {
        ...process.env,
        ZAVORTH_MCP_SERVERS_MANIFEST_PATH: manifestPath,
        ZAVORTH_MCP_TOOL_POLICY_PATH: policyPath,
      },
      encoding: 'utf8',
    });
  }

  it('install creates a governed candidate and does not approve tools', () => {
    const stdout = run([
      'install',
      'docs',
      '--command',
      'node',
      '--args',
      'server.js',
      '--discovery-fixture',
      discoveryPath,
      '--confirm-install',
      '--json',
    ]);

    const parsed = JSON.parse(stdout);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

    expect(parsed.ok).toBe(true);
    expect(parsed.tools[0].namespacedToolId).toBe('docs:search');
    expect(manifest[0]).toEqual(expect.objectContaining({ id: 'docs', enabled: false }));
    expect(policy.allowlist).toEqual([]);
    expect(policy.tools['docs:search'].status).toBe('pending_approval');
    expect(stdout).not.toMatch(/Authorization|Bearer|secret/);
  });
});
