import {
  buildZavorthControlAdapterInputFromZavorthControlRuntimeProjection,
  buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot,
} from '../projections/index';
import { buildZavorthControlZavorthControlViewModel } from './ZavorthControlAdapter';

export function buildZavorthControlAdapterInputFromZavorthAgentGatewaySnapshot(snapshot: unknown): Record<string, unknown> {
  return buildZavorthControlAdapterInputFromZavorthControlRuntimeProjection(
    buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(snapshot),
  );
}

export function buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot(snapshot: unknown): Record<string, unknown> {
  return buildZavorthControlZavorthControlViewModel(
    buildZavorthControlAdapterInputFromZavorthAgentGatewaySnapshot(snapshot),
  );
}
