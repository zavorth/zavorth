import {
  ZAVORTH_MNEMOS_MEMORY_UX_VERSION,
  type ZavorthMnemosMemoryUxCommand,
  type ZavorthMnemosMemoryUxPanel,
  type ZavorthMnemosMemoryUxSnapshot,
  type ZavorthMnemosMemoryUxSurface,
} from '../contracts/ZavorthMnemosMemoryUxContract.js';
import { ZavorthMnemosLintService } from './ZavorthMnemosLintService.js';

import { ZavorthMnemosProceduralMemoryService } from './ZavorthMnemosProceduralMemoryService.js';

type MemoryUxRuntime = {
  now?: () => Date;
  projectRoot?: string;
  lintService?: Pick<ZavorthMnemosLintService, 'lint'>;
  proceduralMemoryService?: Pick<ZavorthMnemosProceduralMemoryService, 'list'>;
};

function stableId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export class ZavorthMnemosMemoryUxService {
  private readonly now: () => Date;
  private readonly lintService: Pick<ZavorthMnemosLintService, 'lint'>;
  private readonly proceduralMemoryService: Pick<ZavorthMnemosProceduralMemoryService, 'list'>;

  constructor(runtime: MemoryUxRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.lintService = runtime.lintService || new ZavorthMnemosLintService({ projectRoot: runtime.projectRoot });
    this.proceduralMemoryService = runtime.proceduralMemoryService || new ZavorthMnemosProceduralMemoryService({ projectRoot: runtime.projectRoot });
  }

  public buildSnapshot(): ZavorthMnemosMemoryUxSnapshot {
    const generatedAt = this.now().toISOString();
    const lint = this.lintService.lint();
    const procedural = this.proceduralMemoryService.list();
    const status = lint.status === 'blocked'
      ? 'blocked'
      : lint.status === 'needs-review'
        ? 'attention'
        : 'ready';
    const activeProceduralRules = procedural.rules.filter((rule) => rule.status === 'active').length;
    const panels = this.buildPanels(status, lint.summary.findings, procedural.summary.total, activeProceduralRules);

    return {
      version: ZAVORTH_MNEMOS_MEMORY_UX_VERSION,
      generatedAt,
      status,
      headline: status === 'ready'
        ? 'Mnemos memory controls are ready.'
        : status === 'blocked'
          ? 'Mnemos memory needs operator action before trusted use.'
          : 'Mnemos memory has review items.',
      panels,
      summary: {
        lintStatus: lint.status,
        lintFindings: lint.summary.findings,
        proceduralRules: procedural.summary.total,
        activeProceduralRules,
        surfaces: ['zavorthControl', 'cli', 'telegram'],
      },
      safety: {
        providerCall: false,
        networkCall: false,
        durableMutation: false,
        zavorthControlCanWriteMemory: false,
        cliWriteRequiresApproval: true,
        telegramWriteRequiresApproval: true,
        rawJsonHiddenByDefault: true,
      },
      receipt: {
        id: `mnemos-memory-ux-${stableId(`${generatedAt}:${status}:${lint.summary.findings}:${procedural.summary.total}`)}`,
        providerCall: false,
        durableMutation: false,
      },
    };
  }

  public formatCli(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Mnemos Memory UX',
      `status: ${snapshot.status}`,
      `lint: ${snapshot.summary.lintStatus} (${snapshot.summary.lintFindings} finding(s))`,
      `procedural: ${snapshot.summary.activeProceduralRules}/${snapshot.summary.proceduralRules} active rule(s)`,
      '',
      'Commands:',
    ];
    for (const panel of snapshot.panels) {
      lines.push(`- ${panel.title}: ${panel.primaryCommand}`);
      const cliCommand = panel.commands.find((command) => command.surface === 'cli');
      if (cliCommand) {
        lines.push(`  ${cliCommand.command}`);
      }
    }
    return lines.join('\n');
  }

  public formatTelegram(snapshot = this.buildSnapshot()): string {
    const commands = snapshot.panels.flatMap((panel) => panel.commands)
      .filter((command) => command.surface === 'telegram')
      .map((command) => `- ${command.command} — ${command.summary}`);
    return [
      `Mnemos: ${snapshot.status}`,
      `Lint: ${snapshot.summary.lintStatus} (${snapshot.summary.lintFindings})`,
      `Procedural: ${snapshot.summary.activeProceduralRules}/${snapshot.summary.proceduralRules} ativa(s)`,
      '',
      ...commands,
    ].join('\n');
  }

  private buildPanels(
    status: ZavorthMnemosMemoryUxSnapshot['status'],
    lintFindings: number,
    proceduralRules: number,
    activeProceduralRules: number,
  ): ZavorthMnemosMemoryUxPanel[] {
    return [
      {
        id: 'memory-health',
        title: 'Memory Health',
        status,
        summary: lintFindings > 0 ? `${lintFindings} wiki finding(s) need review.` : 'Semantic wiki is clean.',
        primaryCommand: 'npm run mnemos:lint',
        commands: [
          command('cli', 'Check memory health', 'zavorth memory mnemos', 'Show lint, procedural and query controls.', false),
          command('telegram', 'Check memory health', '/mnemos', 'Show memory status and safe commands.', false),
          command('zavorthControl', 'Open memory panel', '/zavorthControl', 'Read-only memory controls on Home.', false),
        ],
      },
      {
        id: 'procedural-rules',
        title: 'Procedural Rules',
        status: proceduralRules > 0 ? 'ready' : 'attention',
        summary: `${activeProceduralRules} active rule(s), ${proceduralRules} total.`,
        primaryCommand: 'npm run mnemos:procedural -- list',
        commands: [
          command('cli', 'List procedural rules', 'zavorth memory procedural list', 'List active, draft and revoked rules.', false),
          command('cli', 'Preview procedural rule', 'zavorth memory procedural preview --text "<rule>"', 'Create a draft without writing memory.', false),
          command('cli', 'Apply procedural rule', 'zavorth memory procedural apply --approval-id <id> --text "<rule>"', 'Persist only after approval.', true),
          command('telegram', 'List procedural rules', '/mnemos procedural', 'Show procedural memory summary.', false),
        ],
      },
      {
        id: 'wiki-query',
        title: 'Wiki Query',
        status: 'ready',
        summary: 'Ask synthesized memory without exposing raw chunks by default.',
        primaryCommand: 'npm run mnemos:query -- "<query>"',
        commands: [
          command('cli', 'Query wiki memory', 'zavorth memory mnemos query "<query>"', 'Use top-k trusted wrapper context.', false),
          command('telegram', 'Query wiki memory', '/mnemos query <text>', 'Show a compact recall path.', false),
        ],
      },
      {
        id: 'revocation',
        title: 'Revocation',
        status: 'ready',
        summary: 'Procedural rules can be turned off with approval and receipt.',
        primaryCommand: 'npm run mnemos:procedural -- revoke --id <rule-id> --approval-id <id>',
        commands: [
          command('cli', 'Revoke procedural rule', 'zavorth memory procedural revoke --id <rule-id> --approval-id <id>', 'Disable a rule with proof.', true),
          command('telegram', 'Revoke procedural rule', '/mnemos revoke <rule-id>', 'Start a governed revocation.', true),
        ],
      },
    ];
  }
}

function command(
  surface: ZavorthMnemosMemoryUxSurface,
  label: string,
  commandText: string,
  summary: string,
  requiresApproval: boolean,
): ZavorthMnemosMemoryUxCommand {
  return { surface, label, command: commandText, summary, requiresApproval };
}
