import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export type SddScaffoldInput = {
  featureId: string;
  title: string;
};

export type SddScaffoldResult = {
  featureId: string;
  title: string;
  targetDir: string;
  filesCreated: string[];
  filesSkipped: string[];
};

type SpecDrivenDevelopmentRuntime = {
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
};

export class SpecDrivenDevelopmentService {
  private readonly projectRoot: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: SpecDrivenDevelopmentRuntime = {}) {
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public scaffoldFeature(input: SddScaffoldInput): SddScaffoldResult {
    const featureId = this.normalizeFeatureId(input.featureId);
    const title = String(input.title || '').trim();
    if (!featureId) {
      throw new Error('featureId obrigatorio para o scaffold SDD.');
    }
    if (!title) {
      throw new Error('title obrigatorio para o scaffold SDD.');
    }

    const targetDir = path.join(this.projectRoot, 'specs', 'features', ...featureId.split('/'));
    const templatesDir = path.join(this.projectRoot, 'specs', '_templates');
    const specTemplate = this.readTemplate(path.join(templatesDir, 'feature-spec.md'));
    const planTemplate = this.readTemplate(path.join(templatesDir, 'feature-plan.md'));
    const tasksTemplate = this.readTemplate(path.join(templatesDir, 'feature-tasks.md'));

    this.mkdirSync(targetDir, { recursive: true });

    const replacements = {
      '{{FEATURE_ID}}': featureId,
      '{{FEATURE_TITLE}}': title,
      '{{FEATURE_PATH}}': `specs/features/${featureId}`,
    };

    const files = [
      { name: 'spec.md', content: this.applyTemplate(specTemplate, replacements) },
      { name: 'plan.md', content: this.applyTemplate(planTemplate, replacements) },
      { name: 'tasks.md', content: this.applyTemplate(tasksTemplate, replacements) },
    ];

    const filesCreated: string[] = [];
    const filesSkipped: string[] = [];

    for (const file of files) {
      const filePath = path.join(targetDir, file.name);
      if (this.existsSync(filePath)) {
        filesSkipped.push(filePath);
        continue;
      }
      this.writeFileSync(filePath, file.content, 'utf8');
      filesCreated.push(filePath);
    }

    return {
      featureId,
      title,
      targetDir,
      filesCreated,
      filesSkipped,
    };
  }

  private readTemplate(filePath: string): string {
    return this.readFileSync(filePath, 'utf8');
  }

  private applyTemplate(template: string, replacements: Record<string, string>): string {
    let output = template;
    for (const [needle, value] of Object.entries(replacements)) {
      output = output.split(needle).join(value);
    }
    return output;
  }

  private normalizeFeatureId(rawValue: string): string {
    return String(rawValue || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .map((part) => part.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''))
      .filter(Boolean)
      .join('/');
  }
}
