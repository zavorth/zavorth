import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type PersonalizationValidationFinding = {
  file: string;
  severity: 'error' | 'warning';
  message: string;
  fix: string;
};

export type PersonalizationValidationResult = {
  ok: boolean;
  profileRoot: string;
  legacyRoot: string;
  findings: PersonalizationValidationFinding[];
  resolvedFiles: Record<'identity' | 'soul' | 'user' | 'tools' | 'agents', string>;
};

type Runtime = {
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
};

const REQUIRED_FIELDS: Record<'identity' | 'user' | 'soul', string[]> = {
  identity: ['Primary name', 'Role', 'Core promise'],
  user: ['What to call them', 'Primary language', 'Preferred tone from the agent'],
  soul: ['Baseline character'],
};

export class PersonalizationConfigSchemaService {
  private readonly projectRoot: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;

  constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || config.projectRoot);
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public validate(): PersonalizationValidationResult {
    const files = this.resolveFiles();
    const findings: PersonalizationValidationFinding[] = [];
    for (const key of Object.keys(REQUIRED_FIELDS) as Array<keyof typeof REQUIRED_FIELDS>) {
      const file = files[key];
      if (!this.existsSync(file)) {
        findings.push({
          file,
          severity: 'error',
          message: `${path.basename(file)} is missing.`,
          fix: 'Run zavorth setup or zavorth config migrate to create governed profile files.',
        });
        continue;
      }
      const content = this.readText(file);
      for (const field of REQUIRED_FIELDS[key]) {
        if (!hasMarkdownFieldOrHeading(content, field)) {
          findings.push({
            file,
            severity: 'error',
            message: `${path.basename(file)} does not define ${field}.`,
            fix: `Add a markdown field or heading for "${field}".`,
          });
        }
      }
    }
    for (const key of ['tools', 'agents'] as const) {
      const file = files[key];
      if (!this.existsSync(file)) {
        findings.push({
          file,
          severity: 'warning',
          message: `${path.basename(file)} is missing; runtime will continue with defaults.`,
          fix: `Create ${path.relative(this.projectRoot, file)} when you need explicit ${key} instructions.`,
        });
      }
    }
    return {
      ok: findings.every((finding) => finding.severity !== 'error'),
      profileRoot: path.join(this.projectRoot, '.zavorth', 'profile'),
      legacyRoot: this.projectRoot,
      findings,
      resolvedFiles: files,
    };
  }

  public migrate(): PersonalizationValidationResult {
    const profileRoot = path.join(this.projectRoot, '.zavorth', 'profile');
    this.mkdirSync(profileRoot, { recursive: true });
    const mapping = {
      IDENTITY: 'identity.md',
      SOUL: 'soul.md',
      USER: 'user.md',
      TOOLS: 'tools.md',
      AGENTS: 'agents.md',
    };
    for (const [legacyName, profileName] of Object.entries(mapping)) {
      const source = path.join(this.projectRoot, `${legacyName}.md`);
      const target = path.join(profileRoot, profileName);
      if (this.existsSync(source) && !this.existsSync(target)) {
        this.writeFileSync(target, this.readText(source), 'utf8');
      }
    }
    return this.validate();
  }

  private resolveFiles(): PersonalizationValidationResult['resolvedFiles'] {
    const profileRoot = path.join(this.projectRoot, '.zavorth', 'profile');
    return {
      identity: this.resolvePreferred(path.join(profileRoot, 'identity.md'), path.join(this.projectRoot, 'IDENTITY.md')),
      soul: this.resolvePreferred(path.join(profileRoot, 'soul.md'), path.join(this.projectRoot, 'SOUL.md')),
      user: this.resolvePreferred(path.join(profileRoot, 'user.md'), path.join(this.projectRoot, 'USER.md')),
      tools: this.resolvePreferred(path.join(profileRoot, 'tools.md'), path.join(this.projectRoot, 'TOOLS.md')),
      agents: this.resolvePreferred(path.join(profileRoot, 'agents.md'), path.join(this.projectRoot, 'AGENTS.md')),
    };
  }

  private resolvePreferred(preferred: string, legacy: string): string {
    return this.existsSync(preferred) ? preferred : legacy;
  }

  private readText(file: string): string {
    try {
      return String(this.readFileSync(file, 'utf8') || '');
    } catch (error: any) { logger.warn('[Personalization  Schema] filesystem operation failed', error); return ''; }
  }
}

function hasMarkdownFieldOrHeading(content: string, label: string): boolean {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^[ \\t]*-[ \\t]+\\*\\*${escaped}:\\*\\*\\s*\\S+`, 'mi').test(content)
    || new RegExp(`^#{1,4}\\s+${escaped}\\s*$`, 'mi').test(content);
}
