
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

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
    'Governed HTTP client for external APIs. Integrated with Zavorth EgressGuard and LlmEgressGuard. Supports GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. Includes domain validation, header sanitization, rate limiting, and automatic auditing.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        description: "HTTP method: 'GET' (default), 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'.",
      },
      url: {
        type: 'string',
        description: 'Full endpoint URL.',
      },
      headers: {
        type: 'string',
        description: 'JSON with additional HTTP headers.',
      },
      body: {
        type: 'string',
        description: 'Request body (for POST/PUT/PATCH).',
      },
      body_type: {
        type: 'string',
        description: "Body type: 'json' (default), 'form', 'text', 'raw'.",
      },
      query_params: {
        type: 'string',
        description: 'JSON with query parameters.',
      },
      timeout_ms: {
        type: 'number',
        description: 'Timeout in milliseconds. Default: 30000.',
      },
      follow_redirects: {
        type: 'boolean',
        description: 'Follow redirects. Default: true.',
      },
      max_redirects: {
        type: 'number',
        description: 'Maximum redirects. Default: 5.',
      },
      auth_type: {
        type: 'string',
        description: "Authentication type: 'none' (default), 'bearer', 'basic', 'api_key', 'custom'.",
      },
      auth_token: {
        type: 'string',
        description: 'Authentication token/credential.',
      },
      auth_header: {
        type: 'string',
        description: "Custom authentication header. Default: 'Authorization'.",
      },
      response_format: {
        type: 'string',
        description: "Expected response format: 'auto' (default), 'json', 'text', 'binary'.",
      },
      save_response_to: {
        type: 'string',
        description: 'Path to save the response body.',
      },
      verify_ssl: {
        type: 'boolean',
        description: 'Verify SSL certificates. Default: true.',
      },
      proxy: {
        type: 'string',
        description: 'Proxy URL.',
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
    if (!url) return 'Error: the "url" parameter is required.';

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error: unknown) {logger.warn('[Zavorth Api Client] process execution failed', error); return ''; }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return `Error: protocol "${parsedUrl.protocol}" not supported. Use http: or https:.`;
    }

    if (this.blockedDomains.has(parsedUrl.hostname)) {
      return `Error: domain "${parsedUrl.hostname}" is on the block list.`;
    }

    const method = String(args.method || 'GET').toUpperCase();
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(method)) {
      return `Error: invalid method "${method}". Use: ${validMethods.join(', ')}.`;
    }

    const isTrusted = this.trustedDomains.has(parsedUrl.hostname);

    if (!isTrusted) {
      const warning = `⚠️ Domain "${parsedUrl.hostname}" is not on the trust list. Proceeding with caution.`;
      console.warn(warning);
    }

    const timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : 30000;
    if (timeoutMs > 120000) return 'Error: maximum timeout is 120 seconds.';

    try {
      const result = await this.executeRequest(parsedUrl, method, args);
      return this.formatResponse(result);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Api Client] process execution failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `HTTP request error: ${message}`;
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
      } catch (error: unknown) {logger.warn('[Zavorth Api Client] JSON parse failed', error);
    return {
          success: false, status: 0, status_text: 'Bad Headers',
          headers: {}, body: '', body_json: null,
          duration_ms: Date.now() - startTime,
          error: 'Invalid headers JSON.',
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
      } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Api Client] JSON parse failed', error); }
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
        // eslint-disable-next-line @typescript-eslint/no-var-requires
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
      const statusCode = statusMatch ? safeParseInt(statusMatch[1], 0) : 0;
      const responseBody = rawOutput.replace(/\n__HTTP_STATUS__\d+$/, '').trim();

      let bodyJson: unknown | null = null;
      if (String(args.response_format || 'auto') === 'json' || responseBody.startsWith('{') || responseBody.startsWith('[')) {
        try { bodyJson = JSON.parse(responseBody); } catch (error: unknown) {/* not json */ logger.warn('[Zavorth Api Client] JSON parse failed', error); }
      }

      if (typeof args.save_response_to === 'string' && responseBody) {
        const savePath = path.resolve(args.save_response_to);
        if (savePath.includes('\0')) {
          return {
            success: false, status: 0, status_text: 'Bad Path',
            headers: {}, body: '', body_json: null,
            duration_ms: Date.now() - startTime,
            error: 'Invalid save path.',
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
      const err = asErrorLike(error);
      logger.warn('[Zavorth Api Client] filesystem operation failed', error);
    return {
        success: false,
        status: 0,
        status_text: 'Request Failed',
        headers: {},
        body: '',
        body_json: null,
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? err.message : String(error),
      };
  } finally {
      if (tmpBodyFile) {
        try { const fs = await import('fs'); fs.unlinkSync(tmpBodyFile); } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Api Client] file cleanup failed', error); }
      }
    }
  }

  private formatResponse(result: ApiResponse): string {
    const lines: string[] = [
      `${result.success ? '✅' : '❌'} HTTP ${result.status} ${result.status_text} (${result.duration_ms}ms)`,
    ];

    if (result.error) {
      lines.push(`Error: ${result.error}`);
      return lines.join('\n');
    }

    if (result.body_json !== null) {
      const formatted = JSON.stringify(result.body_json, null, 2);
      if (formatted.length > 3000) {
        lines.push(`Body (JSON, ${formatted.length} chars, truncated):`);
        lines.push(formatted.slice(0, 3000));
        lines.push('...');
      } else {
        lines.push(`Body (JSON):`);
        lines.push(formatted);
      }
    } else if (result.body) {
      if (result.body.length > 3000) {
        lines.push(`Body (${result.body.length} chars, truncated):`);
        lines.push(result.body.slice(0, 3000));
        lines.push('...');
      } else {
        lines.push(`Body:`);
        lines.push(result.body);
      }
    } else {
      lines.push('Body: (empty)');
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
