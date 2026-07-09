import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  ZavorthWorkflowTemplate,
  ZavorthWorkflowStep,
} from '../contracts/WorkflowTemplateContract.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../logger.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type WorkflowTemplateServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

const DEFAULT_WORKFLOWS = `# WORKFLOWS.md - Workflow Templates

## Templates

`;

export class WorkflowTemplateService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: WorkflowTemplateServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public getStatus(): { templateCount: number; filePath: string } {
    const templates = this.listTemplates();
    return { templateCount: templates.length, filePath: this.resolveFile() };
  }

  public addTemplate(template: Omit<ZavorthWorkflowTemplate, 'addedAt'>): ZavorthWorkflowTemplate {
    const full: ZavorthWorkflowTemplate = { ...template, addedAt: new Date().toISOString() };
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_WORKFLOWS);
    const sectionContent = this.readSection(content, 'Templates');
    const block = this.templateToBlock(full);
    const updated = this.upsertSection(content, 'Templates', this.appendToSection(sectionContent, block));
    this.writeText(filePath, updated);
    return full;
  }

  public removeTemplate(id: string): boolean {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_WORKFLOWS);
    const templates = this.listTemplates();
    if (!templates.find((t) => t.id === id)) return false;
    const sectionContent = this.readSection(content, 'Templates');
    const blocks = sectionContent.split(/\n(?=### )/);
    const filtered = blocks.filter((b) => !b.includes(`<!-- id:${id} -->`));
    const updated = this.upsertSection(content, 'Templates', filtered.join('\n').trim());
    this.writeText(filePath, updated);
    return true;
  }

  public listTemplates(): ZavorthWorkflowTemplate[] {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_WORKFLOWS);
    const sectionContent = this.readSection(content, 'Templates');
    const templates: ZavorthWorkflowTemplate[] = [];
    const blocks = sectionContent.split(/\n(?=### )/);
    for (const block of blocks) {
      const template = this.blockToTemplate(block);
      if (template) templates.push(template);
    }
    return templates;
  }

  public getTemplate(id: string): ZavorthWorkflowTemplate | null {
    return this.listTemplates().find((t) => t.id === id) || null;
  }

  public renderSteps(id: string): string {
    const template = this.getTemplate(id);
    if (!template) return '';
    const lines: string[] = [`## ${template.label}`, ''];
    for (const step of template.steps.sort((a, b) => a.order - b.order)) {
      const tool = step.tool ? ` [${step.tool}]` : '';
      const cmd = step.command ? ` \`${step.command}\`` : '';
      lines.push(`- [ ] ${step.order}. ${step.description}${tool}${cmd}`);
    }
    return lines.join('\n');
  }

  private resolveFile(): string {
    return path.join(this.projectRoot, 'WORKFLOWS.md');
  }

  private templateToBlock(template: ZavorthWorkflowTemplate): string {
    const lines: string[] = [
      `### ${template.label}`,
      `<!-- id:${template.id} -->`,
      `${template.description}`,
      '',
      `**Triggers:** ${template.triggers.join(', ') || 'none'}`,
      `**Tags:** ${template.tags.join(', ') || 'none'}`,
      '',
      '**Steps:**',
    ];
    for (const step of template.steps.sort((a, b) => a.order - b.order)) {
      const tool = step.tool ? ` [tool:${step.tool}]` : '';
      const cmd = step.command ? ` [cmd:${step.command}]` : '';
      const out = step.expectedOutput ? ` [out:${step.expectedOutput}]` : '';
      lines.push(`${step.order}. ${step.description}${tool}${cmd}${out}`);
    }
    return lines.join('\n');
  }

  private blockToTemplate(block: string): ZavorthWorkflowTemplate | null {
    const trimmed = block.trim();
    const labelMatch = trimmed.match(/^### (.+)$/m);
    const idMatch = trimmed.match(/<!-- id:(.+?) -->/);
    if (!labelMatch || !idMatch) return null;
    const descMatch = trimmed.match(/^### .+\n<!-- id:.+? -->\n(.+?)(?:\n\n|\n\*\*)/ms);
    const triggersMatch = trimmed.match(/\*\*Triggers:\*\*\s*(.+)$/m);
    const tagsMatch = trimmed.match(/\*\*Tags:\*\*\s*(.+)$/m);
    const steps: ZavorthWorkflowStep[] = [];
    const stepsSection = trimmed.match(/\*\*Steps:\*\*\n([\s\S]*?)(?=\n### |\n*$)/);
    if (stepsSection) {
      const stepLines = stepsSection[1].split(/\r?\n/).filter((l) => l.match(/^\d+\./));
      for (const sl of stepLines) {
        const orderMatch = sl.match(/^(\d+)\.\s+(.+)/);
        if (!orderMatch) continue;
        const order = safeParseInt(orderMatch[1], 0);
        let desc = orderMatch[2];
        const toolM = desc.match(/\[tool:([^\]]+)\]/);
        const cmdM = desc.match(/\[cmd:([^\]]+)\]/);
        const outM = desc.match(/\[out:([^\]]+)\]/);
        desc = desc.replace(/\[tool:[^\]]+\]/, '').replace(/\[cmd:[^\]]+\]/, '').replace(/\[out:[^\]]+\]/, '').trim();
        steps.push({
          order,
          description: desc,
          tool: toolM?.[1],
          command: cmdM?.[1],
          expectedOutput: outM?.[1],
        });
      }
    }
    return {
      id: idMatch[1].trim(),
      label: labelMatch[1].trim(),
      description: descMatch?.[1]?.trim() || '',
      steps,
      triggers: triggersMatch ? triggersMatch[1].split(',').map((t) => t.trim()).filter(Boolean) : [],
      tags: tagsMatch ? tagsMatch[1].split(',').map((t) => t.trim()).filter(Boolean) : [],
      addedAt: new Date().toISOString(),
    };
  }

  private readSection(content: string, title: string): string {
    const escaped = escapeRegExp(title);
    const headerPattern = new RegExp(`^## ${escaped}\\s*$`, 'm');
    const headerMatch = content.match(headerPattern);
    if (!headerMatch) return '';
    const startIdx = headerMatch.index! + headerMatch[0].length;
    const rest = content.slice(startIdx);
    const nextSection = rest.search(/^## /m);
    if (nextSection === -1) return rest.trim();
    return rest.slice(0, nextSection).trim();
  }

  private appendToSection(sectionContent: string, line: string): string {
    const trimmed = sectionContent.trimEnd();
    return trimmed ? `${trimmed}\n${line}` : line;
  }

  private upsertSection(content: string, title: string, section: string): string {
    const escaped = escapeRegExp(title);
    const headerPattern = new RegExp(`^## ${escaped}\\s*$`, 'm');
    const headerMatch = content.match(headerPattern);
    const full = `## ${title}\n\n${section}`;
    if (headerMatch) {
      const startIdx = headerMatch.index! + headerMatch[0].length;
      const rest = content.slice(startIdx);
      const nextSection = rest.search(/^## /m);
      if (nextSection === -1) {
        return content.slice(0, headerMatch.index) + full + '\n';
      }
      return content.slice(0, headerMatch.index) + full + '\n' + rest.slice(nextSection);
    }
    return `${content.trimEnd()}\n\n${full}\n`;
  }

  private readText(filePath: string, fallback: string): string {
    try {
      if (!this.fs.existsSync(filePath)) return fallback;
      return String(this.fs.readFileSync(filePath, 'utf8') || '');
    } catch (error: unknown) {logger.warn('[Workflow Template] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
