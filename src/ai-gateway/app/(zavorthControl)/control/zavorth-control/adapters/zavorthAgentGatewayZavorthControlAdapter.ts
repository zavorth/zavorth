import {
  buildZavorthControlAdapterInputFromZavorthControlRuntimeProjection,
  buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot,
} from '../projections/index';
import { buildZavorthControlZavorthControlViewModel } from './ZavorthControlAdapter';

export function buildZavorthControlAdapterInputFromZavorthAgentGatewaySnapshot(snapshot: any): Record<string, any> {
  return buildZavorthControlAdapterInputFromZavorthControlRuntimeProjection(
    buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(snapshot),
  );
}

export function buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot(snapshot: any): Record<string, any> {
  return buildZavorthControlZavorthControlViewModel(
    buildZavorthControlAdapterInputFromZavorthAgentGatewaySnapshot(snapshot),
  );
}
