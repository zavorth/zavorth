import path from 'node:path';

import {
  ZAVORTH_CAPABILITY_USAGE_DOCS_CONTRACT_VERSION,
  type ZavorthCapabilityUsageDocsSnapshot,
} from '../contracts/ZavorthCapabilityUsageDocsContract.js';
import { ZavorthCapabilityActionSurfaceService } from './ZavorthCapabilityActionSurfaceService.js';

type Runtime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  docPath?: string;
  actionSurface?: Pick<ZavorthCapabilityActionSurfaceService, 'buildSnapshot'>;
};

export class ZavorthCapabilityUsageDocsService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly docPath: string;
  private readonly actionSurface: Pick<ZavorthCapabilityActionSurfaceService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
    this.docPath = path.resolve(runtime.docPath || path.join(this.projectRoot, 'docs', 'capabilities.md'));
    this.actionSurface = runtime.actionSurface || new ZavorthCapabilityActionSurfaceService({
      projectRoot: this.projectRoot,
      env: runtime.env,
      now: this.now,
    });
  }

  public buildSnapshot(): ZavorthCapabilityUsageDocsSnapshot {
    const surface = this.actionSurface.buildSnapshot();
    return {
      contractVersion: ZAVORTH_CAPABILITY_USAGE_DOCS_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      surface: 'capability-usage-docs',
      status: surface.status,
      docPath: this.docPath,
      summary: {
        exposed: surface.summary.exposed,
        receipts: surface.summary.receipts,
        publicSections: 9,
      },
      items: surface.items,
      publicCommands: {
        list: 'zavorth actions lookup capabilities',
        lookup: 'zavorth actions lookup <what you want to do>',
        preview: 'zavorth actions preview <action-id>',
        approve: 'zavorth approve <approval-id>',
        receipts: 'zavorth actions receipts --action <action-id>',
        usageSignals: 'zavorth actions usage',
        lifecycle: 'zavorth actions lifecycle',
      },
      visibleIn: ['zavorthControl', 'tui', 'setup', 'cli'],
      safety: {
        publicDocsOnly: true,
        noSecrets: true,
        noInternalMilestoneLanguage: true,
        noLiveActivationByReadingDocs: true,
      },
    };
  }

  public renderMarkdown(snapshot = this.buildSnapshot()): string {
    const items = snapshot.items.length
      ? snapshot.items.map((item) => [
        `### ${escapeMarkdown(item.title)}`,
        '',
        `- Action id: \`${escapeMarkdown(item.actionId)}\``,
        `- Status: \`${escapeMarkdown(item.status)}\``,
        `- Preview: \`${escapeMarkdown(item.previewCommand)}\``,
        `- Receipts: \`${escapeMarkdown(item.receiptsCommand)}\``,
        `- Next safe step: ${escapeMarkdown(item.nextSafeAction)}`,
      ].join('\n')).join('\n\n')
      : [
        'No verified capability action is exposed yet.',
        '',
        'When Zavorth verifies a new adapter and exposes it through the Action Harness, it appears in the zavorthControl, the terminal TUI and this generated list.',
      ].join('\n');

    return [
      '# Zavorth Capabilities',
      '',
      'Capabilities are the things Zavorth can use when a request needs more than a plain chat reply: tools, adapters, skills, channels, provider routes or other runtime abilities.',
      '',
      'A capability becoming visible does not mean it can act silently. Anything that can change files, call tools, send data, activate a connector or touch external state still goes through preview, approval and receipts.',
      '',
      '## Where To See Capabilities',
      '',
      '- ZavorthControl: open `Ferramentas` and look for verified capabilities.',
      '- Terminal: run `zavorth tui` and open the Capability actions panel.',
      '- Setup: run `zavorth setup` to see what is available during First Light.',
      '- CLI: use `zavorth actions lookup capabilities` for a compact list.',
      '',
      '## How To Use One',
      '',
      '1. Ask Zavorth naturally for the task you want.',
      '2. If a first-class capability exists, Zavorth routes the request through the Action Harness.',
      '3. Review the preview before anything important happens.',
      '4. Approve only the scoped action you actually want.',
      '5. Read the receipt after the action finishes.',
      '',
      '## Useful Commands',
      '',
      `- List capabilities: \`${snapshot.publicCommands.list}\``,
      `- Find a route: \`${snapshot.publicCommands.lookup}\``,
      `- Preview an action: \`${snapshot.publicCommands.preview}\``,
      `- Approve a request: \`${snapshot.publicCommands.approve}\``,
      `- Read receipts: \`${snapshot.publicCommands.receipts}\``,
      `- Review local usage signals: \`${snapshot.publicCommands.usageSignals}\``,
      `- Review lifecycle decisions: \`${snapshot.publicCommands.lifecycle}\``,
      '',
      '## Current Verified Actions',
      '',
      items,
      '',
      '## Safety Rules',
      '',
      '- A visible capability is not automatic permission.',
      '- Secrets should stay in local environment configuration or SecretRefs, not in chat.',
      '- New or sensitive abilities start with preview.',
      '- Risky work requires explicit approval.',
      '- Every approved action should leave a receipt.',
      '',
      '## Local Usage Signals',
      '',
      'Zavorth can keep local usage signals for capabilities: whether a route was shown, previewed, approved, blocked, abandoned or completed successfully.',
      '',
      'These signals stay on the machine. They do not include prompt text, raw secrets, message content or external analytics. Zavorth uses the aggregate pattern to decide what should be promoted, kept learning, inspected or archived.',
      '',
      '## Lifecycle Decisions',
      '',
      'Zavorth can turn local usage signals into lifecycle decisions: promote a capability, keep it learning, inspect it, or archive it from daily suggestions.',
      '',
      'Promotion and archive decisions are reversible and approval-aware. They do not delete files, activate a live connector, send data or bypass the Action Harness.',
      '',
      '## Troubleshooting',
      '',
      '- If the zavorthControl shows `0 available`, run `zavorth actions lookup capabilities` to confirm the runtime view.',
      '- If a capability is missing, run `zavorth doctor` and check provider, channel or connector setup.',
      '- If a preview is blocked, read the reason before changing policy.',
      '',
      '## Related',
      '',
      '- [Security](/docs/security.md)',
      '- [Effect Boundary](/docs/effect-boundary.md)',
      '- [Provider Mesh](/docs/provider-mesh.md)',
      '- [Channel Mesh](/docs/channel-mesh.md)',
      '- [CLI](/docs/zavorth-cli.md)',
      '',
    ].join('\n');
  }
}

function escapeMarkdown(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}
