import fs from 'fs';
import path from 'path';
import { Database } from '../storage/Database.js';
import { LogRepository } from '../storage/LogRepository.js';
import { TaskRepository } from '../storage/TaskRepository.js';
import { TaskManager } from '../orchestrator/TaskManager.js';
import { RuntimeDiagnosticsService } from './RuntimeDiagnosticsService.js';
import { ErrorNormalizationService } from './ErrorNormalizationService.js';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type DiagnosticsExportReport = {
  contractVersion: 'zavorth-diagnostics-export/1';
  exportedAt: string;
  projectRoot: string;
  diagnostics: unknown;
  env: Record<string, string>;
  logs: Array<{
    timestamp: string;
    level: string;
    category: string;
    message: string;
  }>;
};

export class DiagnosticsExporterService {
  private readonly normalizer = ErrorNormalizationService.getInstance();

  public async export(options: { projectRoot: string; outputPath: string }): Promise<DiagnosticsExportReport> {
    const db = await Database.getInstance();
    const logRepo = new LogRepository();
    await logRepo.init();
    const taskRepo = new TaskRepository();
    await taskRepo.init();
    const taskManager = new TaskManager(taskRepo, logRepo);

    const diagnosticsService = new RuntimeDiagnosticsService(taskManager, logRepo);
    const snapshot = diagnosticsService.buildSnapshot();

    // 1. Gather logs from LogRepository
    const recentLogs = logRepo.getRecentLogs(50);
    const sanitizedLogs = recentLogs.map((log) => ({
      timestamp: log.timestamp || '',
      level: log.level,
      category: log.category,
      message: this.normalizer.sanitizeText(log.message || ''),
    }));

    // 2. Gather environment variables (local .env + process.env filtered)
    const env = this.getSanitizedEnv(options.projectRoot);

    // 3. Sanitize the snapshot
    const sanitizedDiagnostics = this.sanitizeObject(snapshot);

    const report: DiagnosticsExportReport = {
      contractVersion: 'zavorth-diagnostics-export/1',
      exportedAt: new Date().toISOString(),
      projectRoot: this.normalizer.sanitizeText(options.projectRoot),
      diagnostics: sanitizedDiagnostics,
      env,
      logs: sanitizedLogs,
    };

    // Write file
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, JSON.stringify(report, null, 2), 'utf8');

    return report;
  }

  private getSanitizedEnv(projectRoot: string): Record<string, string> {
    const result: Record<string, string> = {};

    // 1. Read .env file
    const envPath = path.join(projectRoot, '.env');
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split(/\r...\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            continue;
          }
          const parts = trimmed.split('=');
          const key = parts[0]?.trim();
          const value = parts.slice(1).join('=').trim();
          if (key) {
            if (/(TOKEN|SECRET|PASSWORD|API_KEY|KEY|AUTH|PASS)/i.test(key)) {
              result[key] = '[REDACTED_SECRET]';
            } else {
              result[key] = this.normalizer.sanitizeText(value);
            }
          }
        }
      } catch (error: unknown) {// Fallback or ignore
      logger.warn('[Diagnostics Exporter] operation failed', error);
    }
    }

    // 2. Read from process.env (Zavorth related only)
    for (const [key, value] of Object.entries(process.env)) {
      if (
        key.startsWith('ZAVORTH_') ||
        key.startsWith('TELEGRAM_') ||
        key.startsWith('DISCORD_') ||
        key.startsWith('SLACK_') ||
        key.startsWith('OPENAI_') ||
        key.startsWith('GEMINI_') ||
        key.startsWith('GOOGLE_') ||
        key.startsWith('ANTHROPIC_') ||
        key.startsWith('DEEPSEEK_')
      ) {
        if (/(TOKEN|SECRET|PASSWORD|API_KEY|KEY|AUTH|PASS)/i.test(key)) {
          result[key] = '[REDACTED_SECRET]';
        } else if (value) {
          result[key] = this.normalizer.sanitizeText(value);
        }
      }
    }

    return result;
  }

  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj === 'string') {
      return this.normalizer.sanitizeText(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }
    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        const sanitizedKey = this.normalizer.sanitizeText(key);
        result[sanitizedKey] = this.sanitizeObject(val);
      }
      return result;
    }
    return obj;
  }
}
