const fs = require('node:fs');
const path = require('node:path');

const RULES = [
  {
    id: 'aws-access-key',
    severity: 'high',
    pattern: /\bAKIA[0-9A-Z]{16}\b/u,
    message: 'Possible AWS access key id',
  },
  {
    id: 'github-pat',
    severity: 'high',
    pattern: /\bghp_[A-Za-z0-9]{20,}\b/u,
    message: 'Possible GitHub personal access token',
  },
  {
    id: 'github-oauth',
    severity: 'high',
    pattern: /\bgho_[A-Za-z0-9]{20,}\b/u,
    message: 'Possible GitHub OAuth token',
  },
  {
    id: 'slack-token',
    severity: 'high',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/u,
    message: 'Possible Slack token',
  },
  {
    id: 'stripe-key',
    severity: 'high',
    pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/u,
    message: 'Possible Stripe secret key',
  },
  {
    id: 'google-api-key',
    severity: 'high',
    pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/u,
    message: 'Possible Google API key',
  },
  {
    id: 'openai-key',
    severity: 'high',
    pattern: /\bsk-[A-Za-z0-9]{20,}\b/u,
    message: 'Possible OpenAI-style API key',
  },
  {
    id: 'private-key-block',
    severity: 'critical',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
    message: 'PEM private key block detected',
  },
  {
    id: 'jwt-like',
    severity: 'medium',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
    message: 'JWT-like token pattern',
  },
  {
    id: 'generic-secret-assign',
    severity: 'medium',
    pattern: /(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][^'"]{12,}['"]/iu,
    message: 'Hard-coded secret assignment',
  },
  {
    id: 'connection-string-password',
    severity: 'high',
    pattern: /(?:postgres|mysql|mongodb(?:\+srv)?):\/\/[^:\s]+:[^@\s]+@/iu,
    message: 'Database URL with embedded credentials',
  },
];

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const ledgerDir = path.join(workspace, '.zavorth', 'secrets-guardian');
  const ledgerPath = path.join(ledgerDir, 'findings.jsonl');

  function ensureDir() {
    if (!fs.existsSync(ledgerDir)) {
      fs.mkdirSync(ledgerDir, { recursive: true });
    }
  }

  function appendFinding(entry) {
    try {
      ensureDir();
      fs.appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (error) {
      logger.warn('failed to append secrets finding', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function scanText(text) {
    const source = String(text || '');
    const findings = [];
    for (const rule of RULES) {
      if (rule.pattern.test(source)) {
        findings.push({
          id: rule.id,
          severity: rule.severity,
          message: rule.message,
          // Never echo matched secret material.
          redacted: true,
        });
      }
    }
    return findings;
  }

  function resolveSafePath(rel) {
    const raw = String(rel || '').trim();
    if (!raw) return null;
    const resolved = path.resolve(workspace, raw);
    const root = path.resolve(workspace);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return null;
    }
    return resolved;
  }

  ctx.bindCapability('secrets.scan', async ({ input }) => {
    try {
      const text = String((input && (input.text || input.content || input.code || input.value)) || '');
      const findings = scanText(text);
      if (findings.length > 0) {
        appendFinding({ kind: 'scan', at: new Date().toISOString(), findings });
      }
      return {
        output: {
          ok: true,
          findingCount: findings.length,
          findings,
          blocked: false,
          tip: findings.length
            ? 'Rotate any real credentials and prefer env vars / secret managers.'
            : 'No secret patterns matched.',
        },
        receipts: findings.length ? ['secrets-guardian.receipt'] : [],
      };
    } catch (error) {
      logger.warn('secrets.scan failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          findings: [],
          blocked: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('secrets.scan_path', async ({ input }) => {
    try {
      const target = resolveSafePath(input && (input.path || input.file || input.filePath));
      if (!target) {
        return {
          output: {
            ok: false,
            findings: [],
            message: 'path is required and must stay inside the workspace',
          },
        };
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        return { output: { ok: false, findings: [], message: `file not found: ${target}` } };
      }
      const size = fs.statSync(target).size;
      if (size > 2_000_000) {
        return {
          output: {
            ok: false,
            findings: [],
            message: 'file too large to scan (>2MB)',
            path: path.relative(workspace, target),
          },
        };
      }
      const text = fs.readFileSync(target, 'utf8');
      const findings = scanText(text);
      if (findings.length > 0) {
        appendFinding({
          kind: 'scan_path',
          at: new Date().toISOString(),
          path: path.relative(workspace, target),
          findings,
        });
      }
      return {
        output: {
          ok: true,
          path: path.relative(workspace, target),
          findingCount: findings.length,
          findings,
          blocked: false,
        },
      };
    } catch (error) {
      logger.warn('secrets.scan_path failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          findings: [],
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('secrets.summary', async ({ input }) => {
    try {
      const limit = Math.max(1, Math.min(200, Number((input && input.limit) || 50) || 50));
      if (!fs.existsSync(ledgerPath)) {
        return {
          output: {
            ok: true,
            entryCount: 0,
            recent: [],
            ledgerPath,
            message: 'No findings recorded yet.',
          },
          artifacts: [ledgerPath],
        };
      }
      const lines = fs
        .readFileSync(ledgerPath, 'utf8')
        .split(/\r?\n/u)
        .map((l) => l.trim())
        .filter(Boolean);
      const recent = lines
        .slice(-limit)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .reverse();
      return {
        output: {
          ok: true,
          entryCount: lines.length,
          recent,
          ledgerPath,
        },
        artifacts: [ledgerPath],
      };
    } catch (error) {
      logger.warn('secrets.summary failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          recent: [],
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.registerHook('tool.after_execute', async ({ context }) => {
    try {
      const ctxObj = context || {};
      const content = extractWritableText(ctxObj);
      if (!content) return;
      const findings = scanText(content);
      if (findings.length === 0) return;
      const pathHint = ctxObj.path || ctxObj.filePath || ctxObj.targetPath || null;
      appendFinding({
        kind: 'tool.after_execute',
        at: new Date().toISOString(),
        toolName: ctxObj.toolName || ctxObj.tool || null,
        path: pathHint,
        findings,
      });
      logger.warn('secrets-guardian findings', {
        path: pathHint,
        count: findings.length,
        ids: findings.map((f) => f.id),
      });
      ctx.emit({
        type: 'secrets-guardian.warning',
        payload: { path: pathHint, findings },
      });
    } catch (error) {
      logger.warn('secrets tool.after_execute failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  logger.info('secrets-guardian registered', { workspace, ledgerPath });
}

function extractWritableText(ctxObj) {
  if (!ctxObj || typeof ctxObj !== 'object') return '';
  const keys = ['content', 'text', 'code', 'value', 'body', 'data', 'newContent', 'patch'];
  for (const key of keys) {
    if (typeof ctxObj[key] === 'string' && ctxObj[key].length > 0) {
      return ctxObj[key];
    }
  }
  if (ctxObj.input && typeof ctxObj.input === 'object') {
    for (const key of keys) {
      if (typeof ctxObj.input[key] === 'string' && ctxObj.input[key].length > 0) {
        return ctxObj.input[key];
      }
    }
  }
  return '';
}

module.exports = { register };
