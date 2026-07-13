const { spawnSync } = require('node:child_process');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();

  ctx.bindCapability('ci.status', async ({ input }) => {
    try {
      const limit = Math.max(1, Math.min(30, Number((input && input.limit) || 10) || 10));
      const branch = resolveBranch(input, workspace);
      const args = [
        'run',
        'list',
        '--json',
        'databaseId,name,displayTitle,status,conclusion,headBranch,event,url,createdAt,updatedAt',
        '--limit',
        String(limit),
      ];
      if (branch) args.push('--branch', branch);
      const repo = input && (input.repo || input.repository);
      if (repo) args.push('--repo', String(repo));
      const result = runGh(args, workspace);
      if (!result.spawned) {
        return { output: { ok: false, runs: [], message: missingGh(result), setup: setupTips() } };
      }
      if (!result.ok) {
        return {
          output: {
            ok: false,
            runs: [],
            message: result.stderr || result.stdout || 'gh run list failed',
            setup: setupTips(),
          },
        };
      }
      const runs = parseJsonArray(result.stdout);
      return {
        output: {
          ok: true,
          branch,
          count: runs.length,
          runs,
          summary: summarize(runs),
        },
        receipts: ['ci-watch.receipt'],
      };
    } catch (error) {
      logger.warn('ci.status failed', { error: errMsg(error) });
      return { output: { ok: false, runs: [], message: errMsg(error), setup: setupTips() } };
    }
  });

  ctx.bindCapability('ci.latest', async ({ input }) => {
    try {
      const branch = resolveBranch(input, workspace);
      const args = [
        'run',
        'list',
        '--json',
        'databaseId,name,displayTitle,status,conclusion,headBranch,event,url,createdAt,updatedAt',
        '--limit',
        '1',
      ];
      if (branch) args.push('--branch', branch);
      const repo = input && (input.repo || input.repository);
      if (repo) args.push('--repo', String(repo));
      const result = runGh(args, workspace);
      if (!result.spawned) {
        return { output: { ok: false, run: null, message: missingGh(result), setup: setupTips() } };
      }
      if (!result.ok) {
        return {
          output: {
            ok: false,
            run: null,
            message: result.stderr || result.stdout || 'gh run list failed',
            setup: setupTips(),
          },
        };
      }
      const runs = parseJsonArray(result.stdout);
      const run = runs[0] || null;
      return {
        output: {
          ok: true,
          branch,
          run,
          healthy: run ? run.conclusion === 'success' || run.status === 'in_progress' || run.status === 'queued' : null,
          message: run
            ? `Latest: ${run.name || run.displayTitle} → ${run.conclusion || run.status}`
            : 'No workflow runs found for this branch.',
        },
      };
    } catch (error) {
      logger.warn('ci.latest failed', { error: errMsg(error) });
      return { output: { ok: false, run: null, message: errMsg(error), setup: setupTips() } };
    }
  });

  ctx.bindCapability('ci.failed', async ({ input }) => {
    try {
      const limit = Math.max(1, Math.min(30, Number((input && input.limit) || 10) || 10));
      const args = [
        'run',
        'list',
        '--json',
        'databaseId,name,displayTitle,status,conclusion,headBranch,event,url,createdAt,updatedAt',
        '--limit',
        String(Math.min(50, limit * 3)),
      ];
      const repo = input && (input.repo || input.repository);
      if (repo) args.push('--repo', String(repo));
      const result = runGh(args, workspace);
      if (!result.spawned) {
        return { output: { ok: false, runs: [], message: missingGh(result), setup: setupTips() } };
      }
      if (!result.ok) {
        return {
          output: {
            ok: false,
            runs: [],
            message: result.stderr || result.stdout || 'gh run list failed',
            setup: setupTips(),
          },
        };
      }
      const runs = parseJsonArray(result.stdout)
        .filter((r) => r.conclusion === 'failure' || r.conclusion === 'timed_out' || r.conclusion === 'cancelled')
        .slice(0, limit);
      return {
        output: {
          ok: true,
          count: runs.length,
          runs,
          message: runs.length ? `${runs.length} failed run(s)` : 'No recent failed runs in the sample window.',
        },
      };
    } catch (error) {
      logger.warn('ci.failed failed', { error: errMsg(error) });
      return { output: { ok: false, runs: [], message: errMsg(error), setup: setupTips() } };
    }
  });

  logger.info('ci-watch registered', { workspace });
}

function resolveBranch(input, workspace) {
  if (input && (input.branch || input.ref)) {
    return String(input.branch || input.ref).trim();
  }
  const git = runBin('git', ['rev-parse', '--abbrev-ref', 'HEAD'], workspace);
  if (git.ok) {
    const b = git.stdout.trim();
    if (b && b !== 'HEAD') return b;
  }
  return null;
}

function summarize(runs) {
  const summary = { success: 0, failure: 0, in_progress: 0, other: 0 };
  for (const run of runs) {
    if (run.status === 'in_progress' || run.status === 'queued') {
      summary.in_progress += 1;
    } else if (run.conclusion === 'success') {
      summary.success += 1;
    } else if (run.conclusion === 'failure' || run.conclusion === 'timed_out') {
      summary.failure += 1;
    } else {
      summary.other += 1;
    }
  }
  return summary;
}

function parseJsonArray(text) {
  try {
    const raw = JSON.parse(text || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function runGh(args, cwd) {
  return runBin('gh', args, cwd);
}

function runBin(bin, args, cwd) {
  try {
    const result = spawnSync(bin, args, {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      timeout: 45000,
      windowsHide: true,
      env: process.env,
    });
    if (result.error && (result.error.code === 'ENOENT' || /not found/iu.test(String(result.error.message)))) {
      return { ok: false, spawned: false, stdout: '', stderr: String(result.error.message || `${bin} not found`) };
    }
    return {
      ok: result.status === 0,
      spawned: true,
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || ''),
      status: result.status,
    };
  } catch (error) {
    return { ok: false, spawned: false, stdout: '', stderr: errMsg(error) };
  }
}

function missingGh(result) {
  if (result && result.spawned === false) return 'gh not found on PATH';
  return (result && (result.stderr || result.stdout)) || 'gh command failed';
}

function setupTips() {
  return [
    'Install GitHub CLI: https://cli.github.com/',
    'Authenticate: gh auth login',
    'Ensure the repo has GitHub Actions workflows',
  ];
}

function errMsg(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = { register };
