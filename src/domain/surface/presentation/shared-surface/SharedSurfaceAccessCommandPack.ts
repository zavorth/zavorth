import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { RuntimeAccessManifestService } from '../../../../runtime/access/RuntimeAccessManifestService.js';
import type { RuntimeBootstrapService } from '../../../../runtime/access/RuntimeBootstrapService.js';
import type { RuntimeInstallJourneyService } from '../../../../runtime/access/RuntimeInstallJourneyService.js';
import type { RuntimeOfficialRemoteAccessService } from '../../../../runtime/access/RuntimeOfficialRemoteAccessService.js';
import type { SharedSurfaceConsistencyService } from '../../../../services/SharedSurfaceConsistencyService.js';

type SharedSurfaceAccessCommandPackDeps = {
  runtimeAccessManifestService: Pick<RuntimeAccessManifestService, 'buildManifest'>;
  runtimeBootstrapService: Pick<RuntimeBootstrapService, 'inspectLive'>;
  runtimeInstallJourneyService: Pick<RuntimeInstallJourneyService, 'run'>;
  runtimeOfficialRemoteAccessService: Pick<RuntimeOfficialRemoteAccessService, 'inspect'>;
  sharedSurfaceConsistencyService: Pick<SharedSurfaceConsistencyService, 'buildManifest'>;
};

export class SharedSurfaceAccessCommandPack {
  constructor(private readonly deps: SharedSurfaceAccessCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    switch (commandType) {
      case '/access':
        await this.handleAccess(ctx, args);
        return true;
      case '/bootstrap':
        await this.handleBootstrap(ctx);
        return true;
      default:
        return false;
    }
  }

  private async handleAccess(ctx: IMessageContext, args: string): Promise<void> {
    const manifest = await this.deps.runtimeAccessManifestService.buildManifest();
    const officialRemote = await this.deps.runtimeOfficialRemoteAccessService.inspect({
      dryRun: true,
      requireMutableAccess: false,
    });
    const consistency = this.deps.sharedSurfaceConsistencyService.buildManifest();
    const mode = String(args || '')
      .trim()
      .toLowerCase();

    if (mode === 'local') {
      await ctx.reply(
        [
          'Zavorth local access',
          '',
          `Status: ${manifest.local.ready ? 'ready' : 'pending'}.`,
          `App: ${manifest.local.appUrl}`,
          `Legacy ZavorthControl: ${manifest.local.zavorthControlUrl}`,
          `Web API: ${manifest.local.apiBaseUrl}`,
          '',
          ...manifest.guides.local.slice(0, 4).map((line) => `- ${line}`),
        ].join('\n'),
      );
      return;
    }

    if (mode === 'remote' || mode === 'remote') {
      await ctx.reply(
        [
          'Zavorth official remote access',
          '',
          `Status: ${officialRemote.remote.ready ? 'ready' : 'pending'}.`,
          `Public URL: ${officialRemote.remote.baseUrl || manifest.remote.baseUrl || 'not configured'}`,
          `Remote app: ${officialRemote.remote.appUrl || manifest.remote.appUrl || 'not configured'}`,
          `HTTPS required: ${manifest.remote.requiresHttps ? 'yes' : 'ok'}`,
          `Recommended path: ${officialRemote.recommendedPathId || 'official'} ? ${officialRemote.recommendedPathReason}`,
          '',
          ...officialRemote.nextSteps.slice(0, 4).map((line) => `- ${line}`),
          '',
          `Useful commands: ${manifest.commands.access} | ${manifest.commands.remote} | ${manifest.commands.trust}`,
        ].join('\n'),
      );
      return;
    }

    await ctx.reply(
      [
        'Zavorth access manifest',
        '',
        manifest.summary,
        '',
        `local: ${manifest.local.appUrl} (${manifest.local.ready ? 'ready' : 'pending'})`,
        `Remote: ${manifest.remote.appUrl || 'not configured'} (${manifest.remote.ready ? 'ready' : 'pending'})`,
        `Web auth: ${manifest.auth.required ? manifest.auth.source : 'missing'} | authorized host: ${manifest.auth.authorizedHost === false ? 'no' : 'yes'}`,
        `Official remote path: ${officialRemote.recommendedPathId || 'official'} | ${officialRemote.remote.ready ? 'validated' : 'pending'}`,
        '',
        'Recommended surfaces:',
        ...manifest.surfaces
          .slice(0, 4)
          .map(
            (surface) =>
              `- ${surface.label}: ${surface.entry}${surface.remoteEntry ? ` | remote: ${surface.remoteEntry}` : ''} | ${surface.ready ? 'ready' : 'pending'}`,
          ),
        '',
        `Web/Telegram parity: ${consistency.summary}`,
        ...consistency.recommended.slice(0, 3).map((entry) => `- ${entry.surfaceCommand}: ${entry.description}`),
        '',
        `Useful commands: ${manifest.commands.start} | ${manifest.commands.bootstrap} | ${manifest.commands.manifest}`,
        ...manifest.nextSteps.slice(0, 4).map((step) => `- ${step.title}: ${step.description}`),
      ].join('\n'),
    );
  }

  private async handleBootstrap(ctx: IMessageContext): Promise<void> {
    const report = await this.deps.runtimeBootstrapService.inspectLive();
    const journey = await this.deps.runtimeInstallJourneyService.run({
      dryRun: true,
      requireMutableAccess: false,
    });
    const officialRemote = await this.deps.runtimeOfficialRemoteAccessService.inspect({
      dryRun: true,
      requireMutableAccess: false,
    });
    const consistency = this.deps.sharedSurfaceConsistencyService.buildManifest();
    const nextActions = report.actions.slice(0, 5);
    const journeyPhases = journey.phases.filter((phase) => phase.status !== 'ready').slice(0, 3);

    await ctx.reply(
      [
        'Zavorth operational bootstrap',
        '',
        report.summary,
        '',
        `.env: ${report.env.envFilePresent ? 'ok' : 'missing'} | provider=${report.env.llmProvider} | credential=${report.env.llmCredentialReady ? 'ok' : 'pending'}`,
        `Dependencies: ${report.dependencies.installRequired ? 'npm install pending' : 'ok'} | build=${report.dependencies.buildRequired ? 'pending' : 'ok'}`,
        `local: ${report.supervisedRuntime.accessReadiness.local.ready ? 'ready' : 'pending'} | remote: ${report.supervisedRuntime.accessReadiness.remote.ready ? 'ready' : 'pending'}`,
        `Official remote access: ${officialRemote.remote.ready ? 'validated' : 'pending'} | ${officialRemote.recommendedPathReason}`,
        `Surface parity: ${consistency.summary}`,
        '',
        ...(nextActions.length > 0
          ? ['Recommended steps:', ...nextActions.map((action) => `- ${action.title}: ${action.command}`)]
          : ['No pending steps. Bootstrap is complete.']),
        ...(journeyPhases.length > 0
          ? [
              '',
              'Official steps still pending:',
              ...journeyPhases.map((phase) => `- ${phase.title}: ${phase.command || phase.summary}`),
            ]
          : []),
      ].join('\n'),
    );
  }
}
