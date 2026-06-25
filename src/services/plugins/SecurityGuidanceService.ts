import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';

interface PolicyRule {
  id: string;
  category: string;
  rule: string;
  severity: 'info' | 'warning' | 'critical' | 'high' | 'medium';
  owasp_ref?: string;
  example_safe: string;
  example_unsafe: string;
  remediation: string;
}

export class SecurityGuidanceService extends BaseTool {
  public readonly name = 'zavorth_security_guidance';

  public readonly description =
    'Interactive security policy consultation, melhores praticas, OWASP Top 10, e orientacoes de hardening para o Zavorth.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'query', 'check_code', 'list_categories', 'owasp_top10', 'hardening', 'audit_checklist'.",
      },
      topic: {
        type: 'string',
        description: 'Security topic to query (ex: injection, auth, xss, ssrf, secrets).',
      },
      code_snippet: {
        type: 'string',
        description: 'Code snippet for security analysis.',
      },
      language: {
        type: 'string',
        description: "Code language: 'typescript', 'python', 'go', 'rust', 'generic'. Default: 'typescript'.",
      },
    },
    required: ['action'],
  };

  private readonly policies: PolicyRule[] = [
    { id: 'SEC-001', category: 'injection', rule: 'Nunca interpolar input do usuario em comandos shell. Use execFileSync com array de argumentos.', severity: 'critical', owasp_ref: 'A03:2021', example_safe: "execFileSync('curl', ['-s', url])", example_unsafe: 'execSync(`curl ${url}`)', remediation: 'Substitua execSync por execFileSync com argumentos em array.' },
    { id: 'SEC-002', category: 'injection', rule: 'Nunca interpolar input do usuario em queries SQL. Use prepared statements ou parameterized queries.', severity: 'critical', owasp_ref: 'A03:2021', example_safe: "db.query('SELECT * FROM users WHERE id = ?', [userId])", example_unsafe: "db.query(`SELECT * FROM users WHERE id = ${userId}`)", remediation: 'Use placeholders (?) ou named parameters.' },
    { id: 'SEC-003', category: 'auth', rule: 'Sempre validar tokens de autenticacao antes de processar requests. Verificar expiracao e assinatura.', severity: 'critical', owasp_ref: 'A07:2021', example_safe: 'verifyJwt(token, secret, { algorithms: ["HS256"] })', example_unsafe: 'if (token) { /* trusted */ }', remediation: 'Use biblioteca JWT com verificacao de assinatura e expiracao.' },
    { id: 'SEC-004', category: 'xss', rule: 'Sempre escapar output do usuario antes de renderizar em HTML. Use funcoes de escape adequadas.', severity: 'critical', owasp_ref: 'A03:2021', example_safe: 'escapeHtml(userInput)', example_unsafe: '`<div>${userInput}</div>`', remediation: 'Use bibliotecas de escape HTML ou frameworks que escapam automaticamente.' },
    { id: 'SEC-005', category: 'ssrf', rule: 'Validar URLs de input contra allowlist de dominios confiaveis antes de fazer requests.', severity: 'high', owasp_ref: 'A10:2021', example_safe: 'if (!trustedDomains.includes(parsed.hostname)) throw', example_unsafe: 'fetch(userProvidedUrl)', remediation: 'Valide hostname contra allowlist. Bloquee IPs privados e localhost.' },
    { id: 'SEC-006', category: 'secrets', rule: 'Nunca hardcodar secrets, API keys ou tokens no codigo. Use variaveis de ambiente ou secret managers.', severity: 'critical', owasp_ref: 'A02:2021', example_safe: "process.env.API_KEY", example_unsafe: "const key = 'sk-1234...'", remediation: 'Mova para .env, vault, ou secret manager. Adicione .env ao .gitignore.' },
    { id: 'SEC-007', category: 'path-traversal', rule: 'Validar que caminhos de arquivo nao escapam do workspace. Use path.resolve e verifique prefixo.', severity: 'high', owasp_ref: 'A01:2021', example_safe: "if (!resolved.startsWith(workspaceRoot)) throw", example_unsafe: 'fs.readFileSync(userPath)', remediation: 'Use path.resolve e valide contra workspace root.' },
    { id: 'SEC-008', category: 'deserialization', rule: 'Nunca usar JSON.parse em input do usuario sem validacao. Strip __proto__, constructor, prototype.', severity: 'high', owasp_ref: 'A08:2021', example_safe: 'sanitize(JSON.parse(input))', example_unsafe: 'Object.assign(target, JSON.parse(input))', remediation: 'Sanitize parsed data removendo chaves perigosas.' },
    { id: 'SEC-009', category: 'rate-limiting', rule: 'Implementar rate limiting em endpoints publicos para prevenir abuso e DoS.', severity: 'medium', owasp_ref: 'A04:2021', example_safe: 'rateLimiter.check(ip, 100, "1m")', example_unsafe: 'app.post("/api", handler)', remediation: 'Use middleware de rate limiting com sliding window.' },
    { id: 'SEC-010', category: 'cors', rule: 'Configurar CORS restritivo. Nunca usar Access-Control-Allow-Origin: * em producao.', severity: 'medium', owasp_ref: 'A05:2021', example_safe: "cors({ origin: ['https://app.example.com'] })", example_unsafe: "cors({ origin: '*' })", remediation: 'Especifique origens permitidas explicitamente.' },
    { id: 'SEC-011', category: 'headers', rule: 'Configurar headers de seguranca: CSP, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security.', severity: 'medium', owasp_ref: 'A05:2021', example_safe: "helmet({ contentSecurityPolicy: true })", example_unsafe: 'sem headers de seguranca', remediation: 'Use helmet.js ou configure headers manualmente.' },
    { id: 'SEC-012', category: 'logging', rule: 'Nunca logar dados sensiveis (senhas, tokens, PII). Use redacao automatica em logs.', severity: 'medium', owasp_ref: 'A09:2021', example_safe: 'logger.info("login", { user: redact(email) })', example_unsafe: 'logger.info("login", { password })', remediation: 'Implemente PII redaction em todos os logs.' },
    { id: 'SEC-013', category: 'dependencies', rule: 'Auditar dependencias regularmente para CVEs. Usar npm audit, Snyk, ou Dependabot.', severity: 'medium', owasp_ref: 'A06:2021', example_safe: 'npm audit --production', example_unsafe: 'npm install sem verificar', remediation: 'Execute npm audit em CI/CD e corrija vulnerabilidades.' },
    { id: 'SEC-014', category: 'input-validation', rule: 'Validar todo input do usuario no servidor. Nunca confiar apenas na validacao do cliente.', severity: 'high', owasp_ref: 'A03:2021', example_safe: 'schema.parse(userInput)', example_unsafe: 'const data = req.body', remediation: 'Use zod, joi, ou yup para validacao de schema.' },
    { id: 'SEC-015', category: 'encryption', rule: 'Usar TLS para todas as comunicacoes. Nunca transmitir dados sensiveis em texto claro.', severity: 'critical', owasp_ref: 'A02:2021', example_safe: 'https://api.example.com', example_unsafe: 'http://api.example.com', remediation: 'Force HTTPS. Use HSTS. Certificados validos.' },
  ];

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return "Error: 'action' parameter is required.";

    switch (action) {
      case 'query': return this.queryPolicy(args);
      case 'check_code': return this.checkCode(args);
      case 'list_categories': return this.listCategories();
      case 'owasp_top10': return this.owasTop10();
      case 'hardening': return this.hardeningGuide();
      case 'audit_checklist': return this.auditChecklist();
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private queryPolicy(args: Record<string, unknown>): string {
    const topic = String(args.topic || '').toLowerCase();
    if (!topic) return 'Error: "topic" is required. for query.';

    const matched = this.policies.filter((p) =>
      p.category.includes(topic) ||
      p.rule.toLowerCase().includes(topic) ||
      (p.owasp_ref && p.owasp_ref.toLowerCase().includes(topic))
    );

    if (matched.length === 0) {
      return `No policies encontrada para "${topic}". Use "list_categories" para ver categorias disponiveis.`;
    }

    const lines: string[] = [`Security policies for "${topic}" (${matched.length} encontradas):`];
    for (const p of matched) {
      const icon = { critical: '🔴', high: '🟠', medium: '🟡', warning: '⚠️', info: 'ℹ️' }[p.severity];
      lines.push('');
      lines.push(`${icon} ${p.id} [${p.category}]${p.owasp_ref ? ` (${p.owasp_ref})` : ''}`);
      lines.push(`  Regra: ${p.rule}`);
      lines.push(`  ✅ Seguro: ${p.example_safe}`);
      lines.push(`  ❌ Inseguro: ${p.example_unsafe}`);
      lines.push(`  Correcao: ${p.remediation}`);
    }
    return lines.join('\n');
  }

  private checkCode(args: Record<string, unknown>): string {
    const code = String(args.code_snippet || '');
    if (!code) return 'Error: "code_snippet" is required.';

    const issues: Array<{ policy: PolicyRule; match: string }> = [];

    if (/execSync\s*\(/.test(code) && /\$\{|`\s*\+|\+\s*`/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-001')!, match: 'execSync com interpolacao detectado' });
    }

    if (/query\s*\([^)]*\$\{|query\s*\([^)]*`\+/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-002')!, match: 'SQL injection potencial' });
    }

    if (/(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]+['"]/i.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-006')!, match: 'Secret hardcoded detectado' });
    }

    if (/\.innerHTML\s*=|dangerouslySetInnerHTML/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-004')!, match: 'XSS potencial via innerHTML' });
    }

    if (/fetch\s*\(\s*[a-zA-Z]/.test(code) && !/trusted|validated|allowed/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-005')!, match: 'SSRF potencial sem validacao de URL' });
    }

    if (/JSON\.parse\s*\([^)]*\)/.test(code) && !/sanitize|validate|strip/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-008')!, match: 'JSON.parse sem sanitizacao' });
    }

    if (/readFileSync\s*\([^)]*\+|readFile\s*\([^)]*\+/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-007')!, match: 'Path traversal potencial' });
    }

    if (/\bhttp:\/\//.test(code) && !/localhost|127\.0\.0\.1/.test(code)) {
      issues.push({ policy: this.policies.find((p) => p.id === 'SEC-015')!, match: 'HTTP nao-HTTPS detectado' });
    }

    if (issues.length === 0) {
      return 'No obvious security problem detected in the code snippet.';
    }

    const lines: string[] = [`⚠️ ${issues.length} security problem(s) detected:`];
    for (const { policy, match } of issues) {
      const icon = { critical: '🔴', high: '🟠', medium: '🟡', warning: '⚠️', info: 'ℹ️' }[policy.severity];
      lines.push(`\n${icon} ${policy.id}: ${match}`);
      lines.push(`  Regra: ${policy.rule}`);
      lines.push(`  Correcao: ${policy.remediation}`);
    }
    return lines.join('\n');
  }

  private listCategories(): string {
    const categories = new Set(this.policies.map((p) => p.category));
    const lines: string[] = ['Available security categories:'];
    for (const cat of [...categories].sort()) {
      const count = this.policies.filter((p) => p.category === cat).length;
      lines.push(`  ${cat}: ${count} politica(s)`);
    }
    return lines.join('\n');
  }

  private owasTop10(): string {
    return [
      'OWASP Top 10 (2021):',
      '',
      '  A01:2021 — Broken Access Control',
      '  A02:2021 — Cryptographic Failures',
      '  A03:2021 — Injection (SQL, XSS, Command)',
      '  A04:2021 — Insecure Design',
      '  A05:2021 — Security Misconfiguration',
      '  A06:2021 — Vulnerable and Outdated Components',
      '  A07:2021 — Identification and Authentication Failures',
      '  A08:2021 — Software and Data Integrity Failures',
      '  A09:2021 — Security Logging and Monitoring Failures',
      '  A10:2021 — Server-Side Request Forgery (SSRF)',
      '',
      'Use "query" com o ID (ex: A03:2021) para detalhes.',
    ].join('\n');
  }

  private hardeningGuide(): string {
    return [
      'Guia de Hardening para Zavorth:',
      '',
      '1. EXECUCAO: Use execFileSync com arrays, nunca execSync com strings',
      '2. INPUT: Valide todo input com schema (zod/joi). Sanitize paths.',
      '3. SECRETS: Variaveis de ambiente, nunca hardcoded. Rotacione periodicamente.',
      '4. REDE: HTTPS required. CORS restritivo. Rate limiting.',
      '5. DEPENDENCIAS: npm audit em CI. Atualize regularmente. Lock files.',
      '6. LOGS: Nunca logar senhas/tokens. Redacao de PII.',
      '7. AUTENTICACAO: JWT com verificacao. Expiracao curta. Refresh tokens.',
      '8. SANDBOX: Isole execucao de codigo em containers/sandboxes.',
      '9. APPROVAL: Acoes destrutivas requerem approval explicito.',
      '10. RECEIPTS: Toda acao gera receipt auditable.',
    ].join('\n');
  }

  private auditChecklist(): string {
    const lines: string[] = ['Checklist de Audit de Seguranca:', ''];
    for (const p of this.policies) {
      const icon = { critical: '🔴', high: '🟠', medium: '🟡', warning: '⚠️', info: 'ℹ️' }[p.severity];
      lines.push(`  [ ] ${icon} ${p.id}: ${p.category} — ${p.rule.slice(0, 80)}`);
    }
    return lines.join('\n');
  }
}
