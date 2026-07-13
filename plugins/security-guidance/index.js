const fs = require('node:fs');
const path = require('node:path');

const RULES = [
  { id: 'eval', pattern: /\beval\s*\(/u, severity: 'high', message: 'eval() can execute arbitrary code' },
  { id: 'new-function', pattern: /\bnew\s+Function\s*\(/u, severity: 'high', message: 'new Function() is dynamic code execution' },
  { id: 'pickle-load', pattern: /\bpickle\.load\s*\(/u, severity: 'high', message: 'pickle.load can execute arbitrary objects' },
  { id: 'yaml-load', pattern: /\byaml\.load\s*\(/u, severity: 'high', message: 'yaml.load without SafeLoader is unsafe' },
  { id: 'os-system', pattern: /\bos\.system\s*\(/u, severity: 'high', message: 'os.system shells out unsafely' },
  { id: 'dangerously-set-inner-html', pattern: /\bdangerouslySetInnerHTML\b/u, severity: 'medium', message: 'dangerouslySetInnerHTML can enable XSS' },
  { id: 'verify-false', pattern: /\bverify\s*=\s*False\b/u, severity: 'medium', message: 'TLS verification disabled (verify=False)' },
  { id: 'inner-html-assign', pattern: /\.innerHTML\s*=/u, severity: 'medium', message: 'innerHTML assignment can enable XSS' },
  { id: 'child-process-exec', pattern: /child_process\.exec\s*\(/u, severity: 'high', message: 'child_process.exec with shell is risky' },
  { id: 'exec-sync', pattern: /\bexecSync\s*\(/u, severity: 'medium', message: 'execSync can run shell commands' },
  { id: 'shell-true', pattern: /shell\s*:\s*true/u, severity: 'medium', message: 'shell:true enables shell injection risks' },
  { id: 'document-write', pattern: /\bdocument\.write\s*\(/u, severity: 'medium', message: 'document.write is an XSS vector' },
  { id: 'rm-rf', pattern: /\brm\s+-rf\b/u, severity: 'high', message: 'rm -rf destructive shell pattern' },
  { id: 'curl-pipe-sh', pattern: /curl[^\n|]*\|\s*(?:ba)?sh\b/u, severity: 'high', message: 'curl | sh remote code execution pattern' },
  { id: 'subprocess-shell', pattern: /subprocess\.(?:call|run|Popen)\s*\([^)]*shell\s*=\s*True/u, severity: 'high', message: 'subprocess with shell=True is risky' },
  { id: 'disable-ssl', pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?/u, severity: 'medium', message: 'TLS verification disabled via env' },
];

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const ledgerDir = path.join(workspace, '.zavorth', 'security-guidance');
  const ledgerPath = path.join(ledgerDir, 'warnings.jsonl');

  function ensureDir() {
    if (!fs.existsSync(ledgerDir)) {
      fs.mkdirSync(ledgerDir, { recursive: true });
    }
  }

  function appendWarning(entry) {
    try {
      ensureDir();
      fs.appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (error) {
      logger.warn('failed to append security warning', {
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
        });
      }
    }
    return findings;
  }

  ctx.bindCapability('security.scan', async ({ input }) => {
    try {
      const text = String((input && (input.text || input.content || input.code || input.value)) || '');
      const findings = scanText(text);
      const result = {
        ok: true,
        findingCount: findings.length,
        findings,
        blocked: false,
      };
      if (findings.length > 0) {
        appendWarning({
          kind: 'scan',
          at: new Date().toISOString(),
          findings,
        });
      }
      return { output: result };
    } catch (error) {
      logger.warn('security.scan failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          findings: [],
          message: error instanceof Error ? error.message : String(error),
          blocked: false,
        },
      };
    }
  });

  ctx.registerHook('tool.after_execute', async ({ context }) => {
    try {
      const ctxObj = context || {};
      const pathHint = ctxObj.path || ctxObj.filePath || ctxObj.targetPath || null;
      const content = extractWritableText(ctxObj);
      if (!content && !pathHint) {
        return;
      }
      const findings = scanText(content || '');
      if (findings.length === 0) {
        return;
      }
      appendWarning({
        kind: 'tool.after_execute',
        at: new Date().toISOString(),
        toolName: ctxObj.toolName || ctxObj.tool || null,
        path: pathHint,
        findings,
      });
      logger.warn('security-guidance findings', {
        path: pathHint,
        count: findings.length,
        ids: findings.map((item) => item.id),
      });
      ctx.emit({
        type: 'security-guidance.warning',
        payload: { path: pathHint, findings },
      });
    } catch (error) {
      logger.warn('tool.after_execute security scan failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

function extractWritableText(context) {
  if (!context || typeof context !== 'object') return '';
  const candidates = [
    context.content,
    context.text,
    context.code,
    context.body,
    context.value,
    context.input && context.input.content,
    context.input && context.input.text,
    context.result && context.result.content,
    context.result && context.result.text,
    typeof context.result === 'string' ? context.result : null,
    context.output && context.output.content,
    typeof context.output === 'string' ? context.output : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  try {
    return JSON.stringify(context);
  } catch {
    return '';
  }
}

module.exports = { register };
