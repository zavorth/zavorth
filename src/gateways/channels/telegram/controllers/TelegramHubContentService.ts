import * as path from 'path';
import { config } from '../../../../config/index.js';
import { ZavorthBridgePreferenceStore } from '../../../../agents/ZavorthBridgePreferenceStore.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { SkillLibraryPresentationService } from '../../../../services/SkillLibraryPresentationService.js';
import { HubRecipeKind, HubSection } from '../../../../gateways/channels/telegram/controllers/TelegramHubTypes.js';

export type TelegramHubContentServiceDeps = {
  zavorthBridgePreferenceStore: Pick<ZavorthBridgePreferenceStore, 'getPreferredModel'>;
  permissionService: Pick<PermissionService, 'listRequests'>;
  isDemoModeEnabled: () => boolean;
  isOperatorModeEnabled: () => boolean;
  isPresentationModeEnabled: () => boolean;
  skillLibraryPresentationService?: Pick<SkillLibraryPresentationService, 'buildSnapshot'>;
};

export class TelegramHubContentService {
  private readonly skillLibraryPresentationService: Pick<SkillLibraryPresentationService, 'buildSnapshot'>;

  constructor(private readonly deps: TelegramHubContentServiceDeps) {
    this.skillLibraryPresentationService =
      deps.skillLibraryPresentationService || new SkillLibraryPresentationService();
  }

  public async buildHubPageText(section: HubSection): Promise<string> {
    const preferredZavorthBridgeModel = await this.deps.zavorthBridgePreferenceStore.getPreferredModel();
    const pendingPermissions = await this.deps.permissionService.listRequests('pending', 5);
    const workspaceLabel = path.basename(config.defaultWorkspace) || config.defaultWorkspace;

    switch (section) {
      case 'onboarding1':
        return [
          '*Getting To Know Zavorth (1/3)*',
          '',
          'Zavorth is your assistant for research, code, files, automation, and environment operations.',
          'It chooses the best route for each request and tries to keep the experience simple for the person using it.',
        ].join('\n');
      case 'onboarding2':
        return [
          '*How Security Works (2/3)*',
          '',
          'When a request crosses risk, permission, or extra access boundaries, Zavorth pauses and shows exactly what needs to be allowed.',
          'That helps keep the system powerful internally and predictable externally.',
        ].join('\n');
      case 'onboarding3':
        return [
          '*How To Start Well (3/3)*',
          '',
          'Start by writing the request in natural language. Zavorth chooses the route, tool, and next step.',
          'Use `Quick guide` and `Recipes` only when you want examples or manual navigation.',
          'For a more polished demo experience, turn on `/presentation on` or `/demo on`.',
        ].join('\n');
      case 'quickstart':
        return [
          '*Quick Guide*',
          '',
          '1. Speak naturally when you want speed.',
          '2. Use commands only when you want operator control, such as `/codex`, `/external`, `/ag`, `/research`, or `/stitch`.',
          '3. Track diagnostics and permissions in `/status` and `/perm list`.',
        ].join('\n');
      case 'integrations':
        return [
          '*Engines And Integrations*',
          '',
          'Zavorth works through different routes depending on the request.',
          '',
          '- **Codex** for local code and host automation.',
          '- **ExternalExecutor** for execution and review in WSL.',
          '- **ZavorthBridge** for interface-guided flows.',
          '- **AI Studio**, **Gemini**, **Jules**, and **Stitch** for research, analysis, and generation.',
        ].join('\n');
      case 'skills': {
        const snapshot = this.skillLibraryPresentationService.buildSnapshot();
        const topBundle = snapshot.bundles[0] || null;
        const topVendor = snapshot.vendors[0] || null;
        const trustSummary = snapshot.trust
          .map((entry) => `${entry.trust} ${entry.count}`)
          .join(' | ');
        return [
          '*Skill Library*',
          '',
          snapshot.narrative.operatorSummary,
          `Ready recipes: ${snapshot.catalog.summary.readyRecipes}/${snapshot.catalog.summary.recipes}.`,
          `Current trust: ${trustSummary || 'no data'}.`,
          topBundle
            ? `Strongest bundle now: *${topBundle.tag}* with ${topBundle.skillCount} skill(s).`
            : 'No featured bundle right now.',
          topVendor
            ? `Observed vendor: *${topVendor.displayName}* -> ${topVendor.summary}`
            : 'No support vendor registered right now.',
          '',
          'Useful shortcuts:',
          '- `/skills library` to open the full library',
          '- `/skills bridge` to see skills ready for governed bridge use',
          '- `/skills run <skill>` to prepare a safe dry-run',
          '- `/skills plan recipe spec-driven-delivery` for a base plan',
          '- `/skills mcp` to see sidecar tools and resources',
        ].join('\n');
      }
      case 'recipes':
        return [
          '*Ready Recipes*',
          '',
          'Use these examples to show Zavorth clearly:',
          '',
          '- `/research search today main AI news`',
          '- `/files send me the index.html from folder ...`',
          '- `/workflow ship implement the screen and review the result`',
          '- `/stitch create a modern landing page for a task app`',
          '',
          'Use `/demo` if you want a guided script.',
        ].join('\n');
      case 'security':
        return [
          '*Security And Control*',
          '',
          'Zavorth does not execute sensitive actions blindly.',
          'Risky requests, extra folder access, and certain guided flows go through policy and approval before continuing.',
          '',
          'To harden behavior, use `/lock`, `/operator on`, or work in presentation/demo mode.',
        ].join('\n');
      case 'permissions':
        return [
          '*Permissions And Approvals*',
          '',
          `Pending now: *${pendingPermissions.length}*.`,
          '',
          'When an approval appears, the idea is simple: show what will happen before continuing.',
          'Open the pending queue to approve, reject, or review the context for each request.',
        ].join('\n');
      case 'settings':
        return [
          '*Zavorth Settings*',
          '',
          `Main workspace: \`${workspaceLabel}\``,
          `Current provider: \`${config.llmProvider}\``,
          `Preferred ZavorthBridge model: \`${preferredZavorthBridgeModel || 'not set yet'}\``,
          `Pending permissions: \`${pendingPermissions.length}\``,
          '',
          'Current modes:',
          `- Presentation: ${this.deps.isPresentationModeEnabled() ? 'active' : 'inactive'}`,
          `- Demo: ${this.deps.isDemoModeEnabled() ? 'active' : 'inactive'}`,
          `- Operator: ${this.deps.isOperatorModeEnabled() ? 'active' : 'inactive'}`,
          '',
          'Useful shortcuts:',
          '- `/models` to see active models',
          '- `/presentation on|off` to adjust tone',
          '- `/operator on|off` to require confirmation before acting',
          '- `/demo on|off` to prepare a demo',
          '- `/zavorthControl` to open the web dashboard',
        ].join('\n');
      case 'actions':
        return [
          '*Quick Actions*',
          '',
          'These shortcuts are manual support for diagnostics, permissions, and operations. For common tasks, write the request in natural language.',
        ].join('\n');
      case 'overview':
      default:
        return [
          '*Zavorth*',
          '',
          'Your assistant for research, files, code, automation, and environment operations.',
          '',
          `Current provider: \`${config.llmProvider}\``,
          `Main workspace: \`${workspaceLabel}\``,
          `Open pending items: \`${pendingPermissions.length}\``,
          '',
          'This hub is manual support for diagnostics, settings, permissions, and demo. The primary entry remains natural language.',
        ].join('\n');
    }
  }

  public formatRecipeMessage(kind: HubRecipeKind): string {
    switch (kind) {
      case 'codex':
        return [
          '*Recipe: Codex*',
          '',
          'Use Codex when you want to change local code or automate a host change.',
          '`/codex create a Next.js dashboard for an internal app`',
          '`/dryrun npm run build` to simulate before acting',
        ].join('\n');
      case 'external_executor':
        return [
          '*Recipe: ExternalExecutor*',
          '',
          'Use ExternalExecutor for review, exploration, and isolated execution in WSL.',
          '`/external review this module and return the main risks`',
        ].join('\n');
      case 'zavorthBridge':
        return [
          '*Recipe: ZavorthBridge*',
          '',
          'Use ZavorthBridge when the task depends on the interface or a guided visual flow.',
          '`/ag read this screen and tell me what is happening`',
        ].join('\n');
      case 'permissions':
      default:
        return [
          '*Recipe: Permissions*',
          '',
          'When I need to cross a safety boundary, I pause and ask for confirmation.',
          '`/perm list pending`',
        ].join('\n');
    }
  }
}
