import { resolve } from 'node:path';
import {
  assertNoShellMetacharacters,
  containsShellMetacharacters,
  MARKETPLACE_ALLOWED_BINARIES,
  safeExecFile,
  splitCommandLine,
  spawnSyncCommandLine,
} from '../../src/security/SafeProcessExec.js';

describe('SafeProcessExec (S3 command injection)', () => {
  it('detects shell metacharacters', () => {
    expect(containsShellMetacharacters('echo hi')).toBe(false);
    expect(containsShellMetacharacters('echo hi; rm -rf /')).toBe(true);
    expect(containsShellMetacharacters('echo $(whoami)')).toBe(true);
    expect(containsShellMetacharacters('echo `id`')).toBe(true);
    expect(containsShellMetacharacters('a|b')).toBe(true);
    expect(() => assertNoShellMetacharacters('ok')).not.toThrow();
    expect(() => assertNoShellMetacharacters('x&y', 'arg')).toThrow(/metacharacters/);
  });

  it('splits command lines without shell expansion', () => {
    expect(splitCommandLine('git status')).toEqual({ file: 'git', args: ['status'] });
    expect(splitCommandLine('node "./path with spaces/app.js" --flag')).toEqual({
      file: 'node',
      args: ['./path with spaces/app.js', '--flag'],
    });
    expect(() => splitCommandLine('git status; rm -rf /')).toThrow(/metacharacters/);
    expect(() => splitCommandLine('echo "unterminated')).toThrow(/Unclosed quote/);
  });

  it('safeExecFile enforces marketplace binary allowlist', () => {
    expect(() =>
      safeExecFile('bash', ['-c', 'echo hi'], {
        allowedBinaries: MARKETPLACE_ALLOWED_BINARIES,
        timeout: 2000,
      }),
    ).toThrow(/not allowlisted/i);

    expect(() =>
      safeExecFile('git', ['status; rm -rf /'], {
        allowedBinaries: MARKETPLACE_ALLOWED_BINARIES,
        timeout: 2000,
      }),
    ).toThrow(/metacharacters/);
  });

  it('spawnSyncCommandLine runs argv-only (node -e)', () => {
    // Quote executable so Windows paths with spaces stay one argv token.
    const quotedNode = `"${process.execPath}"`;
    const result = spawnSyncCommandLine(`${quotedNode} -e "process.stdout.write('ok-s3')"`, {
      encoding: 'utf8',
      timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(String(result.stdout || '')).toContain('ok-s3');
  });

  it('marketplace SkillGitRegistry uses safeExecFile allowlist (source contract)', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const src = readFileSync(resolve(__dirname, '../../src/skills/marketplace/SkillGitRegistry.ts'), 'utf8');
    expect(src).toContain('safeExecFile');
    expect(src).toContain('MARKETPLACE_ALLOWED_BINARIES');
    // No live shell:true option objects (comments may mention shell:true).
    expect(src).not.toMatch(/shell\s*:\s*true\s*[,}]/);
  });

  it('AgentChainBuilder and CLI live namespaces avoid shell:true for local spawn', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const chain = readFileSync(resolve(__dirname, '../../src/agents/AgentChainBuilder.ts'), 'utf8');
    const live = readFileSync(resolve(__dirname, '../../src/cli/ZavorthCliLiveNamespaces.ts'), 'utf8');
    expect(chain).toContain('spawnSyncCommandLine');
    expect(chain).not.toMatch(/spawnSync\(command,\s*\[\],\s*\{[^}]*shell:\s*true/s);
    expect(live).toContain('spawnCommandLine');
    // Remaining shell:true would be a regression in service/MCP spawn paths we fixed.
    expect(live).not.toMatch(/spawn\(command,\s*\[\],\s*\{[^}]*shell:\s*true/s);
  });
});
