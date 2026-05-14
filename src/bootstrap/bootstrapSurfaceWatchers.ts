import type {
  BootstrapFoundation,
  BootstrapSurfaceRuntime,
} from './bootstrapTypes.js';

export async function startRuntimeWatchers(
  foundation: BootstrapFoundation,
  surfaceRuntime: BootstrapSurfaceRuntime,
): Promise<void> {
  const WatcherModule = require('../orchestrator/RealZavorthBridgeWatcher.js').RealZavorthBridgeWatcher;
  const MailboxWatcher = require('../orchestrator/MailboxWatcher.js').MailboxWatcher;

  const responseWatcher = new WatcherModule(foundation.logRepo, surfaceRuntime.botGateway, {
    taskManager: foundation.taskManager,
    permissionService: surfaceRuntime.botGateway.getPermissionService(),
    botApi: surfaceRuntime.botGateway.getBotApi(),
    formatPermissionCreatedMessage: surfaceRuntime.botGateway.formatPermissionCreatedMessage.bind(surfaceRuntime.botGateway),
    buildPermissionKeyboard: surfaceRuntime.botGateway.buildPermissionKeyboard.bind(surfaceRuntime.botGateway),
  });

  if (
    foundation.runtimeProfileService.supportsAdvancedWatchers() &&
    foundation.capabilityLifecycleService.shouldBootCapability('remote')
  ) {
    responseWatcher.start();
  } else {
    foundation.logRepo.log(
      'info',
      'RealZavorthBridgeWatcher',
      `Watcher remoto mantido dormente no perfil ${foundation.runtimeProfileService.getProfile()}.`,
    );
  }

  const mailboxWatcher = new MailboxWatcher(
    foundation.taskManager,
    foundation.logRepo,
    surfaceRuntime.botGateway,
    foundation.toolRuntime,
    {
      executionGateway: surfaceRuntime.botGateway.getExecutionGateway(),
    },
  );

  if (
    foundation.runtimeProfileService.supportsAdvancedWatchers() &&
    foundation.capabilityLifecycleService.shouldBootCapability('remote')
  ) {
    await mailboxWatcher.start();
  } else {
    foundation.logRepo.log(
      'info',
      'MailboxWatcher',
      `Mailbox watcher remoto mantido dormente no perfil ${foundation.runtimeProfileService.getProfile()}.`,
    );
  }
}
