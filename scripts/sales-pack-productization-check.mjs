import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return readFileSync(absolutePath, 'utf8');
}

function requireIncludes(file, content, markers) {
  const missing = markers.filter((marker) => !content.includes(marker));
  if (missing.length > 0) {
    throw new Error(`${file} missing markers: ${missing.join(', ')}`);
  }
}

const routeFile = 'src/services/ZavorthControlCoreRouteService.ts';
const route = read(routeFile);
requireIncludes(routeFile, route, [
  'SalesPackMvpService',
  'SalesPackBusinessModeService',
  '/api/v2/sales-pack/snapshot',
  '/api/v2/sales-pack/business-mode',
  '/api/v2/sales-pack/inbound',
  '/api/v2/sales-pack/demo',
  'readBusinessModeIdentity',
  'resolveAuthenticatedIdentity',
  'Unauthorized',
  'readSalesPackInboundMessage',
]);

const businessModeServiceFile = 'src/services/SalesPackBusinessModeService.ts';
const businessModeService = read(businessModeServiceFile);
requireIncludes(businessModeServiceFile, businessModeService, [
  'SalesPackBusinessModeService',
  'sales-pack-business-mode-state.json',
  'business-mode-does-not-store-secrets',
  'profileKey',
  'setEnabled',
]);

const contractFile = 'src/contracts/SalesPackContract.ts';
const contract = read(contractFile);
requireIncludes(contractFile, contract, [
  'SalesPackInboundMessageInput',
  'SalesPackConversationResult',
  'SalesPackControlPlaneSnapshot',
  'SalesPackControlPlaneAction',
]);

const sdkFile = 'src/sdk/sales-pack.ts';
const sdk = read(sdkFile);
requireIncludes(sdkFile, sdk, [
  "export * from '../contracts/SalesPackContract.js'",
  "export * from '../domain/platform-ecosystem/application/sales-pack/index.js'",
]);

const testFile = 'tests/domain/platform-ecosystem/SalesPackProductizationRoute.test.ts';
const test = read(testFile);
requireIncludes(testFile, test, [
  'serves a control-plane snapshot',
  'processes inbound sales messages',
  'rejects malformed inbound payloads',
]);

const businessHookFile = 'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/useZavorthControlSalesPackBusinessMode.ts';
const businessHook = read(businessHookFile);
requireIncludes(businessHookFile, businessHook, [
  'BUSINESS_MODE_STORAGE_KEY',
  '/api/v2/sales-pack/business-mode',
  '/api/v2/sales-pack/snapshot',
  '/api/v2/sales-pack/demo',
  'fetchBusinessModePreference',
  'updateBusinessModePreference',
  'buildBusinessModeIdentityHeaders',
  'buildBusinessModePreferenceUrl',
  'effectiveEnabled',
  'activationReason',
]);

const overviewFile = 'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlOverviewSector.tsx';
const overview = read(overviewFile);
requireIncludes(overviewFile, overview, [
  'Modo Business',
  'Ativar Modo Business',
  'Atendimento comercial fica oculto por padrao',
  'Criar exemplo local',
  'salesPackBusinessMode.effectiveEnabled',
]);

console.log('[sales-pack-productization-check] ok');
