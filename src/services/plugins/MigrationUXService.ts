import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface AgentDetection {
  name: string;
  path: string;
  type: 'legacy-python' | 'legacy-typescript' | 'zavorth' | 'claude' | 'cursor' | 'generic';
  configFiles: string[];
  skills: number;
  providers: number;
  confidence: number;
}

export interface MigrationPlan {
  source: AgentDetection;
  items: MigrationItem[];
  warnings: string[];
  estimatedTime: string;
}

export interface MigrationItem {
  type: 'config' | 'skill' | 'provider' | 'memory' | 'preference';
  name: string;
  sourcePath: string;
  targetPath: string;
  status: 'pending' | 'migrating' | 'done' | 'skipped' | 'error';
  reason?: string;
}

export class MigrationUXService {
  private readonly storageDir: string;
  private readonly knownAgents: Map<string, string[]> = new Map();

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'migration-ux');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.initKnownAgents();
  }

  private initKnownAgents(): void {
    // Known config file patterns for each agent
    this.knownAgents.set('legacy-python', [
      'agent_state.py', 'state.py', 'config.yaml', 'config.yml',
      'agent/', 'skills/', 'providers/', 'memory/'
    ]);
    this.knownAgents.set('legacy-typescript', [
      'agent.json', 'workspace.json', 'config.json',
      'src/', 'skills/', 'channels/', 'plugins/'
    ]);
    this.knownAgents.set('zavorth', [
      'zavorth.json', 'IDENTITY.md', 'SOUL.md', 'USER.md',
      'src/', 'skill-library/', 'config/', 'data/'
    ]);
    this.knownAgents.set('claude', [
      'CLAUDE.md', '.claude/', 'claude.json',
      'settings/', 'projects/'
    ]);
    this.knownAgents.set('cursor', [
      '.cursor/', 'cursor.json', '.cursorrules',
      'settings/', 'prompts/'
    ]);
  }

  public detectAgent(sourcePath: string): AgentDetection | null {
    if (!fs.existsSync(sourcePath)) return null;

    const files = fs.readdirSync(sourcePath);
    const detection: AgentDetection = {
      name: path.basename(sourcePath),
      path: sourcePath,
      type: 'generic',
      configFiles: [],
      skills: 0,
      providers: 0,
      confidence: 0,
    };

    // Check each known agent pattern
    for (const [agentType, patterns] of this.knownAgents) {
      let matches = 0;
      const matchedFiles: string[] = [];

      for (const pattern of patterns) {
        const fullPath = path.join(sourcePath, pattern);
        if (fs.existsSync(fullPath)) {
          matches++;
          matchedFiles.push(pattern);
        }
      }

      const confidence = matches / patterns.length;
      if (confidence > detection.confidence) {
        detection.type = agentType as AgentDetection['type'];
        detection.confidence = confidence;
        detection.configFiles = matchedFiles;
      }
    }

    // Count skills
    const skillsDir = this.findSkillsDirectory(sourcePath);
    if (skillsDir) {
      detection.skills = fs.readdirSync(skillsDir).filter((f: string) => {
        const stat = fs.statSync(path.join(skillsDir, f));
        return stat.isDirectory();
      }).length;
    }

    // Count providers
    const providersDir = this.findProvidersDirectory(sourcePath);
    if (providersDir) {
      detection.providers = fs.readdirSync(providersDir).filter((f: string) =>
        f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml')
      ).length;
    }

    return detection;
  }

  public detectFromName(agentName: string): AgentDetection | null {
    // Common installation paths
    const homeDir = require('os').homedir();
    const commonPaths = [
      path.join(homeDir, agentName),
      path.join(homeDir, `.${agentName}`),
      path.join(homeDir, '.config', agentName),
      path.join(homeDir, 'AppData', 'Roaming', agentName),
      path.join(homeDir, '.local', 'share', agentName),
      path.join(process.cwd(), agentName),
      path.join(process.cwd(), '..', agentName),
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        return this.detectAgent(p);
      }
    }

    return null;
  }

  public planMigration(detection: AgentDetection): MigrationPlan {
    const items: MigrationItem[] = [];
    const warnings: string[] = [];

    // Plan config migration
    for (const configFile of detection.configFiles) {
      const sourcePath = path.join(detection.path, configFile);
      if (fs.existsSync(sourcePath)) {
        const stat = fs.statSync(sourcePath);
        if (stat.isFile()) {
          items.push({
            type: 'config',
            name: configFile,
            sourcePath,
            targetPath: path.join(this.storageDir, 'imported', configFile),
            status: 'pending',
          });
        } else if (stat.isDirectory()) {
          // Scan directory for files
          try {
            const files = fs.readdirSync(sourcePath);
            for (const file of files.slice(0, 100)) { // Limit to 100 files per dir
              const filePath = path.join(sourcePath, file);
              const fileStat = fs.statSync(filePath);
              if (fileStat.isFile()) {
                items.push({
                  type: 'config',
                  name: `${configFile}/${file}`,
                  sourcePath: filePath,
                  targetPath: path.join(this.storageDir, 'imported', configFile, file),
                  status: 'pending',
                });
              }
            }
          } catch (error) { /* ignore permission errors */ logger.warn('[Migration U X] operation failed', error); }
        }
      }
    }

    // Check for secrets
    const secretPatterns = [/api[_-]?key/i, /secret/i, /token/i, /password/i, /credential/i];
    for (const item of items) {
      if (item.type === 'config') {
        try {
          const content = fs.readFileSync(item.sourcePath, 'utf-8');
          for (const pattern of secretPatterns) {
            if (pattern.test(content)) {
              warnings.push(`⚠️ ${item.name} may contain secrets — review before importing`);
              break;
            }
          }
        } catch (error) { /* ignore */ logger.warn('[Migration U X] filesystem operation failed', error); }
      }
    }

    // Estimate time
    const fileCount = items.length;
    const estimatedTime = fileCount < 10 ? '< 1 minute' :
      fileCount < 50 ? '1-2 minutes' :
      fileCount < 100 ? '2-5 minutes' :
      '5+ minutes';

    return {
      source: detection,
      items,
      warnings,
      estimatedTime,
    };
  }

  public executeMigration(plan: MigrationPlan, options?: {
    dryRun?: boolean;
    skipSecrets?: boolean;
    onProgress?: (item: MigrationItem, index: number, total: number) => void;
  }): { success: number; failed: number; skipped: number } {
    const dryRun = options?.dryRun !== false;
    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < plan.items.length; i++) {
      const item = plan.items[i];
      options?.onProgress?.(item, i, plan.items.length);

      if (dryRun) {
        item.status = 'pending';
        continue;
      }

      try {
        // Create target directory
        const targetDir = path.dirname(item.targetPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Copy file
        fs.copyFileSync(item.sourcePath, item.targetPath);
        item.status = 'done';
        success++;
      } catch (error: unknown) {
        item.status = 'error';
        item.reason = error instanceof Error ? error.message : String(error);
        failed++;
      }
    }

    return { success, failed, skipped };
  }

  public generateReport(plan: MigrationPlan, result: { success: number; failed: number; skipped: number }): string {
    const lines: string[] = [
      '=== Migration Report ===',
      '',
      `Source: ${plan.source.name} (${plan.source.type})`,
      `Path: ${plan.source.path}`,
      `Confidence: ${(plan.source.confidence * 100).toFixed(0)}%`,
      '',
      'Items:',
      `  Total: ${plan.items.length}`,
      `  Success: ${result.success}`,
      `  Failed: ${result.failed}`,
      `  Skipped: ${result.skipped}`,
      '',
    ];

    if (plan.warnings.length > 0) {
      lines.push('Warnings:');
      for (const warning of plan.warnings) {
        lines.push(`  ${warning}`);
      }
      lines.push('');
    }

    lines.push(`Estimated time: ${plan.estimatedTime}`);

    return lines.join('\n');
  }

  private findSkillsDirectory(sourcePath: string): string | null {
    const candidates = ['skills', 'skill-library', 'agent/skills'];
    for (const candidate of candidates) {
      const fullPath = path.join(sourcePath, candidate);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        return fullPath;
      }
    }
    return null;
  }

  private findProvidersDirectory(sourcePath: string): string | null {
    const candidates = ['providers', 'config/providers', 'agent/providers'];
    for (const candidate of candidates) {
      const fullPath = path.join(sourcePath, candidate);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        return fullPath;
      }
    }
    return null;
  }
}
