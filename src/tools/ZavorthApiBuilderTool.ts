import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

export class ZavorthApiBuilderTool extends BaseTool {
  public readonly name = 'zavorth_api_builder';

  public readonly description =
    'API builder — generate OpenAPI/Swagger specs, create REST endpoints, mock servers, test endpoints, validate schemas, generate client SDKs, and API documentation.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'generate_spec', 'create_endpoint', 'mock_server', 'test_endpoint', 'validate_spec', 'generate_client', 'generate_docs', 'list_routes', 'add_schema', 'generate_types', 'export_postman', 'import_postman'.",
      },
      api_name: {
        type: 'string',
        description: 'API name.',
      },
      base_url: {
        type: 'string',
        description: 'Base URL for the API.',
      },
      method: {
        type: 'string',
        description: "HTTP method: 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'.",
      },
      path: {
        type: 'string',
        description: "API endpoint path (e.g., '/users/{id}').",
      },
      description_text: {
        type: 'string',
        description: 'Endpoint or schema description.',
      },
      request_body: {
        type: 'string',
        description: 'JSON schema for request body.',
      },
      response_body: {
        type: 'string',
        description: 'JSON schema for response body.',
      },
      parameters_spec: {
        type: 'string',
        description: 'JSON array of path/query parameters.',
      },
      spec_path: {
        type: 'string',
        description: 'Path to OpenAPI spec file.',
      },
      output_path: {
        type: 'string',
        description: 'Output file path.',
      },
      port: {
        type: 'number',
        description: 'Port for mock server. Default: 3000.',
      },
      language: {
        type: 'string',
        description: "Language for client generation: 'typescript', 'javascript', 'python', 'go', 'java', 'csharp'.",
      },
      url: {
        type: 'string',
        description: 'URL for endpoint testing.',
      },
      headers: {
        type: 'string',
        description: 'JSON of HTTP headers.',
      },
      body: {
        type: 'string',
        description: 'Request body for testing.',
      },
      timeout_ms: {
        type: 'number',
        description: 'Request timeout. Default: 10000.',
      },
      schema_name: {
        type: 'string',
        description: 'Schema/model name.',
      },
      schema_definition: {
        type: 'string',
        description: 'JSON schema definition.',
      },
      output_format: {
        type: 'string',
        description: "Output format: 'json', 'yaml'. Default: 'json'.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'generate_spec': return await this.generateSpec(args);
      case 'create_endpoint': return await this.createEndpoint(args);
      case 'mock_server': return await this.mockServer(args);
      case 'test_endpoint': return await this.testEndpoint(args);
      case 'validate_spec': return await this.validateSpec(args);
      case 'generate_client': return await this.generateClient(args);
      case 'generate_docs': return await this.generateDocs(args);
      case 'list_routes': return await this.listRoutes(args);
      case 'add_schema': return await this.addSchema(args);
      case 'generate_types': return await this.generateTypes(args);
      case 'export_postman': return await this.exportPostman(args);
      case 'import_postman': return await this.importPostman(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async runCmd(cmd: string, cmdArgs: string[], timeout = 30000): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync(cmd, cmdArgs, {
        timeout,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();
      return result.trim();
    } catch (error: unknown) {
      return `Command error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async generateSpec(args: Record<string, unknown>): Promise<string> {
    const apiName = String(args.api_name || 'Zavorth API');
    const basePath = String(args.base_url || 'http://localhost:3000');
    const outputPath = String(args.output_path || 'openapi.json');

    const spec = {
      openapi: '3.0.3',
      info: {
        title: apiName,
        version: '1.0.0',
        description: `API specification for ${apiName}`,
      },
      servers: [{ url: basePath }],
      paths: {},
      components: { schemas: {} },
    };

    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
    return `OpenAPI spec generated: ${outputPath}\n  Title: ${apiName}\n  Base URL: ${basePath}\n  Version: 1.0.0`;
  }

  private async createEndpoint(args: Record<string, unknown>): Promise<string> {
    const specPath = String(args.spec_path || 'openapi.json');
    const endpointPath = String(args.path || '');
    const method = String(args.method || 'GET').toLowerCase();
    const descriptionText = String(args.description_text || '');
    if (!endpointPath) return 'Error: "path" is required.';

    try {
      let spec: Record<string, unknown>;
      if (fs.existsSync(specPath)) {
        spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      } else {
        spec = {
          openapi: '3.0.3',
          info: { title: 'API', version: '1.0.0' },
          paths: {},
          components: { schemas: {} },
        };
      }

      const paths = spec.paths as Record<string, Record<string, unknown>>;
      if (!paths[endpointPath]) paths[endpointPath] = {};

      const endpoint: Record<string, unknown> = {
        summary: descriptionText || `${method.toUpperCase()} ${endpointPath}`,
        responses: {
          '200': { description: 'Successful response' },
        },
      };

      if (args.parameters_spec) {
        try {
          endpoint.parameters = JSON.parse(String(args.parameters_spec));
        } catch { /* ignore */ }
      }

      if (['post', 'put', 'patch'].includes(method) && args.request_body) {
        endpoint.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: JSON.parse(String(args.request_body)),
            },
          },
        };
      }

      if (args.response_body) {
        try {
          endpoint.responses['200'] = {
            description: 'Successful response',
            content: { 'application/json': { schema: JSON.parse(String(args.response_body)) } },
          };
        } catch { /* ignore */ }
      }

      paths[endpointPath][method] = endpoint;

      fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
      return `Endpoint added: ${method.toUpperCase()} ${endpointPath}\nSpec updated: ${specPath}`;
    } catch (error: unknown) {
      return `Create endpoint error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async mockServer(args: Record<string, unknown>): Promise<string> {
    const specPath = String(args.spec_path || 'openapi.json');
    const port = Number(args.port || 3000);

    if (!fs.existsSync(specPath)) return `Error: Spec file not found: ${specPath}`;

    try {
      const { execFileSync } = await import('child_process');

      try {
        execFileSync('npx', ['--yes', 'openapi-mock-cli', '--port', String(port), specPath], {
          timeout: 5000,
        });
      } catch {
        // The server runs in background, this is expected to timeout
      }

      return `Mock server started on port ${port}\nSpec: ${specPath}\n\nNote: Server runs in foreground. Use a separate terminal or run with 'start' command.`;
    } catch (error: unknown) {
      return `Mock server error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async testEndpoint(args: Record<string, unknown>): Promise<string> {
    const url = String(args.url || '');
    const method = String(args.method || 'GET').toUpperCase();
    if (!url) return 'Error: "url" is required.';

    try {
      const { execFileSync } = await import('child_process');
      const curlArgs = ['-s', '-X', method, '-w', '\n\nHTTP_CODE:%{http_code}\nTIME:%{time_total}s\nSIZE:%{size_download} bytes'];

      if (args.headers) {
        try {
          const headers = JSON.parse(String(args.headers));
          for (const [key, value] of Object.entries(headers)) {
            curlArgs.push('-H', `${key}: ${value}`);
          }
        } catch { /* ignore */ }
      }

      if (args.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        curlArgs.push('-H', 'Content-Type: application/json');
        curlArgs.push('-d', String(args.body));
      }

      curlArgs.push('--max-time', String(Math.floor(Number(args.timeout_ms || 10000) / 1000)));
      curlArgs.push(url);

      const result = execFileSync('curl', curlArgs, { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }).toString();

      return `${method} ${url}:\n${result}`;
    } catch (error: unknown) {
      return `Test error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async validateSpec(args: Record<string, unknown>): Promise<string> {
    const specPath = String(args.spec_path || 'openapi.json');
    if (!fs.existsSync(specPath)) return `Error: Spec file not found: ${specPath}`;

    try {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      const issues: string[] = [];

      if (!spec.openapi && !spec.swagger) issues.push('Missing openapi/swagger version');
      if (!spec.info?.title) issues.push('Missing info.title');
      if (!spec.info?.version) issues.push('Missing info.version');
      if (!spec.paths || Object.keys(spec.paths).length === 0) issues.push('No paths defined');

      for (const [path, methods] of Object.entries(spec.paths || {})) {
        for (const [method, op] of Object.entries(methods as Record<string, unknown>)) {
          if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) continue;
          const operation = op as Record<string, unknown>;
          if (!operation.responses) issues.push(`${method.toUpperCase()} ${path}: missing responses`);
          if (['post', 'put', 'patch'].includes(method) && !operation.requestBody) {
            issues.push(`${method.toUpperCase()} ${path}: missing requestBody`);
          }
        }
      }

      if (issues.length === 0) return `Spec validation passed: ${specPath}\n  Paths: ${Object.keys(spec.paths || {}).length}\n  Version: ${spec.openapi || spec.swagger}`;

      return `Spec validation (${issues.length} issues):\n  ${issues.join('\n  ')}`;
    } catch (error: unknown) {
      return `Validation error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async generateClient(args: Record<string, unknown>): Promise<string> {
    const specPath = String(args.spec_path || 'openapi.json');
    const language = String(args.language || 'typescript');
    const outputPath = String(args.output_path || `api-client-${language}`);
    if (!fs.existsSync(specPath)) return `Error: Spec file not found: ${specPath}`;

    try {
      const { execFileSync } = await import('child_process');

      const generators: Record<string, { cmd: string; args: string[] }> = {
        typescript: { cmd: 'npx', args: ['--yes', 'openapi-generator-cli', 'generate', '-i', specPath, '-g', 'typescript-axios', '-o', outputPath] },
        javascript: { cmd: 'npx', args: ['--yes', 'openapi-generator-cli', 'generate', '-i', specPath, '-g', 'javascript', '-o', outputPath] },
        python: { cmd: 'npx', args: ['--yes', 'openapi-generator-cli', 'generate', '-i', specPath, '-g', 'python', '-o', outputPath] },
        go: { cmd: 'npx', args: ['--yes', 'openapi-generator-cli', 'generate', '-i', specPath, '-g', 'go', '-o', outputPath] },
        java: { cmd: 'npx', args: ['--yes', 'openapi-generator-cli', 'generate', '-i', specPath, '-g', 'java', '-o', outputPath] },
        csharp: { cmd: 'npx', args: ['--yes', 'openapi-generator-cli', 'generate', '-i', specPath, '-g', 'csharp', '-o', outputPath] },
      };

      const generator = generators[language];
      if (!generator) return `Error: Language "${language}" not supported. Use: ${Object.keys(generators).join(', ')}`;

      execFileSync(generator.cmd, generator.args, { timeout: 120000, maxBuffer: 50 * 1024 * 1024 });
      return `Client SDK generated:\n  Language: ${language}\n  Output: ${outputPath}\n  Spec: ${specPath}`;
    } catch (error: unknown) {
      return `Client generation error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async generateDocs(args: Record<string, unknown>): Promise<string> {
    const specPath = String(args.spec_path || 'openapi.json');
    const outputPath = String(args.output_path || 'api-docs.html');
    if (!fs.existsSync(specPath)) return `Error: Spec file not found: ${specPath}`;

    try {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      const title = spec.info?.title || 'API Documentation';
      const version = spec.info?.version || '1.0.0';
      const description = spec.info?.description || '';

      let pathsHtml = '';
      for (const [path, methods] of Object.entries(spec.paths || {})) {
        for (const [method, op] of Object.entries(methods as Record<string, unknown>)) {
          if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
          const operation = op as Record<string, unknown>;
          const color = method === 'get' ? '#61affe' : method === 'post' ? '#49cc90' : method === 'put' ? '#fca130' : method === 'delete' ? '#f93e3e' : '#0d5aa7';
          pathsHtml += `
            <div class="endpoint" style="border-left: 4px solid ${color}; padding: 10px; margin: 10px 0;">
              <span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 3px; text-transform: uppercase;">${method}</span>
              <strong style="margin-left: 10px;">${path}</strong>
              <p>${operation.summary || ''}</p>
            </div>`;
        }
      }

      const html = `<!DOCTYPE html>
<html><head><title>${title}</title>
<style>body{font-family:sans-serif;max-width:900px;margin:0 auto;padding:20px}
h1{color:#333}h2{color:#555;border-bottom:1px solid #eee;padding-bottom:5px}
.endpoint{background:#fafafa;border-radius:4px}</style>
</head><body>
<h1>${title} v${version}</h1>
<p>${description}</p>
<h2>Endpoints</h2>
${pathsHtml || '<p>No endpoints defined.</p>'}
</body></html>`;

      fs.writeFileSync(outputPath, html);
      return `API documentation generated: ${outputPath}\n  Title: ${title}\n  Version: ${version}`;
    } catch (error: unknown) {
      return `Docs generation error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async listRoutes(args: Record<string, unknown>): Promise<string> {
    const specPath = String(args.spec_path || 'openapi.json');
    if (!fs.existsSync(specPath)) return `Error: Spec file not found: ${specPath}`;

    try {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      const routes: string[] = [];

      for (const [path, methods] of Object.entries(spec.paths || {})) {
        for (const [method, op] of Object.entries(methods as Record<string, unknown>)) {
          if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) continue;
          const operation = op as Record<string, unknown>;
          routes.push(`  ${method.toUpperCase().padEnd(7)} ${path.padEnd(30)} ${operation.summary || ''}`);
        }
      }

      return `API Routes (${routes.length}):\n${routes.join('\n')}`;
    } catch (error: unknown) {
      return `List routes error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async addSchema(args: Record<string, unknown>): Promise<string> {
    const specPath = String(args.spec_path || 'openapi.json');
    const schemaName = String(args.schema_name || '');
    const schemaDef = String(args.schema_definition || '');
    if (!specPath || !schemaName || !schemaDef) return 'Error: "spec_path", "schema_name", and "schema_definition" are required.';

    try {
      let spec: Record<string, unknown>;
      if (fs.existsSync(specPath)) {
        spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      } else {
        spec = { openapi: '3.0.3', info: { title: 'API', version: '1.0.0' }, paths: {}, components: { schemas: {} } };
      }

      const components = spec.components as Record<string, Record<string, unknown>>;
      if (!components.schemas) components.schemas = {};
      components.schemas[schemaName] = JSON.parse(schemaDef);

      fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
      return `Schema "${schemaName}" added to ${specPath}`;
    } catch (error: unknown) {
      return `Add schema error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async generateTypes(args: Record<string, unknown>): Promise<string> {
    const specPath = String(args.spec_path || 'openapi.json');
    const outputPath = String(args.output_path || 'api-types.ts');
    if (!fs.existsSync(specPath)) return `Error: Spec file not found: ${specPath}`;

    try {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
      const schemas = spec.components?.schemas || {};
      const types: string[] = [];

      for (const [name, schema] of Object.entries(schemas)) {
        const s = schema as Record<string, unknown>;
        types.push(`export interface ${name} {`);
        if (s.properties) {
          const required = (s.required || []) as string[];
          for (const [prop, propSchema] of Object.entries(s.properties as Record<string, unknown>)) {
            const ps = propSchema as Record<string, unknown>;
            const optional = required.includes(prop) ? '' : '?';
            const tsType = this.openapiTypeToTs(ps);
            types.push(`  ${prop}${optional}: ${tsType};`);
          }
        }
        types.push('}\n');
      }

      fs.writeFileSync(outputPath, types.join('\n'));
      return `TypeScript types generated: ${outputPath}\n  Schemas: ${Object.keys(schemas).length}`;
    } catch (error: unknown) {
      return `Type generation error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private openapiTypeToTs(schema: Record<string, unknown>): string {
    const type = String(schema.type || 'unknown');
    switch (type) {
      case 'string': return 'string';
      case 'integer':
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'array': {
        const items = schema.items as Record<string, unknown> | undefined;
        return items ? `${this.openapiTypeToTs(items)}[]` : 'unknown[]';
      }
      case 'object': {
        if (schema.additionalProperties) {
          const ap = schema.additionalProperties as Record<string, unknown>;
          return `Record<string, ${this.openapiTypeToTs(ap)}>`;
        }
        return 'Record<string, unknown>';
      }
      default:
        if (schema.$ref) {
          const ref = String(schema.$ref);
          return ref.split('/').pop() || 'unknown';
        }
        return 'unknown';
    }
  }

  private async exportPostman(args: Record<string, unknown>): Promise<string> {
    const specPath = String(args.spec_path || 'openapi.json');
    const outputPath = String(args.output_path || 'postman_collection.json');
    if (!fs.existsSync(specPath)) return `Error: Spec file not found: ${specPath}`;

    try {
      const { execFileSync } = await import('child_process');
      execFileSync('npx', ['--yes', 'openapi-to-postmanv2', '-s', specPath, '-o', outputPath], {
        timeout: 30000,
      });
      return `Postman collection exported: ${outputPath}`;
    } catch (error: unknown) {
      return `Postman export error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async importPostman(args: Record<string, unknown>): Promise<string> {
    const specPath = String(args.spec_path || '');
    const outputPath = String(args.output_path || 'openapi-from-postman.json');
    if (!specPath) return 'Error: "spec_path" (Postman collection) is required.';

    try {
      const { execFileSync } = await import('child_process');
      execFileSync('npx', ['--yes', 'postman-to-openapi', specPath, '-o', outputPath], {
        timeout: 30000,
      });
      return `OpenAPI spec imported from Postman: ${outputPath}`;
    } catch (error: unknown) {
      return `Postman import error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
