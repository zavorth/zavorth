import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { EngineeringContextSnapshot } from '../contracts/EngineeringCoreContract.js';
import type { McpRuntimeService } from '../mcp/McpRuntimeService.js';
import { AutoRepairIncidentMemoryService } from './AutoRepairIncidentMemoryService.js';
import { ContextResolverService } from './ContextResolverService.js';
import { EngineeringFileSystemService } from './EngineeringFileSystemService.js';
import { WorkspaceProfileService } from './WorkspaceProfileService.js';
import { logger } from '../logger.js';

type EngineeringContextServiceOptions = {
  workspaceProfileService?: WorkspaceProfileService;
  contextResolverService?: ContextResolverService;
  fileSystemService?: EngineeringFileSystemService;
  autoRepairIncidentMemoryService?: AutoRepairIncidentMemoryService;
  defaultWorkspace?: string | null;
  mcpRuntimeService?: Pick<McpRuntimeService, 'readSnapshot'> | null;
};

export class EngineeringContextService {
  private readonly workspaceProfileService: WorkspaceProfileService;
  private readonly contextResolverService: ContextResolverService;
  private readonly fileSystemService: EngineeringFileSystemService;
  private readonly autoRepairIncidentMemoryService: AutoRepairIncidentMemoryService;
  private readonly defaultWorkspace: string;

  constructor(options: EngineeringContextServiceOptions = {}) {
    this.workspaceProfileService = options.workspaceProfileService || new WorkspaceProfileService();
    this.contextResolverService = options.contextResolverService || new ContextResolverService({
      workspaceProfileService: this.workspaceProfileService,
      connectedToolNamesProvider: () => this.readConnectedMcpToolNames(options.mcpRuntimeService || null),
    });
    this.fileSystemService = options.fileSystemService || new EngineeringFileSystemService();
    this.autoRepairIncidentMemoryService =
      options.autoRepairIncidentMemoryService || new AutoRepairIncidentMemoryService();
    this.defaultWorkspace = path.resolve(options.defaultWorkspace || config.defaultWorkspace || process.cwd());
  }

  public async buildContext(workspaceHint?: string | null): Promise<EngineeringContextSnapshot> {
    const workspace = path.resolve(String(workspaceHint || '').trim() || this.defaultWorkspace);
    const profile = await this.workspaceProfileService.getProfile(workspace);
    const resolvedContext = await this.contextResolverService.resolve({ workspace });
    const packageJsonPath = path.join(workspace, 'package.json');
    const tsconfigPath = path.join(workspace, 'tsconfig.json');
    const packageJson = this.readJson(packageJsonPath);

    return {
      workspace: workspace.replace(/\\/g, '/'),
      workspaceName: path.basename(workspace),
      packageJsonExists: Boolean(packageJson),
      packageManager: profile?.package_manager || this.detectPackageManager(workspace),
      scripts: profile?.scripts || (packageJson?.scripts || {}),
      lockfiles: this.detectLockfiles(workspace),
      tsconfigExists: fs.existsSync(tsconfigPath),
      detectedStacks: profile?.detected_stacks || [],
      frameworks: profile?.frameworks || [],
      languages: profile?.languages || [],
      importantPaths: profile?.important_paths || [],
      shallowTree: this.fileSystemService.listTree(workspace, 1, 40),
      instructionFile: resolvedContext.instructionFile,
      instructionSources: resolvedContext.instructionSources,
      instructionSummary: resolvedContext.instructionSummary,
      instructionNotes: resolvedContext.instructionNotes,
      skillDirectories: resolvedContext.skillDirectories,
      contextLayers: resolvedContext.layers,
      workspaceCommands: resolvedContext.workspaceCommands,
      workspaceHooks: resolvedContext.workspaceHooks,
      autorepairSummary: this.autoRepairIncidentMemoryService.summarizeForPlanner(),
    };
  }

  private readJson(filePath: string): Record<string, any> | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error: unknown) {logger.warn('[Engineering Context] JSON parse failed', error); return null; }
  }

  private readConnectedMcpToolNames(mcpRuntimeService: Pick<McpRuntimeService, 'readSnapshot'> | null): string[] {
    const snapshot = mcpRuntimeService?.readSnapshot?.();
    if (!snapshot?.entries) {
      return [];
    }

    return snapshot.entries
      .filter((entry) => entry.status === 'connected')
      .flatMap((entry) => entry.toolNames || []);
  }

  private detectLockfiles(workspace: string): string[] {
    return ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lock', 'bun.lockb']
      .filter((entry) => fs.existsSync(path.join(workspace, entry)));
  }

  private detectPackageManager(workspace: string): string | null {
    const lockfiles = this.detectLockfiles(workspace);
    if (lockfiles.includes('pnpm-lock.yaml')) {
      return 'pnpm';
    }
    if (lockfiles.includes('yarn.lock')) {
      return 'yarn';
    }
    if (lockfiles.includes('bun.lock') || lockfiles.includes('bun.lockb')) {
      return 'bun';
    }
    if (lockfiles.includes('package-lock.json')) {
      return 'npm';
    }
    return null;
  }
}
