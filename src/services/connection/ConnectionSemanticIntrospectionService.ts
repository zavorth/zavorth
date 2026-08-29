/**
 * Connection Semantic Introspection Service.
 * Provides governed, privacy-preserving semantic classification and architectural guidance
 * for unknown/unvetted connection targets without requesting or handling credentials.
 *
 * Strict Clean Code: English-first, zero `any`, no rigid heuristics, fully typed.
 */

import { logger } from '../../logger.js';

export interface SemanticIntrospectionResult {
  enabled: boolean;
  target: string;
  recognizedCategory?: string;
  guidance?: string;
  recommendedAuthType?: 'oauth2' | 'api_key' | 'local_path';
  manifestTemplateSnippet?: string;
}

export interface SemanticLlmInferencePort {
  classifyService(target: string): Promise<{
    category: string;
    authType: 'oauth2' | 'api_key' | 'local_path';
    summary?: string;
    guidance?: string;
  } | null>;
}

export interface ConnectionSemanticIntrospectionOptions {
  enabled?: boolean;
  maxRequestsPerMinute?: number;
  llmInferencePort?: SemanticLlmInferencePort;
}

export class ConnectionSemanticIntrospectionService {
  private readonly isEnabled: boolean;
  private readonly maxRequestsPerMinute: number;
  private readonly llmInferencePort?: SemanticLlmInferencePort;
  private readonly requestTimestamps: number[] = [];

  // Known ecosystem domain classifications to provide immediate zero-latency guidance
  private readonly domainKnowledge: Record<string, { category: string; auth: 'oauth2' | 'api_key' | 'local_path' }> = {
    linear: { category: 'Issue Tracking & Project Management', auth: 'api_key' },
    jira: { category: 'Issue Tracking & Project Management', auth: 'api_key' },
    hubspot: { category: 'Customer Relationship Management (CRM)', auth: 'oauth2' },
    salesforce: { category: 'Customer Relationship Management (CRM)', auth: 'oauth2' },
    airtable: { category: 'Relational Spreadsheet & Database', auth: 'api_key' },
    slack: { category: 'Team Chat & Webhooks', auth: 'oauth2' },
    discord: { category: 'Community Chat & Bot Webhooks', auth: 'api_key' },
    supabase: { category: 'Backend Database & Auth Engine', auth: 'api_key' },
    firebase: { category: 'Cloud Database & App Platform', auth: 'api_key' },
    s3: { category: 'Cloud Object Storage', auth: 'api_key' },
    cloudflare: { category: 'Edge Computing & CDN', auth: 'api_key' },
    gitlab: { category: 'Source Code & CI/CD Platform', auth: 'oauth2' },
  };

  constructor(options: ConnectionSemanticIntrospectionOptions = {}) {
    this.isEnabled = options.enabled ?? (process.env.ZAVORTH_ENABLE_SEMANTIC_INTROSPECTION === 'true');
    this.maxRequestsPerMinute = options.maxRequestsPerMinute || 5;
    this.llmInferencePort = options.llmInferencePort;
  }

  private isRateLimited(): boolean {
    const now = Date.now();
    const windowStart = now - 60000;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] <= windowStart) {
      this.requestTimestamps.shift();
    }

    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      return true;
    }

    this.requestTimestamps.push(now);
    return false;
  }

  /**
   * Evaluates an unknown target and returns structured architectural guidance.
   */
  public async introspect(target: string): Promise<SemanticIntrospectionResult> {
    if (!this.isEnabled) {
      return {
        enabled: false,
        target,
      };
    }

    if (this.isRateLimited()) {
      logger.warn(`[ConnectionSemanticIntrospectionService] Introspection rate limit reached.`);
      return {
        enabled: true,
        target,
        guidance: 'Semantic introspection rate limit reached (max 5/min). Use /connections catalog.',
      };
    }

    const normalized = target.toLowerCase().trim();
    const domain = this.domainKnowledge[normalized];

    if (domain) {
      const snippet = JSON.stringify(
        {
          id: normalized,
          label: target,
          summary: `Integration for ${domain.category}`,
          connection: {
            authType: domain.auth,
            usePkce: domain.auth === 'oauth2',
            ...(domain.auth === 'api_key'
              ? { apiKey: { label: `${target} API Key`, placeholder: 'Enter key...' } }
              : {}),
          },
        },
        null,
        2
      );

      return {
        enabled: true,
        target,
        recognizedCategory: domain.category,
        recommendedAuthType: domain.auth,
        guidance: `'${target}' appears to be a ${domain.category} service. To connect it securely, declare a plugin manifest in 'plugins/${normalized}/manifest.json' or configure an MCP server.`,
        manifestTemplateSnippet: snippet,
      };
    }

    if (this.llmInferencePort) {
      try {
        const llmResult = await this.llmInferencePort.classifyService(normalized);
        if (llmResult && llmResult.category) {
          const snippet = JSON.stringify(
            {
              id: normalized,
              label: target,
              summary: llmResult.summary || `Integration for ${llmResult.category}`,
              connection: {
                authType: llmResult.authType,
                usePkce: llmResult.authType === 'oauth2',
                ...(llmResult.authType === 'api_key'
                  ? { apiKey: { label: `${target} API Key`, placeholder: 'Enter key...' } }
                  : {}),
              },
            },
            null,
            2
          );

          return {
            enabled: true,
            target,
            recognizedCategory: llmResult.category,
            recommendedAuthType: llmResult.authType,
            guidance:
              llmResult.guidance ||
              `'${target}' appears to be a ${llmResult.category} service. To connect it securely, declare a plugin manifest in 'plugins/${normalized}/manifest.json' or configure an MCP server.`,
            manifestTemplateSnippet: snippet,
          };
        }
      } catch (err: unknown) {
        logger.debug(`[ConnectionSemanticIntrospectionService] Dynamic LLM classification fallback: ${String(err)}`);
      }
    }

    return {
      enabled: true,
      target,
      guidance: `'${target}' is not in the active catalog. You can integrate any external service by defining a Plugin Manifest or MCP connector.`,
    };
  }
}
