const { spawnSync } = require('node:child_process');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();

  ctx.bindCapability('pr.ship.status', async () => {
    try {
      const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], workspace);
      const dirty = runGit(['status', '--porcelain'], workspace);
      const log = runGit(['log', '-5', '--oneline'], workspace);
      let pr = null;
      const ghPr = runGh(['pr', 'view', '--json', 'number,title,url,state,isDraft'], workspace);
      if (ghPr.ok) {
        try {
          pr = JSON.parse(ghPr.stdout || 'null');
        } catch {
          pr = null;
        }
      }
      return {
        output: {
          ok: branch.ok,
          branch: (branch.stdout || '').trim() || null,
          dirty: dirty.ok ? dirty.stdout.trim().split(/\r?\n/u).filter(Boolean) : [],
          recentCommits: log.ok ? log.stdout.trim().split(/\r?\n/u).filter(Boolean) : [],
          pr,
          ghAvailable: ghPr.spawned,
          message: branch.ok ? 'Ship status ready.' : missingGitMessage(branch),
          setup: branch.ok ? null : setupTips(),
        },
      };
    } catch (error) {
      logger.warn('pr.ship.status failed', { error: errMsg(error) });
      return { output: { ok: false, message: errMsg(error), setup: setupTips() } };
    }
  });

  ctx.bindCapability('pr.ship.diff', async ({ input }) => {
    try {
      const base = String((input && (input.base || input.ref)) || 'HEAD').trim() || 'HEAD';
      const maxChars = Math.max(500, Math.min(40000, Number((input && input.maxChars) || 12000) || 12000));
      const against = base === 'HEAD' ? ['diff', '--stat', 'HEAD'] : ['diff', '--stat', `${base}...HEAD`];
      const patchArgs = base === 'HEAD' ? ['diff', 'HEAD'] : ['diff', `${base}...HEAD`];
      // Prefer staged+unstaged for working tree when base is HEAD
      const stat = runGit(base === 'HEAD' ? ['diff', '--stat', 'HEAD'] : against, workspace);
      const unstaged = base === 'HEAD' ? runGit(['diff', '--stat'], workspace) : { ok: true, stdout: '' };
      const staged = base === 'HEAD' ? runGit(['diff', '--cached', '--stat'], workspace) : { ok: true, stdout: '' };
      const patch = runGit(base === 'HEAD' ? ['diff', 'HEAD'] : patchArgs, workspace);
      let text = '';
      if (base === 'HEAD') {
        text = [staged.stdout, unstaged.stdout].filter(Boolean).join('\n') || stat.stdout || '';
      } else {
        text = stat.stdout || '';
      }
      const fullPatch = (patch.stdout || '').slice(0, maxChars);
      const truncated = (patch.stdout || '').length > maxChars;
      return {
        output: {
          ok: stat.ok || unstaged.ok || staged.ok,
          base,
          stat: text.trim(),
          patch: fullPatch,
          truncated,
          message: (stat.ok || unstaged.ok) ? 'Diff summary ready.' : missingGitMessage(stat),
        },
      };
    } catch (error) {
      logger.warn('pr.ship.diff failed', { error: errMsg(error) });
      return { output: { ok: false, message: errMsg(error), setup: setupTips() } };
    }
  });

  ctx.bindCapability('pr.ship.checklist', async ({ input }) => {
    try {
      let text = String((input && (input.text || input.content || input.diff)) || '');
      if (!text) {
        const base = String((input && input.base) || 'HEAD');
        const patch = runGit(base === 'HEAD' ? ['diff', 'HEAD'] : ['diff', `${base}...HEAD`], workspace);
        text = patch.stdout || '';
      }
      const items = buildChecklist(text);
      return {
        output: {
          ok: true,
          itemCount: items.length,
          items,
          summary: {
            blockers: items.filter((i) => i.severity === 'blocker').length,
            warnings: items.filter((i) => i.severity === 'warning').length,
            notes: items.filter((i) => i.severity === 'note').length,
          },
          message: 'Heuristic checklist — human review still required.',
        },
        receipts: ['pr-ship.receipt'],
      };
    } catch (error) {
      logger.warn('pr.ship.checklist failed', { error: errMsg(error) });
      return { output: { ok: false, items: [], message: errMsg(error) } };
    }
  });

  ctx.bindCapability('pr.ship.draft', async ({ input }) => {
    try {
      const base = String((input && (input.base || input.ref)) || 'main').trim() || 'main';
      const log = runGit(['log', `${base}...HEAD`, '--oneline'], workspace);
      const stat = runGit(['diff', '--stat', `${base}...HEAD`], workspace);
      const commits = log.ok ? log.stdout.trim().split(/\r?\n/u).filter(Boolean) : [];
      const titleOverride = input && input.title ? String(input.title).trim() : '';
      const title =
        titleOverride ||
        (commits[0] ? commits[0].replace(/^[a-f0-9]+\s+/iu, '').slice(0, 72) : 'Ship: workspace changes');
      const body = [
        '## Summary',
        commits.length ? commits.map((c) => `- ${c}`).join('\n') : '- (no commits vs base; include working tree changes)',
        '',
        '## Diffstat',
        '```',
        (stat.stdout || '(empty)').trim().slice(0, 3000),
        '```',
        '',
        '## Test plan',
        '- [ ] Local typecheck / tests relevant to the change',
        '- [ ] Manual smoke of primary user path',
        '',
        '_Drafted by Zavorth pr-ship — review before merge._',
      ].join('\n');
      return {
        output: {
          ok: true,
          title,
          body,
          base,
          commitCount: commits.length,
          message: 'Local draft only — use pr.ship.create to open on GitHub.',
        },
      };
    } catch (error) {
      logger.warn('pr.ship.draft failed', { error: errMsg(error) });
      return { output: { ok: false, message: errMsg(error), setup: setupTips() } };
    }
  });

  ctx.bindCapability('pr.ship.create', async ({ input }) => {
    try {
      const title = String((input && input.title) || '').trim();
      if (!title) {
        return { output: { ok: false, message: 'title is required' } };
      }
      const allowed = await ctx.requestPermission(
        'network.external',
        'Create a GitHub pull request via gh CLI',
      );
      if (!allowed) {
        return {
          output: {
            ok: false,
            message: 'Permission denied for PR create',
            reason: 'network.external not granted',
          },
        };
      }
      const body = String((input && (input.body || input.description)) || 'Created via Zavorth pr-ship.');
      const base = input && input.base ? String(input.base) : null;
      const draft = Boolean(input && (input.draft === true || input.isDraft === true));
      const args = ['pr', 'create', '--title', title, '--body', body];
      if (base) args.push('--base', base);
      if (draft) args.push('--draft');
      const result = runGh(args, workspace);
      if (!result.spawned) {
        return { output: { ok: false, message: missingGhMessage(result), setup: setupTips() } };
      }
      if (!result.ok) {
        return {
          output: {
            ok: false,
            message: result.stderr || result.stdout || 'gh pr create failed',
            setup: setupTips(),
          },
        };
      }
      return {
        output: {
          ok: true,
          url: (result.stdout || '').trim(),
          message: 'Pull request created.',
        },
        receipts: ['pr-ship.receipt'],
      };
    } catch (error) {
      logger.warn('pr.ship.create failed', { error: errMsg(error) });
      return { output: { ok: false, message: errMsg(error), setup: setupTips() } };
    }
  });

  logger.info('pr-ship registered', { workspace });
}

function buildChecklist(text) {
  const source = String(text || '');
  const items = [];
  const add = (id, severity, message, matched) => {
    if (matched) items.push({ id, severity, message, matched: true });
  };

  add('tests', 'warning', 'Diff touches code but no obvious test file changes — confirm coverage',
    /diff --git|\.ts|\.js|\.py/iu.test(source) && !/test|spec|__tests__/iu.test(source));
  add('lockfile', 'note', 'Dependency lockfile changed — verify intentional upgrade',
    /package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock/iu.test(source));
  add('migrations', 'blocker', 'Migration/schema change detected — review rollback path',
    /migration|schema\.prisma|alembic/iu.test(source));
  add('secrets', 'blocker', 'Possible secret material in diff — rotate if real credentials',
    /(api[_-]?key|secret|password|BEGIN (RSA |OPENSSH )?PRIVATE KEY)/iu.test(source));
  add('ci', 'note', 'Workflow files changed — validate CI on a draft PR',
    /\.github\/workflows|\.gitlab-ci|azure-pipelines/iu.test(source));
  add('auth', 'warning', 'Auth/permission paths touched — double-check authorization',
    /auth|permission|rbac|oauth|jwt/iu.test(source));
  add('delete-mass', 'warning', 'Large deletion volume — confirm intentional',
    /^-\s*\S/mu.test(source) && (source.match(/^-/gmu) || []).length > 80);
  add('todo-fix', 'note', 'TODO/FIXME left in diff — track or remove before merge',
    /\bTODO\b|\bFIXME\b|\bHACK\b/u.test(source));
  add('console-log', 'note', 'Debug logging may have been added',
    /\bconsole\.(log|debug|info)\b|\bprint\(/u.test(source));

  if (items.length === 0) {
    items.push({
      id: 'empty-or-clean',
      severity: 'note',
      message: source.trim()
        ? 'No high-signal heuristics fired — still do a human pass.'
        : 'Empty diff — nothing to review yet.',
      matched: false,
    });
  }
  return items;
}

function runGit(args, cwd) {
  return runBin('git', args, cwd);
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

function missingGitMessage(result) {
  if (result && result.spawned === false) return 'git not found on PATH';
  return (result && (result.stderr || result.stdout)) || 'git command failed';
}

function missingGhMessage(result) {
  if (result && result.spawned === false) return 'gh not found on PATH';
  return (result && (result.stderr || result.stdout)) || 'gh command failed';
}

function setupTips() {
  return [
    'Install git and open a repository root',
    'Install GitHub CLI: https://cli.github.com/',
    'Authenticate: gh auth login',
    'Or set GITHUB_TOKEN / GH_TOKEN',
  ];
}

function errMsg(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = { register };
