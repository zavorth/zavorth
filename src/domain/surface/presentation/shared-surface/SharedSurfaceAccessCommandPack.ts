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
    const mode = String(args || '').trim().toLowerCase();

    if (mode === 'local') {
      await ctx.reply([
        'Acesso local do Zavorth',
        '',
        `Status: ${manifest.local.ready ? 'pronto' : 'pendente'}.`,
        `App: ${manifest.local.appUrl}`,
        `Dashboard legado: ${manifest.local.dashboardUrl}`,
        `API web: ${manifest.local.apiBaseUrl}`,
        '',
        ...manifest.guides.local.slice(0, 4).map((line) => `- ${line}`),
      ].join('\n'));
      return;
    }

    if (mode === 'remote' || mode === 'remoto') {
      await ctx.reply([
        'Acesso remoto oficial do Zavorth',
        '',
        `Status: ${officialRemote.remote.ready ? 'pronto' : 'pendente'}.`,
        `URL publica: ${officialRemote.remote.baseUrl || manifest.remote.baseUrl || 'nao configurada'}`,
        `App remoto: ${officialRemote.remote.appUrl || manifest.remote.appUrl || 'nao configurado'}`,
        `HTTPS obrigatorio: ${manifest.remote.requiresHttps ? 'sim' : 'ok'}`,
        `Caminho recomendado: ${officialRemote.recommendedPathId || 'official'} - ${officialRemote.recommendedPathReason}`,
        '',
        ...officialRemote.nextSteps.slice(0, 4).map((line) => `- ${line}`),
        '',
        `Comandos uteis: ${manifest.commands.access} | ${manifest.commands.remote} | ${manifest.commands.trust}`,
      ].join('\n'));
      return;
    }

    await ctx.reply([
      'Manifesto de acesso do Zavorth',
      '',
      manifest.summary,
      '',
      `Local: ${manifest.local.appUrl} (${manifest.local.ready ? 'pronto' : 'pendente'})`,
      `Remoto: ${manifest.remote.appUrl || 'nao configurado'} (${manifest.remote.ready ? 'pronto' : 'pendente'})`,
      `Auth web: ${manifest.auth.required ? manifest.auth.source : 'ausente'} | host autorizado: ${manifest.auth.authorizedHost === false ? 'nao' : 'sim'}`,
      `Caminho remoto oficial: ${officialRemote.recommendedPathId || 'official'} | ${officialRemote.remote.ready ? 'validado' : 'pendente'}`,
      '',
      'Superficies recomendadas:',
      ...manifest.surfaces.slice(0, 4).map((surface) =>
        `- ${surface.label}: ${surface.entry}${surface.remoteEntry ? ` | remoto: ${surface.remoteEntry}` : ''} | ${surface.ready ? 'pronto' : 'pendente'}`,
      ),
      '',
      `Paridade web/Telegram: ${consistency.summary}`,
      ...consistency.recommended.slice(0, 3).map((entry) => `- ${entry.surfaceCommand}: ${entry.description}`),
      '',
      `Comandos uteis: ${manifest.commands.start} | ${manifest.commands.bootstrap} | ${manifest.commands.manifest}`,
      ...manifest.nextSteps.slice(0, 4).map((step) => `- ${step.title}: ${step.description}`),
    ].join('\n'));
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

    await ctx.reply([
      'Bootstrap operacional do Zavorth',
      '',
      report.summary,
      '',
      `.env: ${report.env.envFilePresent ? 'ok' : 'ausente'} | provider=${report.env.llmProvider} | credencial=${report.env.llmCredentialReady ? 'ok' : 'pendente'}`,
      `Dependencias: ${report.dependencies.installRequired ? 'npm install pendente' : 'ok'} | build=${report.dependencies.buildRequired ? 'pendente' : 'ok'}`,
      `Local: ${report.supervisedRuntime.accessReadiness.local.ready ? 'pronto' : 'pendente'} | remoto: ${report.supervisedRuntime.accessReadiness.remote.ready ? 'pronto' : 'pendente'}`,
      `Acesso remoto oficial: ${officialRemote.remote.ready ? 'validado' : 'pendente'} | ${officialRemote.recommendedPathReason}`,
      `Paridade entre superficies: ${consistency.summary}`,
      '',
      ...(nextActions.length > 0
        ? [
            'Passos recomendados:',
            ...nextActions.map((action) => `- ${action.title}: ${action.command}`),
          ]
        : ['Nenhum passo pendente. O bootstrap esta fechado.']),
      ...(journeyPhases.length > 0
        ? [
            '',
            'Etapas oficiais ainda pendentes:',
            ...journeyPhases.map((phase) => `- ${phase.title}: ${phase.command || phase.summary}`),
          ]
        : []),
    ].join('\n'));
  }
}
