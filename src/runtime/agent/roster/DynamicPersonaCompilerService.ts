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

export class DynamicPersonaCompilerService {
  public async compileFromIntent(
    request: DynamicPersonaCompilationRequest,
  ): Promise<CreatePersonaInput> {
    const rawIntent = String(request.userIntent || '').trim();
    if (!rawIntent) {
      throw new Error('User intent cannot be empty when dynamically compiling a persona.');
    }

    const intentLower = rawIntent.toLowerCase();

    let id = request.requestedId ? sanitizePersonaId(request.requestedId) : '';
    let name = '';
    let role = '';
    let avatar = 'robot';
    const tools: string[] = ['read_file'];
    let isolationMode: PersonaIsolationMode = request.defaultIsolation || 'direct';

    if (intentLower.includes('sql') || intentLower.includes('postgres') || intentLower.includes('banco') || intentLower.includes('database')) {
      if (!id) id = 'database-specialist';
      name = 'Database Specialist';
      role = 'SQL & Database Performance Specialist';
      avatar = 'database';
      tools.push('database_query', 'database_explain');
    } else if (intentLower.includes('secur') || intentLower.includes('vulnerab') || intentLower.includes('audit') || intentLower.includes('perigo')) {
      if (!id) id = 'security-specialist';
      name = 'Security Specialist';
      role = 'Code Security & Vulnerability Auditor';
      avatar = 'shield';
      tools.push('grep_search');
    } else if (intentLower.includes('scrape') || intentLower.includes('web') || intentLower.includes('crawler') || intentLower.includes('browser')) {
      if (!id) id = 'web-navigator';
      name = 'Web Navigator';
      role = 'Web Scraping & Navigation Specialist';
      avatar = 'globe';
      tools.push('read_url_content', 'playwright_browser');
      isolationMode = 'docker';
    } else if (intentLower.includes('ui') || intentLower.includes('react') || intentLower.includes('frontend') || intentLower.includes('css')) {
      if (!id) id = 'frontend-architect';
      name = 'Frontend Architect';
      role = 'UI/UX & Frontend Design Specialist';
      avatar = 'palette';
      tools.push('write_patch');
    } else {
      if (!id) id = 'custom-specialist';
      name = 'Custom Task Specialist';
      role = 'Specialized Domain Operator';
      avatar = 'sparkles';
      tools.push('write_patch', 'grep_search');
    }

    const systemPrompt = [
      `# Role: ${name} (@${id})`,
      `**Mission**: ${role}`,
      '',
      '## Operational Guidelines:',
      `1. Focus strictly on tasks aligned with: "${rawIntent}".`,
      '2. Deliver precise, strictly typed, and directly actionable solutions.',
      '3. Refuse actions outside your designated specialized domain.',
      '4. Preserve existing system invariants and follow clean-code standards.',
    ].join('\n');

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
        compiledAt: new Date().toISOString(),
      },
    };
  }
}
