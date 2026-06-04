#!/usr/bin/env node

import { ProviderIntegrationRegistry } from '../src/services/providers/catalog/ProviderIntegrationRegistry.js';
import { ZAVORTH_CAPABILITY_CERTIFICATION_REQUIRED_PROVIDER_ROUTES } from '../src/services/ZavorthCapabilityCertificationPackService.js';

const args = process.argv.slice(2);
const registry = new ProviderIntegrationRegistry();
const missing = ZAVORTH_CAPABILITY_CERTIFICATION_REQUIRED_PROVIDER_ROUTES.filter((route) => !registry.resolveRoute(route));
const snapshot = {
  surface: 'provider-certification',
  status: missing.length === 0 ? 'passed' : 'blocked',
  routeCount: registry.buildSnapshot().routeCount,
  requiredRoutes: ZAVORTH_CAPABILITY_CERTIFICATION_REQUIRED_PROVIDER_ROUTES,
  missingRoutes: missing,
  catalogOnlyUntilLiveProof: true,
  noRawSecretsSerialized: true,
};

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write([
    'Zavorth Provider Certification',
    `Status: ${snapshot.status}`,
    `Routes: ${snapshot.routeCount}`,
    `Missing: ${missing.join(',') || 'none'}`,
    '',
  ].join('\n'));
}

if ((args.includes('--require-pass') || args.includes('--strict')) && missing.length > 0) {
  process.exitCode = 1;
}
