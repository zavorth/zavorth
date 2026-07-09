import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { asErrorLike } from '../../src/utils/errorLike';

describe('zavorth-mcp-install.ts CLI Script', () => {
  let tempDir: string;
  let manifestPath: string;
  let policyPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mcp-install-test-'));
    manifestPath = path.join(tempDir, 'mcp-servers.json');
    policyPath = path.join(tempDir, 'mcp-tool-policy.json');

    // Init files
    fs.writeFileSync(manifestPath, '[]', 'utf8');
    fs.writeFileSync(
      policyPath,
      JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        profile: 'safe',
        allowlist: [],
        tools: {},
      }, null, 2),
      'utf8',
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function runCli(args: string[]): { stdout: string; stderr: string; code: number } {
    const scriptPath = path.resolve('scripts/zavorth-mcp-install.ts');
    // Using npx tsx to execute síncronamente
    const env = {
      ...process.env,
      ZAVORTH_MCP_SERVERS_MANIFEST_PATH: manifestPath,
      ZAVORTH_MCP_TOOL_POLICY_PATH: policyPath,
    };
    try {
      const stdout = execSync(`npx tsx "${scriptPath}" ${args.join(' ')}`, { env, stdio: 'pipe' }).toString();
      return { stdout, stderr: '', code: 0 };
    } catch (error: unknown) {
      const err = asErrorLike(error);

      return {
        stdout: err.stdout ? err.stdout.toString() : '',
        stderr: err.stderr ? err.stderr.toString() : err.message,
        code: err.status || 1,
      };
    }
  }

  it('lists empty servers and tools by default', () => {
    const { stdout, code } = runCli(['list']);
    expect(code).toBe(0);
    expect(stdout).toContain('Nenhum servidor MCP registrado');
    expect(stdout).toContain('Nenhuma ferramenta registrada na politica');
  });

  it('lists in JSON format and contains effectiveAllowed', () => {
    // Write a pending and an approved tool to policy file
    const doc = {
      version: 1,
      updatedAt: new Date().toISOString(),
      profile: 'safe',
      allowlist: ['serverA:approved_tool'],
      tools: {
        'serverA:approved_tool': {
          status: 'approved',
          fingerprint: '1111111111111111111111111111111111111111111111111111111111111111',
          description: 'Approved',
        },
        'serverA:pending_tool': {
          status: 'pending_approval',
          fingerprint: '2222222222222222222222222222222222222222222222222222222222222222',
          pendingReason: 'new_tool',
        },
      },
    };
    fs.writeFileSync(policyPath, JSON.stringify(doc), 'utf8');

    const { stdout, code } = runCli(['list', '--json']);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);

    const approved = parsed.tools.find((t: any) => t.id === 'serverA:approved_tool');
    const pending = parsed.tools.find((t: any) => t.id === 'serverA:pending_tool');

    expect(approved.effectiveAllowed).toBe(true);
    expect(approved.inAllowlist).toBe(true);

    expect(pending.effectiveAllowed).toBe(false);
    expect(pending.inAllowlist).toBe(false);
  });

  it('adds server to manifest successfully', () => {
    const { stdout, code } = runCli(['add', 'myserver', '--command', 'node', '--args', 'index.js', '--persist-env-values']);
    expect(code).toBe(0);
    expect(stdout).toContain('adicionado ao manifesto com sucesso');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest).toHaveLength(1);
    expect(manifest[0]).toMatchObject({
      id: 'myserver',
      command: 'node',
      args: ['index.js'],
    });
  });

  it('add command rejects invalid serverId formats', () => {
    const res1 = runCli(['add', 'server:with-colon', '--command', 'node']);
    expect(res1.code).toBe(1);
    expect(res1.stderr).toContain('ID de servidor invalido');

    const res2 = runCli(['add', '"server with spaces"', '--command', 'node']);
    expect(res2.code).toBe(1);
    expect(res2.stderr).toContain('ID de servidor invalido');
  });

  it('add command rejects env variables without persist flag', () => {
    const res = runCli(['add', 'myserver', '--command', 'node', '--env', 'API_KEY=secret']);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain('WARNING: Gravar segredos diretamente no manifesto nao e recomendado');
  });

  it('add command supports allowed-env flag', () => {
    const res = runCli(['add', 'myserver', '--command', 'node', '--allowed-env', 'PATH,GEMINI_API_KEY']);
    expect(res.code).toBe(0);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest[0].allowedEnv).toEqual(['PATH', 'GEMINI_API_KEY']);
  });

  it('approves tool and adds to allowlist', () => {
    // Put a pending tool in policy
    const fp = '1111111111111111111111111111111111111111111111111111111111111111';
    const doc = {
      version: 1,
      updatedAt: new Date().toISOString(),
      profile: 'safe',
      allowlist: [],
      tools: {
        'serverA:mytool': {
          status: 'pending_approval',
          fingerprint: fp,
          lastSeenDescription: 'Original Pending Desc',
          pendingReason: 'new_tool',
        },
      },
    };
    fs.writeFileSync(policyPath, JSON.stringify(doc), 'utf8');

    const { stdout, code } = runCli(['approve', 'serverA:mytool']);
    expect(code).toBe(0);
    expect(stdout).toContain('aprovada com sucesso');

    const updated = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    expect(updated.tools['serverA:mytool'].status).toBe('approved');
    expect(updated.tools['serverA:mytool'].description).toBe('Original Pending Desc');
    expect(updated.tools['serverA:mytool'].pendingReason).toBeUndefined();
    expect(updated.allowlist).toContain('serverA:mytool');
  });

  it('approve rejects toolId without namespace', () => {
    const { stderr, code } = runCli(['approve', 'simpletool', '--fingerprint', '1111111111111111111111111111111111111111111111111111111111111111']);
    expect(code).toBe(1);
    expect(stderr).toContain('deve ser namespaced');
  });

  it('approve command validates manual fingerprint format', () => {
    const { stderr, code } = runCli(['approve', 'serverA:mytool', '--fingerprint', 'short-fp']);
    expect(code).toBe(1);
    expect(stderr).toContain('Fingerprint invalido');
  });

  it('approve command requires force flag for fingerprint mismatch', () => {
    const fp1 = '1111111111111111111111111111111111111111111111111111111111111111';
    const fp2 = '2222222222222222222222222222222222222222222222222222222222222222';
    const doc = {
      version: 1,
      updatedAt: new Date().toISOString(),
      profile: 'safe',
      allowlist: [],
      tools: {
        'serverA:mytool': {
          status: 'pending_approval',
          fingerprint: fp1,
        },
      },
    };
    fs.writeFileSync(policyPath, JSON.stringify(doc), 'utf8');

    const res1 = runCli(['approve', 'serverA:mytool', '--fingerprint', fp2]);
    expect(res1.code).toBe(1);
    expect(res1.stderr).toContain('diferente do fingerprint registrado');

    const res2 = runCli(['approve', 'serverA:mytool', '--fingerprint', fp2, '--force-fingerprint']);
    expect(res2.code).toBe(0);
    const updated = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    expect(updated.tools['serverA:mytool'].fingerprint).toBe(fp2);
  });

  it('blocks tool and removes from allowlist', () => {
    const doc = {
      version: 1,
      updatedAt: new Date().toISOString(),
      profile: 'safe',
      allowlist: ['serverA:mytool'],
      tools: {
        'serverA:mytool': {
          status: 'approved',
          fingerprint: '1111111111111111111111111111111111111111111111111111111111111111',
        },
      },
    };
    fs.writeFileSync(policyPath, JSON.stringify(doc), 'utf8');

    const { stdout, code } = runCli(['block', 'serverA:mytool']);
    expect(code).toBe(0);
    expect(stdout).toContain('bloqueada com sucesso');

    const updated = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    expect(updated.tools['serverA:mytool'].status).toBe('blocked');
    expect(updated.allowlist).not.toContain('serverA:mytool');
  });

  it('forgets tool and removes from allowlist and tools map', () => {
    const doc = {
      version: 1,
      updatedAt: new Date().toISOString(),
      profile: 'safe',
      allowlist: ['serverA:mytool'],
      tools: {
        'serverA:mytool': {
          status: 'approved',
          fingerprint: '1111111111111111111111111111111111111111111111111111111111111111',
        },
      },
    };
    fs.writeFileSync(policyPath, JSON.stringify(doc), 'utf8');

    const { stdout, code } = runCli(['forget', 'serverA:mytool']);
    expect(code).toBe(0);
    expect(stdout).toContain('esquecida e removida da allowlist');

    const updated = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    expect(updated.tools['serverA:mytool']).toBeUndefined();
    expect(updated.allowlist).not.toContain('serverA:mytool');
  });
});
