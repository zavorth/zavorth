import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type SddAgentRole = 'spec' | 'planner' | 'execution' | 'review';
export type SddRunLifecycle = 'bootstrapping' | 'active' | 'in_review' | 'blocked' | 'completed';

export type SddFeatureTask = {
  lineNumber: number;
  checkbox: 'open' | 'done';
  taskId: string | null;
  text: string;
};

export type SddFeaturePaths = {
  featureId: string;
  featureDir: string;
  specFile: string;
  planFile: string;
  tasksFile: string;
  runStateFile: string;
  handoffFile: string;
};

export type SddRunState = {
  featureId: string;
  title: string;
  lifecycle: SddRunLifecycle;
  currentRole: SddAgentRole;
  currentTask: string | null;
  updatedAt: string;
  startedAt: string;
  lastActor: string;
  note: string | null;
};

export type SddFeatureWorkspaceSnapshot = {
  featureId: string;
  title: string;
  paths: SddFeaturePaths;
  specExists: boolean;
  planExists: boolean;
  tasksExists: boolean;
  specContent: string;
  planContent: string;
  tasksContent: string;
  runState: SddRunState | null;
  openTasks: SddFeatureTask[];
  completedTasks: SddFeatureTask[];
  referencedFiles: string[];
  nextRole: SddAgentRole;
  lifecycle: SddRunLifecycle;
  currentTask: SddFeatureTask | null;
};

type SddFeatureWorkspaceRuntime = {
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  now?: () => Date;
};

const TASK_LINE_PATTERN = /^- \[(x| )\]\s+(T\d+)\.\s+(.+)$/i;
const MARKDOWN_LINK_PATTERN = /\[[^\]]+\]\(([^)]+)\)/g;
const CODE_FILE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.ps1',
  '.md',
]);

export class SddFeatureWorkspaceService {
  private readonly projectRoot: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly now: () => Date;

  constructor(runtime: SddFeatureWorkspaceRuntime = {}) {
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.now = runtime.now || (() => new Date());
  }

  public inspect(featureId: string): SddFeatureWorkspaceSnapshot {
    const paths = this.resolvePaths(featureId);
    const specExists = this.existsSync(paths.specFile);
    const planExists = this.existsSync(paths.planFile);
    const tasksExists = this.existsSync(paths.tasksFile);
    const specContent = specExists ? this.readFileSync(paths.specFile, 'utf8') : '';
    const planContent = planExists ? this.readFileSync(paths.planFile, 'utf8') : '';
    const tasksContent = tasksExists ? this.readFileSync(paths.tasksFile, 'utf8') : '';
    const title = this.resolveTitle(specContent, planContent, paths.featureId);
    const parsedTasks = this.parseTasks(tasksContent);
    const openTasks = parsedTasks.filter((task) => task.checkbox === 'open');
    const completedTasks = parsedTasks.filter((task) => task.checkbox === 'done');
    const nextRole = this.resolveNextRole({
      specExists,
      planExists,
      tasksExists,
      openTasksCount: openTasks.length,
    });
    const lifecycle = this.resolveLifecycle({
      specExists,
      planExists,
      tasksExists,
      openTasksCount: openTasks.length,
    });

    return {
      featureId: paths.featureId,
      title,
      paths,
      specExists,
      planExists,
      tasksExists,
      specContent,
      planContent,
      tasksContent,
      runState: this.readRunState(paths.runStateFile),
      openTasks,
      completedTasks,
      referencedFiles: this.extractReferencedFiles([specContent, planContent, tasksContent]),
      nextRole,
      lifecycle,
      currentTask: openTasks[0] || null,
    };
  }

  public hasScaffold(featureId: string): boolean {
    const paths = this.resolvePaths(featureId);
    return this.existsSync(paths.specFile)
      || this.existsSync(paths.planFile)
      || this.existsSync(paths.tasksFile);
  }

  public ensureControlFiles(featureId: string): SddFeatureWorkspaceSnapshot {
    const snapshot = this.inspect(featureId);
    this.mkdirSync(snapshot.paths.featureDir, { recursive: true });

    if (!this.existsSync(snapshot.paths.runStateFile)) {
      this.writeRunState(snapshot.featureId, {
        title: snapshot.title,
        lifecycle: snapshot.lifecycle,
        currentRole: snapshot.nextRole,
        currentTask: snapshot.currentTask?.text || null,
        lastActor: 'system',
        note: 'Estado inicial do loop SDD criado automaticamente.',
      });
    }

    if (!this.existsSync(snapshot.paths.handoffFile)) {
      this.writeFileSync(
        snapshot.paths.handoffFile,
        [
          '# Handoff',
          '',
          `Feature: \`${snapshot.featureId}\``,
          '',
          '## Ultima passagem',
          '',
          '- Nenhum handoff registrado ainda.',
          '',
        ].join('\n'),
        'utf8',
      );
    }

    return this.inspect(featureId);
  }

  public writeRunState(
    featureId: string,
    state: Omit<SddRunState, 'featureId' | 'updatedAt' | 'startedAt'> & Partial<Pick<SddRunState, 'startedAt'>>,
  ): SddRunState {
    const paths = this.resolvePaths(featureId);
    const previous = this.readRunState(paths.runStateFile);
    const next: SddRunState = {
      featureId: paths.featureId,
      title: state.title,
      lifecycle: state.lifecycle,
      currentRole: state.currentRole,
      currentTask: state.currentTask || null,
      updatedAt: this.now().toISOString(),
      startedAt: previous?.startedAt || state.startedAt || this.now().toISOString(),
      lastActor: state.lastActor,
      note: state.note || null,
    };

    this.mkdirSync(path.dirname(paths.runStateFile), { recursive: true });
    this.writeFileSync(paths.runStateFile, JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  public appendHandoff(
    featureId: string,
    input: {
      role: SddAgentRole;
      actor: string;
      summary: string;
    },
  ): void {
    const snapshot = this.ensureControlFiles(featureId);
    const current = this.existsSync(snapshot.paths.handoffFile)
      ? this.readFileSync(snapshot.paths.handoffFile, 'utf8')
      : '';
    const block = [
      `## ${this.now().toISOString()} | ${input.role}`,
      '',
      `- Actor: ${input.actor}`,
      `- Resumo: ${input.summary}`,
      '',
    ].join('\n');
    this.writeFileSync(snapshot.paths.handoffFile, `${current.trimEnd()}\n\n${block}`, 'utf8');
  }

  public resolvePaths(featureId: string): SddFeaturePaths {
    const normalizedFeatureId = this.normalizeFeatureId(featureId);
    if (!normalizedFeatureId) {
      throw new Error('featureId obrigatorio para o loop SDD.');
    }

    const featureDir = path.join(this.projectRoot, 'specs', 'features', ...normalizedFeatureId.split('/'));
    return {
      featureId: normalizedFeatureId,
      featureDir,
      specFile: path.join(featureDir, 'spec.md'),
      planFile: path.join(featureDir, 'plan.md'),
      tasksFile: path.join(featureDir, 'tasks.md'),
      runStateFile: path.join(featureDir, 'run-state.json'),
      handoffFile: path.join(featureDir, 'handoff.md'),
    };
  }

  private readRunState(filePath: string): SddRunState | null {
    if (!this.existsSync(filePath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(this.readFileSync(filePath, 'utf8')) as Partial<SddRunState>;
      if (!parsed.featureId || !parsed.currentRole || !parsed.lifecycle) {
        return null;
      }
      return {
        featureId: String(parsed.featureId),
        title: String(parsed.title || '').trim() || String(parsed.featureId),
        lifecycle: parsed.lifecycle as SddRunLifecycle,
        currentRole: parsed.currentRole as SddAgentRole,
        currentTask: parsed.currentTask ? String(parsed.currentTask) : null,
        updatedAt: String(parsed.updatedAt || '').trim() || this.now().toISOString(),
        startedAt: String(parsed.startedAt || '').trim() || this.now().toISOString(),
        lastActor: String(parsed.lastActor || '').trim() || 'system',
        note: parsed.note ? String(parsed.note) : null,
      };
    } catch (error: unknown) {logger.warn('[Sdd Feature Workspace] parsing failed', error); return null; }
  }

  private parseTasks(content: string): SddFeatureTask[] {
    return String(content || '')
      .split(/\r?\n/)
      .map((line, index) => {
        const match = line.match(TASK_LINE_PATTERN);
        if (!match) {
          return null;
        }
        return {
          lineNumber: index + 1,
          checkbox: match[1].toLowerCase() === 'x' ? 'done' : 'open',
          taskId: match[2] || null,
          text: String(match[3] || '').trim(),
        } satisfies SddFeatureTask;
      })
      .filter((task): task is SddFeatureTask => Boolean(task));
  }

  private extractReferencedFiles(contents: string[]): string[] {
    const collected = new Set<string>();
    for (const content of contents) {
      let match: RegExpExecArray | null;
      while ((match = MARKDOWN_LINK_PATTERN.exec(content)) !== null) {
        const target = String(match[1] || '').trim();
        if (!target || !/^[A-Za-z]:\\/.test(target)) {
          continue;
        }
        const extension = path.extname(target).toLowerCase();
        if (!CODE_FILE_EXTENSIONS.has(extension)) {
          continue;
        }
        collected.add(target);
      }
      MARKDOWN_LINK_PATTERN.lastIndex = 0;
    }
    return Array.from(collected);
  }

  private resolveTitle(specContent: string, planContent: string, fallbackFeatureId: string): string {
    const sources = [specContent, planContent];
    for (const content of sources) {
      const firstHeading = String(content || '')
        .split(/\r?\n/)
        .find((line) => line.trim().startsWith('# '));
      if (!firstHeading) {
        continue;
      }
      const normalized = firstHeading.replace(/^#\s*/, '').replace(/^(Spec|Plan|Tasks):\s*/i, '').trim();
      if (normalized) {
        return normalized;
      }
    }
    return fallbackFeatureId;
  }

  private resolveNextRole(input: {
    specExists: boolean;
    planExists: boolean;
    tasksExists: boolean;
    openTasksCount: number;
  }): SddAgentRole {
    if (!input.specExists) {
      return 'spec';
    }
    if (!input.planExists || !input.tasksExists) {
      return 'planner';
    }
    if (input.openTasksCount > 0) {
      return 'execution';
    }
    return 'review';
  }

  private resolveLifecycle(input: {
    specExists: boolean;
    planExists: boolean;
    tasksExists: boolean;
    openTasksCount: number;
  }): SddRunLifecycle {
    if (!input.specExists || !input.planExists || !input.tasksExists) {
      return 'bootstrapping';
    }
    if (input.openTasksCount > 0) {
      return 'active';
    }
    return 'in_review';
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
