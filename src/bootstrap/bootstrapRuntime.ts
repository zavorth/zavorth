import { RuntimeArtifactMaintenanceService } from '../services/RuntimeArtifactMaintenanceService.js';
import { RuntimeLogMaintenanceService } from '../services/RuntimeLogMaintenanceService.js';
import { initializeBootstrapFoundation, runCapabilityPreflight, startRemoteRuntimeServices } from './bootstrapFoundation.js';
import { composeSurfaceRuntime, registerShutdownHandlers, startChannelGateways, startDashboardSurface, startRuntimeWatchers } from './bootstrapSurface.js';
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

  const botGateway = await startDashboardSurface(foundation, supervisor);
  const runtimeServices = await startRemoteRuntimeServices(foundation, supervisor);
  const surfaceRuntime = composeSurfaceRuntime(foundation, botGateway);
  await startRuntimeWatchers(foundation, surfaceRuntime);

  if (supervisor.supervisedIpcEnabled) {
    foundation.logRepo.log(
      'info',
      'Bootstrap',
      'Rodando sob Host Supervisor. Sinalizando boot_success antes do startup dos gateways de canal.',
    );
    supervisor.markBootReady();
  }

  registerShutdownHandlers(foundation, runtimeServices, surfaceRuntime, supervisor);
  await startChannelGateways(foundation, surfaceRuntime, supervisor);
}
