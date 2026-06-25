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

  public async validateFeatureCompliance(
    featureId: string,
    modifiedCodeFiles: string[],
  ): Promise<{ compliant: boolean; report: string }> {
    const normalized = this.normalizeFeatureId(featureId);
    const targetDir = path.join(this.projectRoot, 'specs', 'features', ...normalized.split('/'));
    const specPath = path.join(targetDir, 'spec.md');
    const planPath = path.join(targetDir, 'plan.md');

    if (!this.existsSync(specPath) || !this.existsSync(planPath)) {
      return {
        compliant: false,
        report: `Feature specs not found under ${targetDir}. Make sure both spec.md and plan.md exist.`,
      };
    }

    const specContent = this.readTemplate(specPath);
    const planContent = this.readTemplate(planPath);
    const combinedContent = specContent + '\n' + planContent;

    // Scan for files: e.g. src/... or tests/...
    const pathRegex = /\b(?:src|tests)\/[a-zA-Z0-9_\-\/\.]+\b/g;
    const pathsMentioned = Array.from(new Set(combinedContent.match(pathRegex) || []));

    // Scan for classes and methods in backticks
    const classRegex = /`([A-Z][a-zA-Z0-9_]+)`/g;
    const classesMentioned = Array.from(new Set([...combinedContent.matchAll(classRegex)].map((m) => m[1])));

    const methodRegex = /`([a-z][a-zA-Z0-9_]+)`/g;
    const methodsMentioned = Array.from(new Set([...combinedContent.matchAll(methodRegex)].map((m) => m[1])));

    const fileResults: Array<{ path: string; exists: boolean }> = [];
    const signatureResults: Array<{ name: string; type: 'class' | 'method'; found: boolean; file?: string }> = [];

    // Verify paths
    for (const filePath of pathsMentioned) {
      const fullPath = path.join(this.projectRoot, filePath);
      const exists = this.existsSync(fullPath);
      fileResults.push({ path: filePath, exists });

      if (exists) {
        const fileContent = this.readTemplate(fullPath);
        for (const cls of classesMentioned) {
          const clsRegex = new RegExp(`\\b(?:class|type|interface)\\s+${cls}\\b`);
          if (clsRegex.test(fileContent)) {
            const existing = signatureResults.find((r) => r.name === cls && r.type === 'class');
            if (existing) {
              existing.found = true;
              existing.file = filePath;
            } else {
              signatureResults.push({ name: cls, type: 'class', found: true, file: filePath });
            }
          }
        }
        for (const method of methodsMentioned) {
          const mRegex = new RegExp(`\\b(?:function\\s+${method}\\b|${method}\\s*\\(|const\\s+${method}\\s*=)`);
          if (mRegex.test(fileContent)) {
            const existing = signatureResults.find((r) => r.name === method && r.type === 'method');
            if (existing) {
              existing.found = true;
              existing.file = filePath;
            } else {
              signatureResults.push({ name: method, type: 'method', found: true, file: filePath });
            }
          }
        }
      }
    }

    for (const cls of classesMentioned) {
      if (!signatureResults.some((r) => r.name === cls && r.type === 'class')) {
        signatureResults.push({ name: cls, type: 'class', found: false });
      }
    }
    for (const method of methodsMentioned) {
      if (!signatureResults.some((r) => r.name === method && r.type === 'method')) {
        signatureResults.push({ name: method, type: 'method', found: false });
      }
    }

    const missingFiles = fileResults.filter((f) => !f.exists);
    const missingSignatures = signatureResults.filter((s) => !s.found);
    const compliant = missingFiles.length === 0 && missingSignatures.length === 0;

    let report = `# Spec Compliance Report for featureId: ${featureId}\n`;
    report += `Status: ${compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}\n\n`;

    report += `## Checked Files\n`;
    for (const f of fileResults) {
      report += `- [${f.exists ? 'x' : ' '}] ${f.path} (${f.exists ? 'exists' : 'does not exist'})\n`;
    }

    report += `\n## Checked Signatures\n`;
    for (const s of signatureResults) {
      report += `- [${s.found ? 'x' : ' '}] ${s.type === 'class' ? 'Class/Type' : 'Method/Function'} \`${s.name}\`${s.found ? ` (found in ${s.file})` : ' (not found in codebase)'}\n`;
    }

    return { compliant, report };
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
