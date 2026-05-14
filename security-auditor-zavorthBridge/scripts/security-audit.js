#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '.');
const exts = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const findings = [];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.next', 'dist', 'build', 'coverage'].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function addFinding(f) {
  findings.push(f);
}

function detectFramework(files) {
  const rels = files.map(f => path.relative(root, f));
  const hasNext = rels.some(f => /(^|\\|\/)next\.config\./.test(f)) || fs.existsSync(path.join(root, 'next.config.js')) || fs.existsSync(path.join(root, 'next.config.ts'));
  const hasApp = rels.some(f => /(^|\\|\/)(src\/)?app\/.+/.test(f));
  const hasPages = rels.some(f => /(^|\\|\/)(src\/)?pages\/.+/.test(f));
  const hasVite = rels.some(f => /vite\.config\./.test(f)) || fs.existsSync(path.join(root, 'vite.config.ts')) || fs.existsSync(path.join(root, 'vite.config.js'));
  if (hasNext && hasApp) return 'nextjs-app-router';
  if (hasNext && hasPages) return 'nextjs-pages-router';
  if (hasNext) return 'nextjs';
  if (hasVite || fs.existsSync(path.join(root, 'public')) || fs.existsSync(path.join(root, 'src'))) return 'react-spa';
  return 'javascript-app';
}

function scanText(file, text) {
  const rel = path.relative(root, file);

  if (/dangerouslySetInnerHTML/.test(text)) {
    addFinding({
      title: 'Unsafe HTML rendering pattern', severity: 'high', confidence: 'medium', status: 'probable',
      evidence: 'dangerouslySetInnerHTML found', impact: 'Potential XSS if fed untrusted content', affectedFiles: [rel],
      recommendedFix: 'Sanitize content and restrict sources before rendering HTML.'
    });
  }

  if (/(localStorage|sessionStorage)\.(setItem|getItem)\(/.test(text) && /(token|jwt|auth|session|bearer)/i.test(text)) {
    addFinding({
      title: 'Token-like data stored in browser storage', severity: 'high', confidence: 'medium', status: 'probable',
      evidence: 'localStorage/sessionStorage usage near auth-like terms', impact: 'Token theft risk via XSS or browser compromise', affectedFiles: [rel],
      recommendedFix: 'Prefer secure httpOnly cookies for session handling.'
    });
  }

  if (/process\.env\.[A-Z0-9_]+/.test(text) && /NEXT_PUBLIC_[A-Z0-9_]+/.test(text) && /(secret|key|token)/i.test(text)) {
    addFinding({
      title: 'Potential secret exposure via client environment', severity: 'high', confidence: 'low', status: 'manual-review',
      evidence: 'NEXT_PUBLIC variable and secret-like naming found', impact: 'Sensitive values may be exposed to the browser bundle', affectedFiles: [rel],
      recommendedFix: 'Verify that only public, non-sensitive values use NEXT_PUBLIC variables.'
    });
  }

  if (/(SELECT|INSERT|UPDATE|DELETE)[\s\S]{0,120}\$\{/.test(text) || /(queryRawUnsafe|sequelize\.query|knex\.raw)\(/.test(text)) {
    addFinding({
      title: 'Potential SQL injection sink', severity: 'critical', confidence: 'medium', status: 'probable',
      evidence: 'Interpolated SQL or unsafe raw query sink detected', impact: 'Attacker-controlled input may alter database queries', affectedFiles: [rel],
      recommendedFix: 'Use parameterized queries or safe ORM APIs.'
    });
  }

  if (/req\.(body|query)|searchParams|get\(['\"]/.test(text) && !/(zod|yup|joi|valibot|schema\.parse|safeParse)/.test(text) && /(route|api|handler|action)/i.test(rel + ' ' + text.slice(0, 200))) {
    addFinding({
      title: 'Server boundary without obvious input validation', severity: 'high', confidence: 'low', status: 'manual-review',
      evidence: 'Request input usage without common validation markers', impact: 'Malformed or hostile input may reach sensitive logic', affectedFiles: [rel],
      recommendedFix: 'Validate request data at the server boundary with a schema.'
    });
  }

  if (/(openai|anthropic|claude|gemini)[\s\S]{0,500}(messages\.create|responses\.create|generateContent|chat\.completions)/i.test(text) && /(req\.body|userInput|prompt)/i.test(text)) {
    addFinding({
      title: 'LLM endpoint with prompt injection exposure', severity: 'high', confidence: 'medium', status: 'probable',
      evidence: 'User-controlled content appears to flow into an LLM call', impact: 'Model behavior may be steered to reveal or misuse privileged instructions and tools', affectedFiles: [rel],
      recommendedFix: 'Separate system instructions, validate tool args, add allowlists, and sanitize or constrain user content.'
    });
  }

  if (/(fetch|axios\.|got\()/.test(text) && /(req\.body|req\.query|searchParams|params\.)/.test(text)) {
    addFinding({
      title: 'Potential SSRF pattern', severity: 'high', confidence: 'low', status: 'manual-review',
      evidence: 'Server-side outbound request appears influenced by request parameters', impact: 'Attacker may force calls to internal or unintended hosts', affectedFiles: [rel],
      recommendedFix: 'Enforce host allowlists and validate URLs before outbound requests.'
    });
  }

  if (/(sk_live_|AIza[0-9A-Za-z\-_]{20,}|xox[baprs]-|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----)/.test(text)) {
    addFinding({
      title: 'Hardcoded credential material', severity: 'critical', confidence: 'high', status: 'confirmed',
      evidence: 'Secret-like token or private key marker detected', impact: 'Credential compromise may permit direct unauthorized access', affectedFiles: [rel],
      recommendedFix: 'Remove from code, rotate credentials, and load via secure server-side environment management.'
    });
  }
}

const allFiles = walk(root).filter(f => exts.has(path.extname(f)) || path.basename(f) === '.gitignore' || /package(-lock)?\.json$|pnpm-lock\.yaml$|yarn\.lock$|index\.html$|next\.config\./.test(path.basename(f)));
const framework = detectFramework(allFiles);

if (fs.existsSync(path.join(root, '.env')) && fs.existsSync(path.join(root, '.gitignore'))) {
  const gi = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  if (!/^\.env(\..*)?$/m.test(gi) && !/\.env/.test(gi)) {
    addFinding({
      title: '.env not ignored by gitignore', severity: 'high', confidence: 'medium', status: 'probable',
      evidence: '.env exists and .gitignore does not obviously ignore it', impact: 'Secrets may be accidentally committed', affectedFiles: ['.env', '.gitignore'],
      recommendedFix: 'Ignore .env files and verify they are not tracked in git history.'
    });
  }
}

for (const file of allFiles) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    if (exts.has(path.extname(file))) scanText(file, text);
  } catch (e) {}
}

const summary = findings.reduce((acc, f) => {
  acc.total += 1;
  acc[f.severity] = (acc[f.severity] || 0) + 1;
  return acc;
}, { total: 0, critical: 0, high: 0, medium: 0, low: 0 });

console.log(JSON.stringify({ framework, root, summary, findings }, null, 2));
