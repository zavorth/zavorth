import { RuntimeArtifactMaintenanceService } from '../services/RuntimeArtifactMaintenanceService.js';
import { RuntimeLogMaintenanceService } from '../services/RuntimeLogMaintenanceService.js';
import { initializeBootstrapFoundation, runCapabilityPreflight, startRemoteRuntimeServices } from './bootstrapFoundation.js';
import { composeSurfaceRuntime, registerShutdownHandlers, startChannelGateways, startZavorthControlSurface, startRuntimeWatchers } from './bootstrapSurface.js';
import { createBootstrapSupervisor, printBootstrapBanner, runInitialRuntimeMaintenance } from './bootstrapSupervisor.js';

export async function bootstrapZavorthRuntime(): Promise<void> {
  printBootstrapBanner();

  const supervisor = createBootstrapSupervisor();
  const runtimeArtifactMaintenanceService = new RuntimeArtifactMaintenanceService();
  const runtimeLogMaintenanceService = new RuntimeLogMaintenanceService();
  runInitialRuntimeMaintenance(runtimeArtifactMaintenanceService, runtimeLogMaintenanceService);

  const preflight = runCapabilityPreflight();
  const foundation = await initializeBootstrapFoundation(
    preflight,
    runtimeArtifactMaintenanceService,
    runtimeLogMaintenanceService,
  );

  const botGateway = await startZavorthControlSurface(foundation, supervisor);
  const runtimeServices = await startRemoteRuntimeServices(foundation, supervisor);
  const surfaceRuntime = composeSurfaceRuntime(foundation, botGateway);
  await startRuntimeWatchers(foundation, surfaceRuntime);

  if (supervisor.supervisedIpcEnabled) {
    foundation.logRepo.log(
      'info',
      'Bootstrap',
      'Running under Host Supervisor. Signaling boot_success before channel gateway startup.',
    );
    supervisor.markBootReady();
  }

  registerShutdownHandlers(foundation, runtimeServices, surfaceRuntime, supervisor);
  await startChannelGateways(foundation, surfaceRuntime, supervisor);
}
