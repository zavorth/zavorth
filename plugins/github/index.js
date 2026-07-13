const { spawnSync } = require('node:child_process');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();

  ctx.bindCapability('github.status', async () => {
    try {
      const tokenPresent = Boolean(String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim());
      const gh = runGh(['auth', 'status'], workspace);
      return {
        output: {
          ok: gh.ok || tokenPresent,
          ghInstalled: gh.spawned,
          ghAuthOk: gh.ok,
          tokenPresent,
          message: gh.ok
            ? 'GitHub CLI authenticated.'
            : tokenPresent
              ? 'GITHUB_TOKEN/GH_TOKEN present; gh auth may still need configuration.'
              : missingGhMessage(gh),
          stderr: gh.stderr || null,
        },
      };
    } catch (error) {
      logger.warn('github.status failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });

  ctx.bindCapability('github.pr.list', async ({ input }) => {
    try {
      const limit = Math.max(1, Math.min(50, Number((input && input.limit) || 20) || 20));
      const args = ['pr', 'list', '--json', 'number,title,url,state,author,updatedAt', '--limit', String(limit)];
      const repo = input && (input.repo || input.repository);
      if (repo) {
        args.push('--repo', String(repo));
      }
      const result = runGh(args, workspace);
      if (!result.spawned) {
        return { output: { ok: false, items: [], message: missingGhMessage(result), setup: setupTips() } };
      }
      if (!result.ok) {
        return {
          output: {
            ok: false,
            items: [],
            message: result.stderr || result.stdout || 'gh pr list failed',
            setup: setupTips(),
          },
        };
      }
      let items = [];
      try {
        items = JSON.parse(result.stdout || '[]');
      } catch {
        items = [];
      }
      return { output: { ok: true, items, count: items.length } };
    } catch (error) {
      logger.warn('github.pr.list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          items: [],
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });

  ctx.bindCapability('github.issue.list', async ({ input }) => {
    try {
      const limit = Math.max(1, Math.min(50, Number((input && input.limit) || 20) || 20));
      const args = ['issue', 'list', '--json', 'number,title,url,state,author,updatedAt', '--limit', String(limit)];
      const repo = input && (input.repo || input.repository);
      if (repo) {
        args.push('--repo', String(repo));
      }
      const result = runGh(args, workspace);
      if (!result.spawned) {
        return { output: { ok: false, items: [], message: missingGhMessage(result), setup: setupTips() } };
      }
      if (!result.ok) {
        return {
          output: {
            ok: false,
            items: [],
            message: result.stderr || result.stdout || 'gh issue list failed',
            setup: setupTips(),
          },
        };
      }
      let items = [];
      try {
        items = JSON.parse(result.stdout || '[]');
      } catch {
        items = [];
      }
      return { output: { ok: true, items, count: items.length } };
    } catch (error) {
      logger.warn('github.issue.list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          items: [],
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });
}

function runGh(args, cwd) {
  try {
    const result = spawnSync('gh', args, {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      timeout: 30000,
      windowsHide: true,
      env: process.env,
    });
    if (result.error && (result.error.code === 'ENOENT' || /not found/iu.test(String(result.error.message)))) {
      return { ok: false, spawned: false, stdout: '', stderr: String(result.error.message || 'gh not found') };
    }
    const stdout = String(result.stdout || '');
    const stderr = String(result.stderr || '');
    return {
      ok: result.status === 0,
      spawned: true,
      stdout,
      stderr,
      status: result.status,
    };
  } catch (error) {
    return {
      ok: false,
      spawned: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

function missingGhMessage(result) {
  if (result && result.spawned === false) {
    return 'GitHub CLI (gh) is not installed or not on PATH.';
  }
  return 'GitHub CLI command failed.';
}

function setupTips() {
  return [
    'Install GitHub CLI: https://cli.github.com/',
    'Authenticate: gh auth login',
    'Or set GITHUB_TOKEN / GH_TOKEN for token-based access.',
  ];
}

module.exports = { register };
