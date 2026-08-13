import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { logger } from '../logger.js';

export interface WorkspaceProfile {
  workspace: string;
  workspace_name: string;
  slug: string;
  detected_stacks: string[];
  frameworks: string[];
  languages: string[];
  package_manager: string | null;
  scripts: Record<string, string>;
  important_paths: string[];
  instruction_file: string | null;
  instruction_sources: string[];
  instruction_summary: string;
  instruction_notes: string[];
  skill_directories: string[];
  workspace_hooks: WorkspaceHook[];
  workspace_commands: WorkspaceCommand[];
  preferred_executors: {
    code_editing: string;
    code_review: string;
    research: string;
    design: string;
    automation: string;
  };
  summary: string;
  last_refreshed: string;
}

export type WorkspaceHook = {
  event: string;
  command: string;
};

export type WorkspaceCommand = {
  name: string;
  template: string;
};

type WorkspaceInstructionProfile = {
  filePath: string | null;
  sources: string[];
  summary: string;
  notes: string[];
  skillDirectories: string[];
  hooks: WorkspaceHook[];
  commands: WorkspaceCommand[];
};

export class WorkspaceProfileService {
  constructor(private readonly profilesDir = config.workspaceProfilesDir) {}

  public async getProfile(workspaceHint: string | null | undefined): Promise<WorkspaceProfile | null> {
    if (!workspaceHint) {
      return null;
    }

    const workspace = WorkspaceResolver.resolve(workspaceHint);
    if (!fs.existsSync(workspace)) {
      return null;
    }

    const profile = await this.buildProfile(workspace);
    await fs.promises.mkdir(this.profilesDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(this.profilesDir, `${profile.slug}.json`),
      JSON.stringify(profile, null, 2),
      'utf8',
    );
    return profile;
  }

  public buildTaskMetadata(profile: WorkspaceProfile): Record<string, any> {
    return {
      workspace: profile.workspace,
      workspace_name: profile.workspace_name,
      detected_stacks: profile.detected_stacks,
      frameworks: profile.frameworks,
      languages: profile.languages,
      package_manager: profile.package_manager,
      scripts: profile.scripts,
      important_paths: profile.important_paths,
      instruction_file: profile.instruction_file,
      instruction_sources: profile.instruction_sources,
      instruction_summary: profile.instruction_summary,
      instruction_notes: profile.instruction_notes,
      skill_directories: profile.skill_directories,
      workspace_hooks: profile.workspace_hooks,
      workspace_commands: profile.workspace_commands,
      preferred_executors: profile.preferred_executors,
      summary: profile.summary,
      last_refreshed: profile.last_refreshed,
    };
  }

  public buildPlanNotes(profile: WorkspaceProfile | null | undefined): string[] {
    if (!profile) {
      return [];
    }

    const notes = [
      `Perfil do workspace: ${profile.summary}`,
    ];

    if (profile.scripts.build) {
      notes.push(`Comando de build comum: ${profile.scripts.build}`);
    }
    if (profile.scripts.test) {
      notes.push(`Comando de teste comum: ${profile.scripts.test}`);
    }
    if (profile.scripts.dev) {
      notes.push(`Comando de desenvolvimento comum: ${profile.scripts.dev}`);
    }
    if (profile.important_paths.length > 0) {
      notes.push(`Caminhos importantes: ${profile.important_paths.join(', ')}`);
    }
    if (profile.instruction_summary) {
      notes.push(`Instrucoes do workspace: ${profile.instruction_summary}`);
    }
    if (profile.instruction_notes.length > 0) {
      notes.push(`Regras-chave do workspace: ${profile.instruction_notes.slice(0, 4).join(' | ')}`);
    }
    if (profile.skill_directories.length > 0) {
      notes.push(`Skills locais detectadas em: ${profile.skill_directories.join(', ')}`);
    }
    if (profile.workspace_hooks.length > 0) {
      const hookSummary = profile.workspace_hooks
        .slice(0, 4)
        .map((hook) => `${hook.event} -> ${hook.command}`)
        .join(' | ');
      notes.push(`Hooks operacionais do workspace: ${hookSummary}`);
    }
    if (profile.workspace_commands.length > 0) {
      const commandSummary = profile.workspace_commands
        .slice(0, 4)
        .map((command) => `/${command.name} -> ${command.template}`)
        .join(' | ');
      notes.push(`Reusable workspace commands: ${commandSummary}`);
    }

    return notes;
  }

  private async buildProfile(workspace: string): Promise<WorkspaceProfile> {
    const workspaceName = path.basename(workspace);
    const packageJson = await this.readPackageJson(workspace);
    const lockFiles = await this.detectLockFiles(workspace);
    const frameworks = this.detectFrameworks(packageJson);
    const languages = this.detectLanguages(workspace, packageJson);
    const detectedStacks = this.detectStacks(workspace, packageJson, frameworks, languages);
    const scripts = this.extractScripts(packageJson);
    const packageManager = this.detectPackageManager(lockFiles);
    const importantPaths = this.detectImportantPaths(workspace);
    const instructions = await this.readWorkspaceInstructions(workspace);
    const summary = this.buildSummary({
      workspaceName,
      detectedStacks,
      frameworks,
      languages,
      packageManager,
      scripts,
      importantPaths,
      instructionFile: instructions.filePath,
    });

    return {
      workspace,
      workspace_name: workspaceName,
      slug: this.slugify(workspace),
      detected_stacks: detectedStacks,
      frameworks,
      languages,
      package_manager: packageManager,
      scripts,
      important_paths: importantPaths,
      instruction_file: instructions.filePath,
      instruction_sources: instructions.sources,
      instruction_summary: instructions.summary,
      instruction_notes: instructions.notes,
      skill_directories: instructions.skillDirectories,
      workspace_hooks: instructions.hooks,
      workspace_commands: instructions.commands,
      preferred_executors: {
        code_editing: 'codex',
        code_review: 'external_executor',
        research: 'aistudio',
        design: 'stitch',
        automation: 'zavorthBridge',
      },
      summary,
      last_refreshed: new Date().toISOString(),
    };
  }

  private async readPackageJson(workspace: string): Promise<Record<string, any> | null> {
    const packageJsonPath = path.join(workspace, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }

    try {
      return JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8')) as Record<string, any>;
    } catch (error: unknown) {logger.warn('[Workspace Profile] JSON parse failed', error); return null; }
  }

  private async detectLockFiles(workspace: string): Promise<string[]> {
    const candidates = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', 'bun.lockb', 'bun.lock'];
    return candidates.filter((fileName) => fs.existsSync(path.join(workspace, fileName)));
  }

  private detectFrameworks(packageJson: Record<string, any> | null): string[] {
    const deps = {
      ...(packageJson?.dependencies || {}),
      ...(packageJson?.devDependencies || {}),
    } as Record<string, string>;

    const frameworks: string[] = [];
    const knownMatches: Array<[string, string]> = [
      ['next', 'nextjs'],
      ['react', 'react'],
      ['vue', 'vue'],
      ['svelte', 'svelte'],
      ['@angular/core', 'angular'],
      ['express', 'express'],
      ['fastify', 'fastify'],
      ['nestjs', 'nestjs'],
      ['vite', 'vite'],
      ['tailwindcss', 'tailwind'],
      ['electron', 'electron'],
      ['grammy', 'telegram-bot'],
      ['jest', 'jest'],
      ['typescript', 'typescript'],
    ];

    for (const [dependencyName, label] of knownMatches) {
      if (dependencyName in deps && !frameworks.includes(label)) {
        frameworks.push(label);
      }
    }

    return frameworks;
  }

  private detectLanguages(workspace: string, packageJson: Record<string, any> | null): string[] {
    const languages: string[] = [];
    if (packageJson || fs.existsSync(path.join(workspace, 'tsconfig.json'))) {
      languages.push('javascript');
    }
    if (fs.existsSync(path.join(workspace, 'tsconfig.json')) || this.directoryContainsExtension(workspace, '.ts', '.tsx')) {
      languages.push('typescript');
    }
    if (fs.existsSync(path.join(workspace, 'requirements.txt')) || fs.existsSync(path.join(workspace, 'pyproject.toml'))) {
      languages.push('python');
    }
    if (fs.existsSync(path.join(workspace, 'Cargo.toml'))) {
      languages.push('rust');
    }
    if (fs.existsSync(path.join(workspace, 'go.mod'))) {
      languages.push('go');
    }
    if (this.directoryContainsExtension(workspace, '.csproj', '.sln')) {
      languages.push('dotnet');
    }
    if (this.directoryContainsExtension(workspace, '.html', '.css')) {
      languages.push('web');
    }

    return Array.from(new Set(languages));
  }

  private detectStacks(
    workspace: string,
    packageJson: Record<string, any> | null,
    frameworks: string[],
    languages: string[],
  ): string[] {
    const stacks: string[] = [];

    if (packageJson) {
      stacks.push('nodejs');
    }
    if (languages.includes('typescript') || languages.includes('javascript')) {
      stacks.push('javascript-app');
    }
    if (frameworks.some((item) => ['react', 'nextjs', 'vue', 'svelte', 'angular', 'vite', 'tailwind'].includes(item))) {
      stacks.push('frontend');
    }
    if (frameworks.some((item) => ['express', 'fastify', 'nestjs'].includes(item))) {
      stacks.push('backend');
    }
    if (languages.includes('python')) {
      stacks.push('python');
    }
    if (languages.includes('rust')) {
      stacks.push('rust');
    }
    if (languages.includes('go')) {
      stacks.push('go');
    }
    if (languages.includes('dotnet')) {
      stacks.push('dotnet');
    }
    if (fs.existsSync(path.join(workspace, 'docker-compose.yml')) || fs.existsSync(path.join(workspace, 'Dockerfile'))) {
      stacks.push('containerized');
    }
    if (fs.existsSync(path.join(workspace, 'tests')) || fs.existsSync(path.join(workspace, '__tests__'))) {
      stacks.push('tested');
    }

    return Array.from(new Set(stacks));
  }

  private extractScripts(packageJson: Record<string, any> | null): Record<string, string> {
    const scripts = packageJson?.scripts && typeof packageJson.scripts === 'object'
      ? packageJson.scripts as Record<string, string>
      : {};

    const selectedKeys = ['dev', 'build', 'test', 'lint', 'start'];
    const selected: Record<string, string> = {};
    for (const key of selectedKeys) {
      const value = String(scripts[key] || '').trim();
      if (value) {
        selected[key] = value;
      }
    }

    return selected;
  }

  private detectPackageManager(lockFiles: string[]): string | null {
    if (lockFiles.includes('pnpm-lock.yaml')) {
      return 'pnpm';
    }
    if (lockFiles.includes('yarn.lock')) {
      return 'yarn';
    }
    if (lockFiles.includes('package-lock.json')) {
      return 'npm';
    }
    if (lockFiles.includes('bun.lockb') || lockFiles.includes('bun.lock')) {
      return 'bun';
    }
    return null;
  }

  private detectImportantPaths(workspace: string): string[] {
    const candidates = ['src', 'app', 'pages', 'public', 'tests', '__tests__', 'scripts', 'docs', 'config', '.agents/skills', 'skills'];
    return candidates
      .filter((segment) => fs.existsSync(path.join(workspace, segment)))
      .map((segment) => path.join(workspace, segment).replace(/\\/g, '/'));
  }

  private buildSummary(input: {
    workspaceName: string;
    detectedStacks: string[];
    frameworks: string[];
    languages: string[];
    packageManager: string | null;
    scripts: Record<string, string>;
    importantPaths: string[];
    instructionFile: string | null;
  }): string {
    const parts = [
      `Workspace ${input.workspaceName}`,
      input.detectedStacks.length > 0 ? `stacks ${input.detectedStacks.join(', ')}` : null,
      input.frameworks.length > 0 ? `frameworks ${input.frameworks.join(', ')}` : null,
      input.languages.length > 0 ? `linguagens ${input.languages.join(', ')}` : null,
      input.packageManager ? `package manager ${input.packageManager}` : null,
      input.scripts.build ? `build="${input.scripts.build}"` : null,
      input.scripts.test ? `test="${input.scripts.test}"` : null,
      input.importantPaths.length > 0 ? `paths ${input.importantPaths.slice(0, 4).map((value) => path.basename(value)).join(', ')}` : null,
      input.instructionFile ? `workspace instructions ${path.basename(input.instructionFile)}` : null,
    ].filter(Boolean);

    return parts.join(' | ');
  }

  private async readWorkspaceInstructions(workspace: string): Promise<WorkspaceInstructionProfile> {
    const zavorthCandidates = ['ZAVORTH.md', 'zavorth.md'];
    const agentsCandidates = ['AGENTS.md', 'agents.md'];
    const skillDirCandidates = ['.agents/skills', 'skills'];
    const zavorthFileName = zavorthCandidates.find((entry) => fs.existsSync(path.join(workspace, entry))) || null;
    const agentsFileName = agentsCandidates.find((entry) => fs.existsSync(path.join(workspace, entry))) || null;
    const skillDirectories = skillDirCandidates
      .map((entry) => path.join(workspace, entry))
      .filter((entry) => fs.existsSync(entry) && fs.statSync(entry).isDirectory())
      .map((entry) => entry.replace(/\\/g, '/'));

    const instructionSources: string[] = [];
    const notes: string[] = [];
    const hooks: WorkspaceHook[] = [];
    const commands: WorkspaceCommand[] = [];
    const summaries: string[] = [];
    let primaryFilePath: string | null = null;

    const mergeProfile = (profile: WorkspaceInstructionProfile, prefix: string) => {
      if (!primaryFilePath && profile.filePath) {
        primaryFilePath = profile.filePath;
      }
      for (const source of profile.sources) {
        if (source && !instructionSources.includes(source)) {
          instructionSources.push(source);
        }
      }
      if (profile.summary) {
        summaries.push(profile.summary);
      }
      for (const note of profile.notes) {
        const normalizedNote = prefix ? `[${prefix}] ${note}` : note;
        if (!notes.includes(normalizedNote)) {
          notes.push(normalizedNote);
        }
      }
      for (const hook of profile.hooks) {
        if (!hooks.some((entry) => entry.event === hook.event && entry.command === hook.command)) {
          hooks.push(hook);
        }
      }
      for (const command of profile.commands) {
        if (!commands.some((entry) => entry.name === command.name && entry.template === command.template)) {
          commands.push(command);
        }
      }
    };

    if (zavorthFileName) {
      const filePath = path.join(workspace, zavorthFileName).replace(/\\/g, '/');
      mergeProfile(await this.tryReadInstructionFile(workspace, zavorthFileName, filePath), '');
    }

    if (agentsFileName) {
      const filePath = path.join(workspace, agentsFileName).replace(/\\/g, '/');
      mergeProfile(await this.tryReadInstructionFile(workspace, agentsFileName, filePath), 'AGENTS');
    }

    if (skillDirectories.length > 0) {
      for (const directory of skillDirectories) {
        if (!instructionSources.includes(directory)) {
          instructionSources.push(directory);
        }
      }
      const skillNotes = this.readSkillDirectoryNotes(skillDirectories);
      for (const note of skillNotes) {
        if (!notes.includes(note)) {
          notes.push(note);
        }
      }
      if (skillNotes.length > 0) {
        summaries.push(skillNotes[0]);
      }
    }

    return {
      filePath: primaryFilePath,
      sources: instructionSources,
      summary: this.limitInstructionText(summaries.filter(Boolean).join(' | '), 260),
      notes: notes.slice(0, 8).map((entry) => this.limitInstructionText(entry, 180)),
      skillDirectories,
      hooks: hooks.slice(0, 8),
      commands: commands.slice(0, 8),
    };
  }

  private async tryReadInstructionFile(
    workspace: string,
    fileName: string,
    filePath: string,
  ): Promise<WorkspaceInstructionProfile> {
    try {
      const rawContent = await fs.promises.readFile(path.join(workspace, fileName), 'utf8');
      return this.parseWorkspaceInstructions(filePath, rawContent);
    } catch (error: unknown) {logger.warn('[Workspace Profile] filesystem operation failed', error);
    return {
        filePath,
        sources: [filePath],
        summary: '',
        notes: [],
        skillDirectories: [],
        hooks: [],
        commands: [],
      };
  }
  }

  private parseWorkspaceInstructions(filePath: string, rawContent: string): WorkspaceInstructionProfile {
    const content = String(rawContent || '').replace(/\r/g, '');
    const lines = content.split('\n');

    let heading = '';
    let proseSummary = '';
    const notes: string[] = [];
    const hooks: WorkspaceHook[] = [];
    const commands: WorkspaceCommand[] = [];
    let currentSection = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        continue;
      }

      if (trimmedLine.startsWith('```')) {
        continue;
      }

      if (trimmedLine.startsWith('#')) {
        currentSection = this.normalizeInstructionLine(trimmedLine).toLowerCase();
        if (!heading) {
          heading = this.normalizeInstructionLine(trimmedLine);
        }
        continue;
      }

      if (this.isHooksSection(currentSection)) {
        const hook = this.parseHookLine(trimmedLine);
        if (hook && !hooks.some((entry) => entry.event === hook.event && entry.command === hook.command)) {
          hooks.push(hook);
          continue;
        }
      }

      if (this.isCommandsSection(currentSection)) {
        const command = this.parseCommandLine(trimmedLine);
        if (command && !commands.some((entry) => entry.name === command.name && entry.template === command.template)) {
          commands.push(command);
          continue;
        }
      }

      if (/^(?:[-*+]|\d+\.)\s+/.test(trimmedLine)) {
        const note = this.normalizeInstructionLine(trimmedLine);
        if (note && !notes.includes(note)) {
          notes.push(note);
        }
        continue;
      }

      if (!proseSummary) {
        const normalized = this.normalizeInstructionLine(trimmedLine);
        if (normalized) {
          proseSummary = normalized;
        }
      }

      if (notes.length >= 6 && proseSummary) {
        break;
      }
    }

    const summary = proseSummary || heading || notes.slice(0, 2).join(' | ');
    return {
      filePath,
      sources: [filePath],
      summary: this.limitInstructionText(summary, 260),
      notes: notes.slice(0, 6).map((entry) => this.limitInstructionText(entry, 180)),
      skillDirectories: [],
      hooks: hooks.slice(0, 8),
      commands: commands.slice(0, 8),
    };
  }

  private readSkillDirectoryNotes(skillDirectories: string[]): string[] {
    const notes: string[] = [];
    for (const directory of skillDirectories) {
      try {
        const entries = fs.readdirSync(directory, { withFileTypes: true });
        const skillNames = entries
          .filter((entry) => entry.isDirectory() || (entry.isFile() && entry.name.toLowerCase() === 'skill.md'))
          .map((entry) => entry.isDirectory() ? entry.name : path.basename(directory))
          .filter(Boolean)
          .slice(0, 6);
        if (skillNames.length > 0) {
          notes.push(`Skills em ${path.basename(directory)}: ${skillNames.join(', ')}`);
        } else {
          notes.push(`Skills directory detected at ${directory}`);
        }
      } catch (error: unknown) {notes.push(`Skills directory detected at ${directory}`);
      }
    }
    return notes;
  }

  private isHooksSection(sectionName: string): boolean {
    return /(hook|hooks|gancho|ganchos)/i.test(String(sectionName || '').trim());
  }

  private isCommandsSection(sectionName: string): boolean {
    return /(command|commands|comando|comandos|shortcut|shortcuts)/i.test(String(sectionName || '').trim());
  }

  private parseHookLine(line: string): WorkspaceHook | null {
    const normalized = this.normalizeInstructionLine(line);
    if (!normalized) {
      return null;
    }

    const match = normalized.match(/^([a-z0-9][a-z0-9_\- ]+?)\s*(?::|->)\s*(.+)$/i);
    if (!match) {
      return null;
    }

    const event = String(match[1] || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    const command = String(match[2] || '').trim();
    if (!event || !command) {
      return null;
    }

    return { event, command };
  }

  private parseCommandLine(line: string): WorkspaceCommand | null {
    const normalized = this.normalizeInstructionLine(line);
    if (!normalized) {
      return null;
    }

    const match = normalized.match(/^\/?([a-z0-9][a-z0-9_\-]*)\s*(?::|->)\s*(.+)$/i);
    if (!match) {
      return null;
    }

    const name = String(match[1] || '')
      .trim()
      .toLowerCase();
    const template = String(match[2] || '').trim();
    if (!name || !template) {
      return null;
    }

    return { name, template };
  }

  private normalizeInstructionLine(line: string): string {
    return String(line || '')
      .replace(/^#+\s*/, '')
      .replace(/^(?:[-*+]|\d+\.)\s+/, '')
      .replace(/`+/g, '')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private limitInstructionText(value: string, maxLength: number): string {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  }

  private directoryContainsExtension(workspace: string, ...extensions: string[]): boolean {
    const queue = [workspace];
    let visited = 0;

    while (queue.length > 0 && visited < 250) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      visited += 1;

      let entries: string[] = [];
      try {
        entries = fs.readdirSync(current);
      } catch (error: unknown) {continue;
      }

      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist' || entry === 'build') {
          continue;
        }

        const target = path.join(current, entry);
        try {
          const stat = fs.statSync(target);
          if (stat.isDirectory()) {
            queue.push(target);
            continue;
          }
          if (extensions.includes(path.extname(entry).toLowerCase())) {
            return true;
          }
        } catch (error: unknown) {continue;
        }
      }
    }

    return false;
  }

  private slugify(value: string): string {
    return String(value || 'workspace')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'workspace';
  }
}
