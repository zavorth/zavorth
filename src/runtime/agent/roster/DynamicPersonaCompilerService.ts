import {
  type CreatePersonaInput,
  type PersonaIsolationMode,
  sanitizePersonaId,
} from './PersonaContract.js';

export interface DynamicPersonaCompilationRequest {
  userIntent: string;
  requestedId?: string | null;
  defaultIsolation?: PersonaIsolationMode | null;
  allowedDomains?: string[] | null;
}

export interface PersonaSynthesisLlmClient {
  completePrompt(prompt: string): Promise<string>;
}

interface SemanticDomainProfile {
  id: string;
  name: string;
  role: string;
  avatar: string;
  tools: string[];
  isolation: PersonaIsolationMode;
  coreConcepts: string[];
}

const SEMANTIC_DOMAIN_CATALOG: SemanticDomainProfile[] = [
  {
    id: 'database-specialist',
    name: 'Database Specialist',
    role: 'Database Performance, SQL & Schema Specialist',
    avatar: 'database',
    tools: ['read_file', 'database_query', 'database_explain'],
    isolation: 'direct',
    coreConcepts: ['sql', 'database', 'postgres', 'postgresql', 'mysql', 'sqlite', 'query', 'index', 'dba'],
  },
  {
    id: 'security-specialist',
    name: 'Security Specialist',
    role: 'Code Security & Vulnerability Auditor',
    avatar: 'shield',
    tools: ['read_file', 'grep_search'],
    isolation: 'direct',
    coreConcepts: ['security', 'vulnerability', 'audit', 'threat', 'auth', 'cve', 'credential', 'leak'],
  },
  {
    id: 'web-navigator',
    name: 'Web Navigator',
    role: 'Web Automation & Scraping Specialist',
    avatar: 'globe',
    tools: ['read_file', 'read_url_content', 'playwright_browser'],
    isolation: 'docker',
    coreConcepts: ['browser', 'playwright', 'scraping', 'crawler', 'web', 'navigate', 'url', 'html'],
  },
  {
    id: 'frontend-architect',
    name: 'Frontend Architect',
    role: 'UI/UX & Frontend Architecture Specialist',
    avatar: 'palette',
    tools: ['read_file', 'write_patch'],
    isolation: 'direct',
    coreConcepts: ['frontend', 'react', 'ui', 'css', 'tailwind', 'component', 'vue', 'layout'],
  },
  {
    id: 'system-architect',
    name: 'System Architect',
    role: 'Architecture, Clean Code & Invariant Specialist',
    avatar: 'blueprint',
    tools: ['read_file', 'write_patch', 'grep_search'],
    isolation: 'direct',
    coreConcepts: ['architect', 'architecture', 'refactor', 'solid', 'clean', 'typing', 'pattern'],
  },
];

export class DynamicPersonaCompilerService {
  constructor(private llmClient?: PersonaSynthesisLlmClient | null) {}

  public async compileFromIntent(
    request: DynamicPersonaCompilationRequest,
  ): Promise<CreatePersonaInput> {
    const rawIntent = String(request.userIntent || '').trim();
    if (!rawIntent) {
      throw new Error('User intent cannot be empty when dynamically compiling a persona.');
    }

    if (this.llmClient) {
      try {
        const synthesized = await this.synthesizeWithLlm(rawIntent, request);
        if (synthesized) {
          return synthesized;
        }
      } catch {
        // Fall back to deterministic semantic catalog matching on LLM failure
      }
    }

    return this.synthesizeWithSemanticCatalog(rawIntent, request);
  }

  private async synthesizeWithLlm(
    rawIntent: string,
    request: DynamicPersonaCompilationRequest,
  ): Promise<CreatePersonaInput | null> {
    if (!this.llmClient) {
      return null;
    }

    const prompt = [
      'You are the Zavorth Persona Synthesis Engine.',
      'Analyze the following natural language intent and compile a specialized subagent persona specification.',
      'Return ONLY a valid JSON object matching this schema:',
      '{',
      '  "id": "short-kebab-case-id",',
      '  "name": "Human Readable Name",',
      '  "role": "Specific Professional Role",',
      '  "avatar": "icon-name",',
      '  "tools": ["tool_name_1", "tool_name_2"],',
      '  "isolationMode": "direct" | "docker" | "temp-worktree" | "wsl",',
      '  "systemPrompt": "Comprehensive specialized instructions"',
      '}',
      '',
      `Intent: "${rawIntent}"`,
    ].join('\n');

    const response = await this.llmClient.completePrompt(prompt);
    const parsed = this.safeParseJson(response);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const payload = parsed as Record<string, unknown>;
    const id = request.requestedId
      ? sanitizePersonaId(request.requestedId)
      : sanitizePersonaId(String(payload.id || 'specialist'));

    const name = String(payload.name || 'Specialized Agent').trim();
    const role = String(payload.role || 'Specialized Domain Operator').trim();
    const avatar = String(payload.avatar || 'robot').trim();
    const isolationMode = (request.defaultIsolation || payload.isolationMode || 'direct') as PersonaIsolationMode;
    const tools = Array.isArray(payload.tools) ? payload.tools.map((t) => String(t).trim()) : ['read_file'];
    const systemPrompt = String(payload.systemPrompt || this.buildFallbackSystemPrompt(name, id, role, rawIntent)).trim();

    return {
      id,
      name,
      role,
      avatar,
      systemPrompt,
      allowedTools: Array.from(new Set(tools)),
      allowedDomains: request.allowedDomains || null,
      isolationMode,
      passiveInspectionEnabled: false,
      scheduleRoutines: [],
      metadata: {
        compiledFromIntent: rawIntent,
        synthesizedBy: 'llm-semantic-engine',
        compiledAt: new Date().toISOString(),
      },
    };
  }

  private synthesizeWithSemanticCatalog(
    rawIntent: string,
    request: DynamicPersonaCompilationRequest,
  ): CreatePersonaInput {
    const tokens = this.tokenizeText(rawIntent);
    let bestDomain: SemanticDomainProfile | null = null;
    let highestScore = 0;

    for (const domain of SEMANTIC_DOMAIN_CATALOG) {
      let score = 0;
      for (const concept of domain.coreConcepts) {
        if (tokens.has(concept)) {
          score += 2;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestDomain = domain;
      }
    }

    let id = request.requestedId ? sanitizePersonaId(request.requestedId) : '';
    let name = '';
    let role = '';
    let avatar = 'robot';
    let tools = ['read_file'];
    let isolationMode: PersonaIsolationMode = request.defaultIsolation || 'direct';

    if (bestDomain && highestScore > 0) {
      if (!id) {
        id = bestDomain.id;
      }
      name = bestDomain.name;
      role = bestDomain.role;
      avatar = bestDomain.avatar;
      tools = [...bestDomain.tools];
      isolationMode = request.defaultIsolation || bestDomain.isolation;
    } else {
      if (!id) {
        const firstWords = Array.from(tokens).slice(0, 2).join('-');
        id = sanitizePersonaId(firstWords) || 'custom-specialist';
      }
      name = 'Custom Task Specialist';
      role = 'Specialized Domain Operator';
      avatar = 'sparkles';
      tools = ['read_file', 'write_patch', 'grep_search'];
    }

    const systemPrompt = this.buildFallbackSystemPrompt(name, id, role, rawIntent);

    return {
      id,
      name,
      role,
      avatar,
      systemPrompt,
      allowedTools: Array.from(new Set(tools)),
      allowedDomains: request.allowedDomains || null,
      isolationMode,
      passiveInspectionEnabled: false,
      scheduleRoutines: [],
      metadata: {
        compiledFromIntent: rawIntent,
        synthesizedBy: 'semantic-catalog-engine',
        compiledAt: new Date().toISOString(),
      },
    };
  }

  private buildFallbackSystemPrompt(
    name: string,
    id: string,
    role: string,
    rawIntent: string,
  ): string {
    return [
      `# Role: ${name} (@${id})`,
      `**Mission**: ${role}`,
      '',
      '## Operational Guidelines:',
      `1. Focus strictly on tasks aligned with: "${rawIntent}".`,
      '2. Deliver precise, strictly typed, and directly actionable solutions.',
      '3. Refuse actions outside your designated specialized domain.',
      '4. Preserve existing system invariants and follow clean-code standards.',
    ].join('\n');
  }

  private tokenizeText(text: string): Set<string> {
    const tokens = new Set<string>();
    let currentToken = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i].toLowerCase();
      const code = char.charCodeAt(0);
      const isAlpha = (code >= 97 && code <= 122);
      const isDigit = (code >= 48 && code <= 57);

      if (isAlpha || isDigit) {
        currentToken += char;
      } else {
        if (currentToken.length > 0) {
          tokens.add(currentToken);
          currentToken = '';
        }
      }
    }

    if (currentToken.length > 0) {
      tokens.add(currentToken);
    }

    return tokens;
  }

  private safeParseJson(content: string): unknown {
    try {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        return JSON.parse(content.slice(start, end + 1));
      }
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}
