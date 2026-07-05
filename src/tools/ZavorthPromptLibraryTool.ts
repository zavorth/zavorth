import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  template: string;
  variables: string[];
  version: number;
  usage_count: number;
  avg_quality: number;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export class ZavorthPromptLibraryTool extends BaseTool {
  public readonly name = 'zavorth_prompt_library';

  public readonly description =
    'Prompt Library — optimized prompt templates by task with versioning, A/B testing, and quality tracking.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'get', 'list', 'add', 'update', 'use', 'compare', 'stats', 'categories'.",
      },
      template_id: {
        type: 'string',
        description: 'Template ID.',
      },
      name: {
        type: 'string',
        description: 'Template name.',
      },
      category: {
        type: 'string',
        description: "Category: 'code_gen', 'code_review', 'research', 'summarize', 'translate', 'explain', 'debug', 'creative', 'analysis'.",
      },
      template: {
        type: 'string',
        description: 'Prompt template text with {variable} placeholders.',
      },
      variables: {
        type: 'string',
        description: 'JSON array of variable names.',
      },
      tags: {
        type: 'string',
        description: 'JSON array of tags.',
      },
      quality_score: {
        type: 'number',
        description: 'Quality score (0-1) for feedback.',
      },
      template_b: {
        type: 'string',
        description: 'Second template for A/B comparison.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private templates: PromptTemplate[] = [];

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'prompt-library');
    this.ensureDir();
    this.loadTemplates();
    this.initDefaults();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
  }

  private loadTemplates(): void {
    const filePath = path.join(this.storageDir, 'templates.json');
    if (!fs.existsSync(filePath)) return;
    try { this.templates = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch (error) { /* ignore */ logger.warn('[Zavorth Prompt Library] JSON parse failed', error); }
  }

  private saveTemplates(): void {
    fs.writeFileSync(path.join(this.storageDir, 'templates.json'), JSON.stringify(this.templates, null, 2), 'utf-8');
  }

  private initDefaults(): void {
    if (this.templates.length > 0) return;
    this.templates = [
      { id: 'PROMPT-001', name: 'Code Generation', category: 'code_gen', template: 'Write {language} code that {description}. Requirements: {requirements}. Follow best practices and include error handling.', variables: ['language', 'description', 'requirements'], version: 1, usage_count: 0, avg_quality: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['code', 'generation'] },
      { id: 'PROMPT-002', name: 'Code Review', category: 'code_review', template: 'Review this {language} code for bugs, security issues, and improvements:\n\n```{language}\n{code}\n```\n\nFocus on: {focus_areas}', variables: ['language', 'code', 'focus_areas'], version: 1, usage_count: 0, avg_quality: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['code', 'review'] },
      { id: 'PROMPT-003', name: 'Research Summary', category: 'research', template: 'Research "{topic}" and provide:\n1. Key findings\n2. Current state of the art\n3. Practical recommendations\n4. Sources cited\n\nConstraints: {constraints}', variables: ['topic', 'constraints'], version: 1, usage_count: 0, avg_quality: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['research', 'summary'] },
      { id: 'PROMPT-004', name: 'Text Summarization', category: 'summarize', template: 'Summarize the following text in {format} format, keeping the most important points:\n\n{text}\n\nMax length: {max_length}', variables: ['format', 'text', 'max_length'], version: 1, usage_count: 0, avg_quality: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['summarize', 'text'] },
      { id: 'PROMPT-005', name: 'Translation', category: 'translate', template: 'Translate the following text from {source_lang} to {target_lang}. Maintain tone and context:\n\n{text}', variables: ['source_lang', 'target_lang', 'text'], version: 1, usage_count: 0, avg_quality: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['translate', 'language'] },
      { id: 'PROMPT-006', name: 'Technical Explanation', category: 'explain', template: 'Explain {concept} to a {audience_level} audience. Use {style} style. Include examples.', variables: ['concept', 'audience_level', 'style'], version: 1, usage_count: 0, avg_quality: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['explain', 'education'] },
      { id: 'PROMPT-007', name: 'Bug Debugging', category: 'debug', template: 'Debug this {language} code that produces "{error}":\n\n```{language}\n{code}\n```\n\nSteps taken: {steps_taken}', variables: ['language', 'error', 'code', 'steps_taken'], version: 1, usage_count: 0, avg_quality: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['debug', 'code'] },
      { id: 'PROMPT-008', name: 'Creative Writing', category: 'creative', template: 'Write a {type} about {topic}. Style: {style}. Length: {length}. Audience: {audience}.', variables: ['type', 'topic', 'style', 'length', 'audience'], version: 1, usage_count: 0, avg_quality: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['creative', 'writing'] },
      { id: 'PROMPT-009', name: 'Data Analysis', category: 'analysis', template: 'Analyze this data and provide:\n1. Key patterns\n2. Anomalies\n3. Recommendations\n\nData:\n{data}\n\nContext: {context}', variables: ['data', 'context'], version: 1, usage_count: 0, avg_quality: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['analysis', 'data'] },
      { id: 'PROMPT-010', name: 'API Documentation', category: 'code_gen', template: 'Generate API documentation for this endpoint:\n\nMethod: {method}\nPath: {path}\nDescription: {description}\nParameters: {parameters}\nResponse: {response_example}', variables: ['method', 'path', 'description', 'parameters', 'response_example'], version: 1, usage_count: 0, avg_quality: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['api', 'docs'] },
    ];
    this.saveTemplates();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'get': return this.getTemplate(args);
      case 'list': return this.listTemplates(args);
      case 'add': return this.addTemplate(args);
      case 'update': return this.updateTemplate(args);
      case 'use': return this.useTemplate(args);
      case 'compare': return this.compareTemplates(args);
      case 'stats': return this.getStats();
      case 'categories': return this.getCategories();
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private getTemplate(args: Record<string, unknown>): string {
    const id = String(args.template_id || '');
    if (!id) return 'Error: "template_id" is required.';

    const template = this.templates.find((t) => t.id === id);
    if (!template) return `Error: template "${id}" not found.`;

    return [
      `Prompt Template: ${template.name} (${template.id})`,
      `  Category: ${template.category}`,
      `  Version: ${template.version}`,
      `  Variables: ${template.variables.join(', ')}`,
      `  Usage: ${template.usage_count} times`,
      `  Avg quality: ${(template.avg_quality * 100).toFixed(0)}%`,
      `  Tags: ${template.tags.join(', ')}`,
      '',
      'Template:',
      template.template,
    ].join('\n');
  }

  private listTemplates(args: Record<string, unknown>): string {
    const category = typeof args.category === 'string' ? args.category : undefined;
    let templates = [...this.templates];
    if (category) templates = templates.filter((t) => t.category === category);

    const lines: string[] = [`Prompt Templates (${templates.length}):`];
    for (const t of templates) {
      lines.push(`  ${t.id}: ${t.name} [${t.category}] used:${t.usage_count} quality:${(t.avg_quality * 100).toFixed(0)}%`);
    }
    return lines.join('\n');
  }

  private addTemplate(args: Record<string, unknown>): string {
    const name = String(args.name || '');
    const template = String(args.template || '');
    if (!name || !template) return 'Error: "name" and "template" are required.';

    const id = `PROMPT-${String(this.templates.length + 1).padStart(3, '0')}`;
    let variables: string[] = [];
    const matches = template.match(/\{(\w+)\}/g);
    if (matches) variables = [...new Set(matches.map((m) => m.slice(1, -1)))];

    let tags: string[] = [];
    if (typeof args.tags === 'string') { try { tags = JSON.parse(args.tags); } catch (error) { /* ignore */ logger.warn('[Zavorth Prompt Library] JSON parse failed', error); } }

    this.templates.push({
      id, name,
      category: String(args.category || 'general'),
      template, variables, version: 1,
      usage_count: 0, avg_quality: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags,
    });
    this.saveTemplates();

    return `Template "${name}" added with ID ${id}. Variables: ${variables.join(', ')}`;
  }

  private updateTemplate(args: Record<string, unknown>): string {
    const id = String(args.template_id || '');
    if (!id) return 'Error: "template_id" is required.';

    const template = this.templates.find((t) => t.id === id);
    if (!template) return `Error: template "${id}" not found.`;

    if (args.template) {
      template.template = String(args.template);
      template.version++;
      const matches = template.template.match(/\{(\w+)\}/g);
      if (matches) template.variables = [...new Set(matches.map((m) => m.slice(1, -1)))];
    }
    if (args.name) template.name = String(args.name);
    template.updated_at = new Date().toISOString();

    this.saveTemplates();
    return `Template "${template.name}" updated to v${template.version}.`;
  }

  private useTemplate(args: Record<string, unknown>): string {
    const id = String(args.template_id || '');
    if (!id) return 'Error: "template_id" is required.';

    const template = this.templates.find((t) => t.id === id);
    if (!template) return `Error: template "${id}" not found.`;

    template.usage_count++;
    this.saveTemplates();

    return `Template "${template.name}" used (${template.usage_count} total uses).\nVariables to fill: ${template.variables.join(', ')}`;
  }

  private compareTemplates(args: Record<string, unknown>): string {
    const idA = String(args.template_id || '');
    const idB = String(args.template_b || '');
    if (!idA || !idB) return 'Error: "template_id" and "template_b" are required.';

    const tA = this.templates.find((t) => t.id === idA);
    const tB = this.templates.find((t) => t.id === idB);
    if (!tA || !tB) return 'Error: one or both templates not found.';

    return [
      'Template Comparison:',
      '',
      `  ${tA.name} (${tA.id}):`,
      `    Quality: ${(tA.avg_quality * 100).toFixed(0)}% | Usage: ${tA.usage_count} | Version: ${tA.version}`,
      `    Variables: ${tA.variables.join(', ')}`,
      '',
      `  ${tB.name} (${tB.id}):`,
      `    Quality: ${(tB.avg_quality * 100).toFixed(0)}% | Usage: ${tB.usage_count} | Version: ${tB.version}`,
      `    Variables: ${tB.variables.join(', ')}`,
      '',
      `  Winner: ${tA.avg_quality > tB.avg_quality ? tA.name : tB.avg_quality > tA.avg_quality ? tB.name : 'Tie'}`,
    ].join('\n');
  }

  private getStats(): string {
    const totalUsage = this.templates.reduce((sum, t) => sum + t.usage_count, 0);
    const avgQuality = this.templates.length > 0
      ? this.templates.reduce((sum, t) => sum + t.avg_quality, 0) / this.templates.length
      : 0;

    const byCategory: Record<string, number> = {};
    for (const t of this.templates) byCategory[t.category] = (byCategory[t.category] || 0) + 1;

    return [
      'Prompt Library Stats:',
      `  Templates: ${this.templates.length}`,
      `  Total usage: ${totalUsage}`,
      `  Avg quality: ${(avgQuality * 100).toFixed(1)}%`,
      '',
      'By category:',
      ...Object.entries(byCategory).map(([cat, count]) => `  ${cat}: ${count}`),
    ].join('\n');
  }

  private getCategories(): string {
    const categories = new Set(this.templates.map((t) => t.category));
    return `Categories: ${[...categories].sort().join(', ')}`;
  }
}
