import {
  ZAVORTH_CONTROL_SETUP_CHECKLIST_VERSION,
  type ZavorthControlSetupChecklistItem,
  type ZavorthControlSetupChecklistItemStatus,
  type ZavorthControlSetupChecklistSnapshot,
} from '../contracts/ZavorthControlSetupChecklistContract.js';
import { ChannelConnectionPlaybookService } from './ChannelConnectionPlaybookService.js';

import { ExecutionBackendPlaybookService } from './ExecutionBackendPlaybookService.js';
import { ProviderConnectionPlaybookService } from './ProviderConnectionPlaybookService.js';

type ZavorthControlSetupChecklistDeps = {
  now?: () => Date;
  channelPlaybook?: Pick<ChannelConnectionPlaybookService, 'buildSnapshot'>;
  providerPlaybook?: Pick<ProviderConnectionPlaybookService, 'buildSnapshot'>;
  backendPlaybook?: Pick<ExecutionBackendPlaybookService, 'buildSnapshot'>;
};

export class ZavorthControlSetupChecklistService {
  private readonly now: () => Date;
  private readonly channelPlaybook: Pick<ChannelConnectionPlaybookService, 'buildSnapshot'>;
  private readonly providerPlaybook: Pick<ProviderConnectionPlaybookService, 'buildSnapshot'>;
  private readonly backendPlaybook: Pick<ExecutionBackendPlaybookService, 'buildSnapshot'>;

  constructor(deps: ZavorthControlSetupChecklistDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.channelPlaybook = deps.channelPlaybook || new ChannelConnectionPlaybookService();
    this.providerPlaybook = deps.providerPlaybook || new ProviderConnectionPlaybookService();
    this.backendPlaybook = deps.backendPlaybook || new ExecutionBackendPlaybookService();
  }

  public buildSnapshot(): ZavorthControlSetupChecklistSnapshot {
    const channels = this.channelPlaybook.buildSnapshot();
    const providers = this.providerPlaybook.buildSnapshot();
    const backends = this.backendPlaybook.buildSnapshot();
    const items: ZavorthControlSetupChecklistItem[] = [
      {
        id: 'connect-channel',
        label: 'Connect a channel (optional)',
        area: 'channel',
        status: statusFromReady(channels.summary.defaultRouteAllowed > 0, channels.summary.readyToValidate > 0),
        summary: channels.summary.defaultRouteAllowed > 0
          ? 'At least one channel is live-ready for default routing.'
          : 'Optional: connect any channel you choose and prove live readiness before real send.',
        nextAction: channels.selected?.nextAction || 'Open channel playbook for the channel you want.',
        command: 'npm run zavorth:channel-connection-playbook',
        href: '/control/providers...setup=channel',
        proof: `${channels.summary.defaultRouteAllowed} default route(s), ${channels.summary.liveReady} live-ready.`,
      },
      {
        id: 'connect-provider',
        label: 'Testar provider',
        area: 'provider',
        status: statusFromReady(providers.summary.defaultRouteAllowed > 0, providers.summary.readyToProbe > 0),
        summary: providers.summary.defaultRouteAllowed > 0
          ? 'Ha provider com rota default e prova live.'
          : 'Configure chave/base URL e run probe before tornar default.',
        nextAction: providers.selected?.nextAction || 'Abrir playbook de provider.',
        command: 'npm run zavorth:provider-connection-playbook -- --provider openai',
        href: '/control/providers...setup=provider',
        proof: `${providers.summary.defaultRouteAllowed} default route(s), ${providers.summary.liveReady} live-ready.`,
      },
      {
        id: 'configure-executor',
        label: 'Configure safe executor',
        area: 'execution-backend',
        status: statusFromReady(backends.summary.strongSandboxReady > 0, backends.summary.previewReady > 0),
        summary: backends.summary.strongSandboxReady > 0
          ? 'There is a strong backend ready for smoke and approved execution.'
          : 'Use preview/local-jail while Docker, WSL, or cloud sandbox are not proven.',
        nextAction: backends.selected?.nextAction || 'Abrir playbook de backend.',
        command: 'npm run zavorth:execution-backend-playbook -- --backend docker',
        href: '/control/providers...setup=execution',
        proof: `${backends.summary.strongSandboxReady} strong sandbox ready, ${backends.summary.liveReady} live-ready.`,
      },
      {
        id: 'review-memory',
        label: 'Review learned memory',
        area: 'memory',
        status: 'next',
        summary: 'Memory must appear as editable items with origin, evidence, trust, expiration, and forget controls.',
        nextAction: 'Open memory panel and review what was learned before promoting rules.',
        command: 'npm run zavorth:memory-learning-loop:check --silent',
        href: '/control/memory...setup=memory',
        proof: 'Memory learning loop, Mnemos UX and forget/edit surfaces stay reviewable.',
      },
      {
        id: 'install-skills-governed',
        label: 'Instalar skills e MCP com preview',
        area: 'skill',
        status: 'next',
        summary: 'Every skill or MCP tool must pass intake, scanner, preview, smoke, and approval when there is risk.',
        nextAction: 'Import a safe tool in preview mode and verify non-destructive smoke.',
        command: 'npm run zavorth:universal-skill-intake:check --silent',
        href: '/control/skills...setup=intake',
        proof: 'Universal intake blocks hostile scripts and keeps imported support files instruction-only until wrapped.',
      },
      {
        id: 'schedule-with-preview',
        label: 'Agendar rotina com preview',
        area: 'scheduler',
        status: 'next',
        summary: 'Scheduled tasks must show final prompt, scope, loaded skill/procedure, channel, and receipt.',
        nextAction: 'Create a rehearsal task and confirm that scope drift and expired approval are blocked.',
        command: 'node scripts/zavorth-governed-scheduled-tasks-check.mjs',
        href: '/control/cron...setup=scheduler',
        proof: 'Scheduler guard scans final prompt and blocks compound scheduling, expired approvals and kill-switch bypass.',
      },
      {
        id: 'run-profile-mission',
        label: 'Run mission by profile',
        area: 'mission',
        status: 'next',
        summary: 'Every profile must prove request, decision, tool or subagent, approval if risky, delivery, receipt, and review.',
        nextAction: 'Run Personal, Creator, Developer, Business, and Power flows as guided missions.',
        command: 'npm run zavorth:daily-product:check --silent',
        href: '/control...setup=missions',
        proof: 'Daily product and experience profile checks keep profile-specific missions visible.',
      },
      {
        id: 'run-quality-evals',
        label: 'run avaliactions continuas',
        area: 'quality',
        status: 'next',
        summary: 'Evals must cover leaks, approval fatigue, incorrect learning, UX regression, and tool failure.',
        nextAction: 'Run product QA and security checks before promoting behavior changes.',
        command: 'npm run security:secrets --silent && npm run zavorth-control-vite:check --silent',
        href: '/control/docs...setup=quality',
        proof: 'No raw secrets in outputs; zavorthControl build and design-system checks remain passing.',
      },
    ];
    const summary = {
      total: items.length,
      done: items.filter((entry) => entry.status === 'done').length,
      next: items.filter((entry) => entry.status === 'next').length,
      needsSetup: items.filter((entry) => entry.status === 'needs-setup').length,
      blocked: items.filter((entry) => entry.status === 'blocked').length,
    };
    return {
      generatedAt: this.now().toISOString(),
      version: ZAVORTH_CONTROL_SETUP_CHECKLIST_VERSION,
      status: summary.done === items.length ? 'ready'
        : summary.next > 0
          ? 'attention'
          : 'needs-setup',
      headline: 'Configure channels, providers e executor com passos claros e prova honesta.',
      items,
      summary,
      safety: {
        projectionOnly: true,
        rawSecretsSerialized: false,
        liveActionsRemainApprovalBound: true,
      },
    };
  }

  public renderText(snapshot = this.buildSnapshot()): string {
    return [
      'Checklist de setup do ZavorthControl',
      '',
      snapshot.headline,
      '',
      ...snapshot.items.map((item) =>
        `- [${item.status}] ${item.label}: ${item.summary} | ${item.command}`),
    ].join('\n');
  }
}

function statusFromReady(done: boolean, next: boolean): ZavorthControlSetupChecklistItemStatus {
  if (done) return 'done';
  if (next) return 'next';
  return 'needs-setup';
}
