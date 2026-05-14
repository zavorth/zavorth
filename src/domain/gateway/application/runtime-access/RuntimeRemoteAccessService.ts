import { LocalCloudflareRolloutService, type LocalCloudflareRolloutSnapshot } from '../../../../services/LocalCloudflareRolloutService.js';
import { OracleCloudflareRolloutService, type OracleCloudflareRolloutSnapshot } from '../../../../services/OracleCloudflareRolloutService.js';
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
        label: 'Caminho oficial do app remoto',
        status: officialReady ? 'ready' : 'pending',
        summary: officialReady
          ? `App remoto validado em ${official.remote.appUrl || official.manifest.remote.appUrl || official.manifest.remote.baseUrl || 'URL publica atual'}.`
          : this.buildOfficialPendingSummary(official),
        command: official.manifest.commands.remote,
        steps: [
          {
            id: 'probe-app',
            title: 'Provar a superficie web remota',
            status: official.remote.appProbe?.ok ? 'done' : 'pending',
            detail: official.remote.appProbe?.ok
              ? `GET ${official.remote.appProbe.targetUrl} respondeu ${official.remote.appProbe.statusCode}.`
              : `Valide ${official.remote.appUrl || official.manifest.remote.appUrl || official.manifest.remote.baseUrl || 'a URL publica'} com ${official.manifest.commands.remote}.`,
            command: official.manifest.commands.remote,
          },
          {
            id: 'probe-auth',
            title: 'Validar auth web remoto',
            status: official.remote.authProbe?.ok ? 'done' : 'pending',
            detail: official.remote.authProbe?.ok
              ? `POST ${official.remote.authProbe.targetUrl} respondeu ${official.remote.authProbe.statusCode}.`
              : 'Confira ZAVORTH_WEB_AUTH_TOKEN e a exposicao publica antes de abrir o app remoto.',
            command: official.manifest.commands.remote,
          },
        ],
      },
      {
        id: 'windows-local-cloudflare',
        label: 'Windows local + Cloudflare Tunnel',
        status: officialReady ? 'ready' : localCloudflare?.ready ? 'rollout-ready' : 'pending',
        summary: officialReady
          ? `O caminho local do Windows ja fecha o acesso remoto oficial em ${official.remote.appUrl || official.manifest.remote.appUrl || official.manifest.remote.baseUrl || 'URL publica atual'}.`
          : (localCloudflare?.summary || 'Plano B local ainda pendente.'),
        command: 'npm run ops:local-cloudflare',
        steps: this.buildRolloutSteps(localCloudflare),
      },
      {
        id: 'oracle-cloudflare',
        label: 'Oracle + Cloudflare + Gemini/Gemma',
        status: officialReady ? 'ready' : oracleCloudflare?.ready ? 'rollout-ready' : 'pending',
        summary: officialReady
          ? `O runtime remoto ja fechou o caminho oficial em ${official.remote.appUrl || official.manifest.remote.appUrl || official.manifest.remote.baseUrl || 'URL publica atual'}.`
          : (oracleCloudflare?.summary || 'Rollout Oracle ainda pendente.'),
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
        reason: 'O app remoto e a auth web ja responderam; so mantenha esse caminho como trilha oficial.',
      };
    }

    if (officialRemote.rollout.activeId === 'local-cloudflare') {
      return {
        id: 'windows-local-cloudflare',
        reason: 'O rollout oficial atual usa Cloudflare no host local.',
      };
    }

    if (officialRemote.rollout.activeId === 'oracle-cloudflare') {
      return {
        id: 'oracle-cloudflare',
        reason: 'O rollout oficial atual usa Oracle + Cloudflare.',
      };
    }

    const isWindows = this.platform === 'win32';
    if (isWindows) {
      const localCloudflare = officialRemote.rollout.candidates.find((candidate) => candidate.id === 'local-cloudflare');
      if (localCloudflare?.ready) {
        return {
          id: 'windows-local-cloudflare',
          reason: 'Este host e Windows e o plano com Cloudflare Tunnel ja esta pronto para fechar a publicacao oficial.',
        };
      }
      return {
        id: 'windows-local-cloudflare',
        reason: 'Este host e Windows; o menor caminho para publicar o app remoto e fechar o rollout local com Cloudflare.',
      };
    }

    const oracleCloudflare = officialRemote.rollout.candidates.find((candidate) => candidate.id === 'oracle-cloudflare');
    if (oracleCloudflare?.ready) {
      return {
        id: 'oracle-cloudflare',
        reason: 'A trilha Oracle + Cloudflare ja tem os prerequisitos do rollout remoto bem encaminhados.',
      };
    }

    if (paths.find((path) => path.id === 'official')?.status === 'pending') {
      return {
        id: 'official',
        reason: 'O caminho oficial ainda pede prova de app e auth remotos; feche isso antes de mudar de arquitetura.',
      };
    }

    return {
      id: 'oracle-cloudflare',
      reason: 'A trilha Oracle + Cloudflare e a rota mais direta para um host remoto persistente fora do Windows local.',
    };
  }

  private buildSummary(
    officialRemote: RuntimeOfficialRemoteAccessReport,
    recommendedPathId: RuntimeRemoteAccessPath['id'],
    paths: RuntimeRemoteAccessPath[],
  ): string {
    const official = officialRemote.official;
    if (official.remote.ready) {
      return `Acesso remoto oficial pronto em ${official.remote.appUrl || official.manifest.remote.appUrl || official.manifest.remote.baseUrl || 'URL publica atual'}.`;
    }

    const recommended = paths.find((path) => path.id === recommendedPathId);
    return recommended
      ? `Acesso remoto oficial ainda pendente. Melhor proximo caminho: ${recommended.label}.`
      : 'Acesso remoto oficial ainda pendente.';
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
      return 'Ainda falta definir e validar uma URL publica HTTPS para o app remoto.';
    }

    if (!official.remote.appProbe?.ok && !official.remote.authProbe?.ok) {
      return `A URL publica ${remoteUrl} ainda nao respondeu como app remoto nem como auth web.`;
    }

    if (!official.remote.appProbe?.ok) {
      return `A auth web respondeu, mas o app remoto em ${remoteUrl} ainda nao abriu do jeito esperado.`;
    }

    if (!official.remote.authProbe?.ok) {
      return `O app remoto abriu em ${remoteUrl}, mas a auth web ainda nao foi validada com sucesso.`;
    }

    return 'O caminho oficial remoto ainda pede fechamento final.';
  }
}

