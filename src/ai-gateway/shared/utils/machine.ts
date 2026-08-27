import { getConsistentMachineId } from "./machineId";
import { logger } from "@/shared/utils/logger";

// Get machine ID using node-machine-id with salt
export async function getMachineId() {
  return await getConsistentMachineId();
}

// Keep sync functions for backward compatibility but make them no-ops
// (Frontend sync is disabled - use backend sync instead)
export async function syncProviderDataToCloud(_cloudUrl) {
  logger.info("Frontend sync is disabled. Use backend sync instead.");
  return Promise.resolve(true);
}

export async function getProvidersNeedingRefresh() {
  logger.info("Frontend sync is disabled. Use backend sync instead.");
  return Promise.resolve([]);
}
