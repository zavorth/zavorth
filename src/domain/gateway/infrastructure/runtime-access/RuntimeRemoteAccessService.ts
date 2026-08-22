import { LocalCloudflareRolloutService } from '../../../../services/LocalCloudflareRolloutService.js';
import { OracleCloudflareRolloutService } from '../../../../services/OracleCloudflareRolloutService.js';
import {
  RuntimeOfficialAccessService,
  type RuntimeOfficialAccessReport,
} from './RuntimeOfficialAccessService.js';
import {
  RuntimeOfficialRemoteAccessService,
  type RuntimeOfficialRemoteAccessReport,
} from './RuntimeOfficialRemoteAccessService.js';

export type RuntimeRemoteAccessPathStatus = 'ready' | 'rollout-ready' | 'pending';

export type RuntimeRemoteAccessPath = {
  id: 'official' | 'windows-local-cloudflare' | 'oracle-cloudflare';
  label: string;
  status: RuntimeRemoteAccessPathStatus;
  summary: string;
  command: string;
  steps: Array<{
    id: string;
    title: string;
    status: 'done' | 'pending';
    detail: string;
    command: string;
  }>;
};

export type RuntimeRemoteAccessReport = {
  generatedAt: string;
  summary: string;
  official: RuntimeOfficialAccessReport;
  recommendedPathId: RuntimeRemoteAccessPath['id'];
  recommendedPathReason: string;
  paths: RuntimeRemoteAccessPath[];
  nextSteps: string[];
};

type RuntimeRemoteAccessDeps = {
  officialAccessService?: Pick<RuntimeOfficialAccessService, 'prepare'>;
  localCloudflareRolloutService?: Pick<LocalCloudflareRolloutService, 'inspect'>;
  oracleCloudflareRolloutService?: Pick<OracleCloudflareRolloutService, 'inspect'>;
  officialRemoteAccessService?: Pick<RuntimeOfficialRemoteAccessService, 'inspect'>;
  now?: () => Date;
  platform?: NodeJS.Platform | string;
};

export class RuntimeRemoteAccessService {
  private readonly officialRemoteAccessService: Pick<RuntimeOfficialRemoteAccessService, 'inspect'>;
  private readonly now: () => Date;
  private readonly platform: string;

  constructor(deps: RuntimeRemoteAccessDeps = {}) {
    this.officialRemoteAccessService =
      deps.officialRemoteAccessService
      || new RuntimeOfficialRemoteAccessService({
        officialAccessService: deps.officialAccessService,
        localCloudflareRolloutService: deps.localCloudflareRolloutService,
        oracleCloudflareRolloutService: deps.oracleCloudflareRolloutService,
        now: deps.now,
      });
    this.now = deps.now || (() => new Date());
    this.platform = String(deps.platform || process.platform || 'unknown').toLowerCase();
  }

  public async inspect(): Promise<RuntimeRemoteAccessReport> {
    const officialRemote = await this.officialRemoteAccessService.inspect();
    const official = officialRemote.official;
    const paths = this.buildPaths(officialRemote);
    const recommended = this.selectRecommendedPath(officialRemote, paths);

    return {
      generatedAt: this.now().toISOString(),
      summary: this.buildSummary(officialRemote, recommended.id, paths),
      official,
      recommendedPathId: recommended.id,
      recommendedPathReason: recommended.reason,
      paths,
      nextSteps: this.buildNextSteps(officialRemote, recommended.id, paths),
    };
  }

  private buildPaths(
    officialRemote: RuntimeOfficialRemoteAccessReport,
  ): RuntimeRemoteAccessPath[] {
    const official = officialRemote.official;
    const officialReady = Boolean(official.remote.ready);
    const candidateLookup = new Map(
      officialRemote.rollout.candidates.map((candidate) => [candidate.id, candidate]),
    );
    const localCloudflare = candidateLookup.get('local-cloudflare');
    const oracleCloudflare = candidateLookup.get('oracle-cloudflare');
    return [
      {
        id: 'official',
        label: 'path oficial do app remote',
        status: officialReady ? 'ready' : 'pending',
        summary: officialReady ? `App remote validated em ${official.remote.appUrl || official.manifest.remote.appUrl || official.manifest.remote.baseUrl || 'URL public current'}.`
          : this.buildOfficialPendingSummary(official),
        command: official.manifest.commands.remote,
        steps: [
          {
            id: 'probe-app',
            title: 'Prove the remote web surface',
            status: official.remote.appProbe?.ok ? 'done' : 'pending',
            detail: official.remote.appProbe?.ok ? `GET ${official.remote.appProbe.targetUrl} respondeu ${official.remote.appProbe.statusCode}.`
              : `Validate ${official.remote.appUrl || official.manifest.remote.appUrl || official.manifest.remote.baseUrl || 'the public URL'} with ${official.manifest.commands.remote}.`,
            command: official.manifest.commands.remote,
          },
          {
            id: 'probe-auth',
            title: 'validate auth web remote',
            status: official.remote.authProbe?.ok ? 'done' : 'pending',
            detail: official.remote.authProbe?.ok ? `POST ${official.remote.authProbe.targetUrl} respondeu ${official.remote.authProbe.statusCode}.`
              : 'Confira ZAVORTH_WEB_AUTH_TOKEN e a exposure public before abrir o app remote.',
            command: official.manifest.commands.remote,
          },
        ],
      },
      {
        id: 'windows-local-cloudflare',
        label: 'Windows local + Cloudflare Tunnel',
        status: officialReady ? 'ready' : localCloudflare?.ready ? 'rollout-ready' : 'pending',
        summary: officialReady ? `The local Windows path already closes official remote access at ${official.remote.appUrl || official.manifest.remote.appUrl || official.manifest.remote.baseUrl || 'current public URL'}.`
          : (localCloudflare?.summary || 'Local fallback plan is still pending.'),
        command: 'npm run ops:local-cloudflare',
        steps: this.buildRolloutSteps(localCloudflare),
      },
      {
        id: 'oracle-cloudflare',
        label: 'Oracle + Cloudflare + Gemini/Gemma',
        status: officialReady ? 'ready' : oracleCloudflare?.ready ? 'rollout-ready' : 'pending',
        summary: officialReady ? `The remote runtime already closed the official path at ${official.remote.appUrl || official.manifest.remote.appUrl || official.manifest.remote.baseUrl || 'current public URL'}.`
          : (oracleCloudflare?.summary || 'Rollout Oracle ainda pending.'),
        command: 'npm run ops:oracle-cloudflare',
        steps: this.buildRolloutSteps(oracleCloudflare),
      },
    ];
  }

  private selectRecommendedPath(
    officialRemote: RuntimeOfficialRemoteAccessReport,
    paths: RuntimeRemoteAccessPath[],
  ): { id: RuntimeRemoteAccessPath['id']; reason: string } {
    const official = officialRemote.official;
    if (official.remote.ready) {
      return {
        id: 'official',
        reason: 'O app remote e a auth web already responderam; so mantenha esse path como trilha oficial.',
      };
    }

    if (officialRemote.rollout.activeId === 'local-cloudflare') {
      return {
        id: 'windows-local-cloudflare',
        reason: 'O rollout oficial current usa Cloudflare no host local.',
      };
    }

    if (officialRemote.rollout.activeId === 'oracle-cloudflare') {
      return {
        id: 'oracle-cloudflare',
        reason: 'O rollout oficial current usa Oracle + Cloudflare.',
      };
    }

    const isWindows = this.platform === 'win32';
    if (isWindows) {
      const localCloudflare = officialRemote.rollout.candidates.find((candidate) => candidate.id === 'local-cloudflare');
      if (localCloudflare?.ready) {
        return {
          id: 'windows-local-cloudflare',
          reason: 'This host is Windows and the Cloudflare Tunnel plan is ready to complete official publication.',
        };
      }
      return {
        id: 'windows-local-cloudflare',
        reason: 'This host is Windows; the shortest path for publishing the remote app is completing the local rollout with Cloudflare.',
      };
    }

    const oracleCloudflare = officialRemote.rollout.candidates.find((candidate) => candidate.id === 'oracle-cloudflare');
    if (oracleCloudflare?.ready) {
      return {
        id: 'oracle-cloudflare',
        reason: 'A trilha Oracle + Cloudflare already tem os prerequisitos do rollout remote bem encaminhados.',
      };
    }

    if (paths.find((path) => path.id === 'official')?.status === 'pending') {
      return {
        id: 'official',
        reason: 'The official path still requires remote app and auth proof; close that gap before changing architecture.',
      };
    }

    return {
      id: 'oracle-cloudflare',
      reason: 'The Oracle + Cloudflare path is the most direct route to a persistent remote host outside the local Windows environment.',
    };
  }

  private buildSummary(
    officialRemote: RuntimeOfficialRemoteAccessReport,
    recommendedPathId: RuntimeRemoteAccessPath['id'],
    paths: RuntimeRemoteAccessPath[],
  ): string {
    const official = officialRemote.official;
    if (official.remote.ready) {
      return `access remote oficial ready em ${official.remote.appUrl || official.manifest.remote.appUrl || official.manifest.remote.baseUrl || 'URL public current'}.`;
    }

    const recommended = paths.find((path) => path.id === recommendedPathId);
    return recommended ? `access remote oficial ainda pending. Melhor next path: ${recommended.label}.`
      : 'access remote oficial ainda pending.';
  }

  private buildNextSteps(
    officialRemote: RuntimeOfficialRemoteAccessReport,
    recommendedPathId: RuntimeRemoteAccessPath['id'],
    paths: RuntimeRemoteAccessPath[],
  ): string[] {
    const recommended = paths.find((path) => path.id === recommendedPathId);
    const recommendedCommands = (recommended?.steps || [])
      .filter((step) => step.status === 'pending')
      .slice(0, 3)
      .map((step) => `${step.title}: ${step.command}`);

    return Array.from(
      new Set(
        [
          ...officialRemote.nextSteps,
          ...recommendedCommands,
        ].filter(Boolean),
      ),
    );
  }

  private buildRolloutSteps(
    candidate: RuntimeOfficialRemoteAccessReport['rollout']['candidates'][number] | undefined,
  ): RuntimeRemoteAccessPath['steps'] {
    if (!candidate) {
      return [];
    }

    return [
      {
        id: 'rollout-summary',
        title: 'Estado do rollout',
        status: candidate.ready ? 'done' : 'pending',
        detail: candidate.summary,
        command: candidate.command,
      },
      ...candidate.pendingHighlights.map((highlight, index) => ({
        id: `highlight-${index + 1}`,
        title: `Pendencia ${index + 1}`,
        status: 'pending' as const,
        detail: highlight,
        command: candidate.command,
      })),
    ];
  }

  private buildOfficialPendingSummary(official: RuntimeOfficialAccessReport): string {
    const remoteUrl = official.remote.appUrl || official.manifest.remote.appUrl || official.manifest.remote.baseUrl;
    if (!remoteUrl) {
      return 'Still missing definition and validation for a public HTTPS URL for the remote app.';
    }

    if (!official.remote.appProbe?.ok && !official.remote.authProbe?.ok) {
      return `The public URL ${remoteUrl} has not responded as remote app or web auth yet.`;
    }

    if (!official.remote.appProbe?.ok) {
      return `Web auth responded, but the remote app at ${remoteUrl} has not opened as expected yet.`;
    }

    if (!official.remote.authProbe?.ok) {
      return `The remote app opened at ${remoteUrl}, but web auth has not been successfully validated yet.`;
    }

    return 'O path oficial remote ainda pede closure final.';
  }
}
