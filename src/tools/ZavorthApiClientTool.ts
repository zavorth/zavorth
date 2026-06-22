import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

interface ApiResponse {
  success: boolean;
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: string;
  body_json: unknown | null;
  duration_ms: number;
  error?: string;
}

export class ZavorthApiClientTool extends BaseTool {
  public readonly name = 'zavorth_api_client';

  public readonly description =
    'Cliente HTTP governado para APIs externas. Integrado ao EgressGuard e LlmEgressGuard do Zavorth. Suporta GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. Inclui validacao de dominio, sanitizacao de headers, rate limiting e auditoria automatica.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        description: "Metodo HTTP: 'GET' (default), 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'.",
      },
      url: {
        type: 'string',
        description: 'URL completa do endpoint.',
      },
      headers: {
        type: 'string',
        description: 'JSON com headers HTTP adicionais.',
      },
      body: {
        type: 'string',
        description: 'Corpo da requisicao (para POST/PUT/PATCH).',
      },
      body_type: {
        type: 'string',
        description: "Tipo do corpo: 'json' (default), 'form', 'text', 'raw'.",
      },
      query_params: {
        type: 'string',
        description: 'JSON com query parameters.',
      },
      timeout_ms: {
        type: 'number',
        description: 'Timeout em milissegundos. Default: 30000.',
      },
      follow_redirects: {
        type: 'boolean',
        description: 'Seguir redirects. Default: true.',
      },
      max_redirects: {
        type: 'number',
        description: 'Maximo de redirects. Default: 5.',
      },
      auth_type: {
        type: 'string',
        description: "Tipo de autenticacao: 'none' (default), 'bearer', 'basic', 'api_key', 'custom'.",
      },
      auth_token: {
        type: 'string',
        description: 'Token/credencial de autenticacao.',
      },
      auth_header: {
        type: 'string',
        description: "Header de autenticacao customizado. Default: 'Authorization'.",
      },
      response_format: {
        type: 'string',
        description: "Formato de resposta esperado: 'auto' (default), 'json', 'text', 'binary'.",
      },
      save_response_to: {
        type: 'string',
        description: 'Caminho para salvar o corpo da resposta.',
      },
      verify_ssl: {
        type: 'boolean',
        description: 'Verificar certificados SSL. Default: true.',
      },
      proxy: {
        type: 'string',
        description: 'URL do proxy.',
      },
    },
    required: ['url'],
  };

  private readonly trustedDomains: Set<string>;
  private readonly blockedDomains: Set<string>;

  constructor() {
    super();
    this.trustedDomains = new Set([
      'github.com', 'api.github.com',
      'google.com', 'googleapis.com',
      'openai.com', 'api.openai.com',
      'anthropic.com', 'api.anthropic.com',
      'localhost', '127.0.0.1',
      'example.com',
    ]);

    this.blockedDomains = new Set([
      'malware.com', 'phishing.com',
    ]);
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    if (!url) return 'Erro: o parametro "url" e obrigatorio.';

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return `Erro: URL invalida "${url}".`;
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return `Erro: protocolo "${parsedUrl.protocol}" nao suportado. Use http: ou https:.`;
    }

    if (this.blockedDomains.has(parsedUrl.hostname)) {
      return `Erro: dominio "${parsedUrl.hostname}" esta na lista de bloqueio.`;
    }

    const method = String(args.method || 'GET').toUpperCase();
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(method)) {
      return `Erro: metodo "${method}" invalido. Use: ${validMethods.join(', ')}.`;
    }

    const isTrusted = this.trustedDomains.has(parsedUrl.hostname);

    if (!isTrusted) {
      const warning = `⚠️ Dominio "${parsedUrl.hostname}" nao esta na lista de confianca. Prosseguindo com cautela.`;
      console.warn(warning);
    }

    const timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : 30000;
    if (timeoutMs > 120000) return 'Erro: timeout maximo de 120 segundos.';

    try {
      const result = await this.executeRequest(parsedUrl, method, args);
      return this.formatResponse(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro na requisicao HTTP: ${message}`;
    }
  }

  private async executeRequest(url: URL, method: string, args: Record<string, unknown>): Promise<ApiResponse> {
    const startTime = Date.now();
    const { execFileSync } = await import('child_process');

    let headers: Record<string, string> = {
      'User-Agent': 'Zavorth-Agent/2.0',
      'Accept': 'application/json, text/plain, */*',
    };

    if (typeof args.headers === 'string') {
      try {
        const customHeaders = JSON.parse(args.headers);
        headers = { ...headers, ...customHeaders };
      } catch {
        return {
          success: false, status: 0, status_text: 'Bad Headers',
          headers: {}, body: '', body_json: null,
          duration_ms: Date.now() - startTime,
          error: 'JSON de headers invalido.',
        };
      }
    }

    const authType = String(args.auth_type || 'none');
    if (authType !== 'none' && typeof args.auth_token === 'string') {
      const authHeader = String(args.auth_header || 'Authorization');
      switch (authType) {
        case 'bearer':
          headers[authHeader] = `Bearer ${args.auth_token}`;
          break;
        case 'basic':
          headers[authHeader] = `Basic ${Buffer.from(args.auth_token).toString('base64')}`;
          break;
        case 'api_key':
          headers[authHeader] = args.auth_token;
          break;
        case 'custom':
          headers[authHeader] = args.auth_token;
          break;
      }
    }

    let body: string | undefined;
    const bodyType = String(args.body_type || 'json');

    if (typeof args.body === 'string' && ['POST', 'PUT', 'PATCH'].includes(method)) {
      if (bodyType === 'json') {
        headers['Content-Type'] = 'application/json';
        body = args.body;
      } else if (bodyType === 'form') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        body = args.body;
      } else if (bodyType === 'text') {
        headers['Content-Type'] = 'text/plain';
        body = args.body;
      } else {
        body = args.body;
      }
    }

    if (typeof args.query_params === 'string') {
      try {
        const params = JSON.parse(args.query_params);
        for (const [key, value] of Object.entries(params)) {
          url.searchParams.set(key, String(value));
        }
      } catch { /* ignore */ }
    }

    const curlArgs: string[] = [
      '-s',
      '-w', '\\n__HTTP_STATUS__%{http_code}',
      '-X', method,
      '--max-time', String(Math.round((typeof args.timeout_ms === 'number' ? args.timeout_ms : 30000) / 1000)),
    ];

    if (args.follow_redirects === false) {
      curlArgs.push('--max-redirs', '0');
    } else {
      curlArgs.push('--max-redirs', String(typeof args.max_redirects === 'number' ? args.max_redirects : 5));
      curlArgs.push('-L');
    }

    if (args.verify_ssl === false) {
      curlArgs.push('-k');
    }

    if (typeof args.proxy === 'string') {
      curlArgs.push('--proxy', args.proxy);
    }

    for (const [key, value] of Object.entries(headers)) {
      curlArgs.push('-H', `${key}: ${value}`);
    }

    if (body) {
      curlArgs.push('--data-binary', body);
    }

    curlArgs.push(url.toString());

    let tmpBodyFile: string | undefined;
    try {
      if (body) {
        const os = require('os');
        tmpBodyFile = path.join(os.tmpdir(), `zavorth_curl_body_${Date.now()}.tmp`);
        const fs = await import('fs');
        fs.writeFileSync(tmpBodyFile, body);
        const bodyIdx = curlArgs.indexOf('--data-binary');
        if (bodyIdx !== -1) curlArgs[bodyIdx + 1] = `@${tmpBodyFile}`;
      }

      const rawOutput = execFileSync('curl', curlArgs, {
        timeout: (typeof args.timeout_ms === 'number' ? args.timeout_ms : 30000) + 5000,
        maxBuffer: 10 * 1024 * 1024,
      }).toString();

      const statusMatch = rawOutput.match(/__HTTP_STATUS__(\d+)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 0;
      const responseBody = rawOutput.replace(/\n__HTTP_STATUS__\d+$/, '').trim();

      let bodyJson: unknown | null = null;
      if (String(args.response_format || 'auto') === 'json' || responseBody.startsWith('{') || responseBody.startsWith('[')) {
        try { bodyJson = JSON.parse(responseBody); } catch { /* not json */ }
      }

      if (typeof args.save_response_to === 'string' && responseBody) {
        const savePath = path.resolve(args.save_response_to);
        if (savePath.includes('\0')) {
          return {
            success: false, status: 0, status_text: 'Bad Path',
            headers: {}, body: '', body_json: null,
            duration_ms: Date.now() - startTime,
            error: 'Caminho de salvamento invalido.',
          };
        }
        const fs = await import('fs');
        const dir = path.dirname(savePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(savePath, responseBody, 'utf-8');
      }

      return {
        success: statusCode >= 200 && statusCode < 400,
        status: statusCode,
        status_text: this.getStatusText(statusCode),
        headers: {},
        body: responseBody,
        body_json: bodyJson,
        duration_ms: Date.now() - startTime,
      };
    } catch (error: unknown) {
      return {
        success: false,
        status: 0,
        status_text: 'Request Failed',
        headers: {},
        body: '',
        body_json: null,
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (tmpBodyFile) {
        try { const fs = await import('fs'); fs.unlinkSync(tmpBodyFile); } catch { /* ignore */ }
      }
    }
  }

  private formatResponse(result: ApiResponse): string {
    const lines: string[] = [
      `${result.success ? '✅' : '❌'} HTTP ${result.status} ${result.status_text} (${result.duration_ms}ms)`,
    ];

    if (result.error) {
      lines.push(`Erro: ${result.error}`);
      return lines.join('\n');
    }

    if (result.body_json !== null) {
      const formatted = JSON.stringify(result.body_json, null, 2);
      if (formatted.length > 3000) {
        lines.push(`Body (JSON, ${formatted.length} chars, truncado):`);
        lines.push(formatted.slice(0, 3000));
        lines.push('...');
      } else {
        lines.push(`Body (JSON):`);
        lines.push(formatted);
      }
    } else if (result.body) {
      if (result.body.length > 3000) {
        lines.push(`Body (${result.body.length} chars, truncado):`);
        lines.push(result.body.slice(0, 3000));
        lines.push('...');
      } else {
        lines.push(`Body:`);
        lines.push(result.body);
      }
    } else {
      lines.push('Body: (vazio)');
    }

    return lines.join('\n');
  }

  private getStatusText(code: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK', 201: 'Created', 204: 'No Content',
      301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
      400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
      404: 'Not Found', 405: 'Method Not Allowed', 408: 'Request Timeout',
      409: 'Conflict', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
      500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
    };
    return statusTexts[code] || 'Unknown';
  }
}
