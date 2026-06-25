import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const files = {
  authPlane: 'src/zavorth-control/lib/oauth/authPlane.ts',
  oauthCompat: 'src/zavorth-control/lib/oauth/compat/legacyEnvAliases.ts',
  providerRegistry: 'src/zavorth-control/lib/oauth/providers.ts',
  storagePlane: 'src/zavorth-control/lib/db/storagePlane.ts',
  backupAdapters: 'src/zavorth-control/lib/db/jsonBackupAdapters.ts',
  jsonMigration: 'src/zavorth-control/lib/db/jsonMigration.ts',
  migrationRunner: 'src/zavorth-control/lib/db/migrationRunner.ts',
  coreSingleton: 'src/zavorth-control/lib/db/core/coreSingleton.ts',
  singletonCompat: 'src/zavorth-control/lib/db/core/legacyDbSingletonCompat.ts',
  coreSchemaBootstrap: 'src/zavorth-control/lib/db/core/coreSchemaBootstrap.ts',
  exportRoute: 'src/zavorth-control/app/api/settings/export-json/route.ts',
  importRoute: 'src/zavorth-control/app/api/settings/import-json/route.ts',
  initialSchema: 'src/zavorth-control/lib/db/migrations/001_initial_schema.sql',
  upstreamProxySchema: 'src/zavorth-control/lib/db/migrations/017_version_manager_upstream_proxy.sql',
};

checkRequiredFiles();
checkAuthPlaneIsolation();
checkStoragePlaneIsolation();
checkBackupImportExportContracts();
checkCanonicalSchemaResidues();

if (failures.length > 0) {
  console.error('[auth-storage] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[auth-storage] ok: auth/storage planes, backup compatibility, import validation, and canonical schema guard passed.');

function checkRequiredFiles() {
  for (const filePath of Object.values(files)) {
    if (!fs.existsSync(abs(filePath))) {
      failures.push(`${filePath}: missing`);
    }
  }
}

function checkAuthPlaneIsolation() {
  const auth = read(files.authPlane);
  const compat = read(files.oauthCompat);
  const registry = read(files.providerRegistry);

  expectIncludes(files.authPlane, auth, [
    'createZavorthProviderAuthPlane',
    'getZavorthOAuthServerCredentials',
    'ZAVORTH_OAUTH_ENV',
    'ZAVORTH_OAUTH_LEGACY_ENV_ALIASES',
  ]);
  expectIncludes(files.oauthCompat, compat, [
    'ZAVORTH_OAUTH_LEGACY_ENV_ALIASES',
    'ZavorthGateway_SERVER',
    'ZavorthGateway_TOKEN',
    'ZavorthGateway_USER_ID',
  ]);
  expectIncludes(files.providerRegistry, registry, [
    'createZavorthProviderAuthPlane(PROVIDERS)',
    'getProviderAuthDescriptor',
    'getProviderAuthDescriptors',
  ]);

  forbid(files.authPlane, auth, [
    'ZavorthGateway_SERVER',
    'ZavorthGateway_TOKEN',
    'ZavorthGateway_USER_ID',
    'CLI_TOKEN',
  ]);
}

function checkStoragePlaneIsolation() {
  const storage = read(files.storagePlane);
  const singleton = read(files.coreSingleton);
  const singletonCompat = read(files.singletonCompat);
  const runner = read(files.migrationRunner);
  const bootstrap = read(files.coreSchemaBootstrap);

  expectIncludes(files.storagePlane, storage, [
    'ZAVORTH_STORAGE_PLANE',
    'migrationLedgerTable: "_zavorth_migrations"',
    'legacyMigrationLedgerTables',
    '_ZavorthGateway_migrations',
    'ensureZavorthMigrationLedger',
    'getAppliedZavorthMigrations',
    'recordZavorthMigration',
  ]);
  expectIncludes(files.coreSingleton, singleton, [
    '__ZavorthDb',
    'getLegacyStoredDb',
    'setLegacyStoredDb',
    'clearLegacyStoredDb',
  ]);
  expectIncludes(files.singletonCompat, singletonCompat, [
    '__ZavorthGatewayDb',
    'getLegacyStoredDb',
    'setLegacyStoredDb',
    'clearLegacyStoredDb',
  ]);
  expectIncludes(files.migrationRunner, runner, [
    'ensureZavorthMigrationLedger',
    'getAppliedZavorthMigrations',
    'recordZavorthMigration',
  ]);
  expectIncludes(files.coreSchemaBootstrap, bootstrap, [
    'ensureZavorthMigrationLedger',
    'recordZavorthMigration(db, "001", "initial_schema")',
  ]);

  forbid(files.coreSingleton, singleton, ['__ZavorthGatewayDb']);
}

function checkBackupImportExportContracts() {
  const adapters = read(files.backupAdapters);
  const migration = read(files.jsonMigration);
  const importRoute = read(files.importRoute);
  const exportRoute = read(files.exportRoute);

  expectIncludes(files.backupAdapters, adapters, [
    'SUPPORTED_SETTINGS_EXPORT_VERSIONS',
    'SUPPORTED_LEGACY_SETTINGS_EXPORT_VERSIONS',
    'ZavorthGateway-v3-settings-export',
    'validateZavorthSettingsBackup',
    'stripUnsafeAuthSettings',
    'createZavorthSettingsBackup',
    'createZavorthSettingsBackupFilename',
  ]);
  expectIncludes(files.jsonMigration, migration, [
    'ZAVORTH_KEY_VALUE_NAMESPACES',
    'provider_connections',
    'provider_nodes',
    'key_value',
    'api_keys',
  ]);
  expectIncludes(files.importRoute, importRoute, [
    'validateZavorthSettingsBackup',
    'stripUnsafeAuthSettings',
    'backupDbFile("pre-json-import")',
    'runJsonMigration',
  ]);
  expectIncludes(files.exportRoute, exportRoute, [
    'createZavorthSettingsBackup',
    'createZavorthSettingsBackupFilename',
    'password: _pw',
    'requireLogin: _rl',
  ]);
}

function checkCanonicalSchemaResidues() {
  const legacyRouteMarker = ['Omni', 'Route'].join('');
  const legacyGatewayBaseUrlMarker = ['OMNI', 'ROUTE_BASE_URL'].join('');
  const forbidden = [
    new RegExp(legacyRouteMarker, 'i'),
    /9router/i,
    /sk_zavorthBridge/i,
    new RegExp(legacyGatewayBaseUrlMarker, 'i'),
    /x-zavorth-bridge-source/i,
    /\.zavorthBridge/i,
  ];
  const schemaFiles = [
    files.initialSchema,
    files.upstreamProxySchema,
    files.storagePlane,
    files.backupAdapters,
    files.jsonMigration,
    files.migrationRunner,
    files.exportRoute,
    files.importRoute,
  ];

  for (const filePath of schemaFiles) {
    const source = read(filePath);
    for (const pattern of forbidden) {
      if (pattern.test(source)) {
        failures.push(`${filePath}: forbidden legacy residue ${pattern}`);
      }
    }
  }
}

function expectIncludes(filePath, source, snippets) {
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${filePath}: expected to include ${snippet}`);
    }
  }
}

function forbid(filePath, source, snippets) {
  for (const snippet of snippets) {
    if (source.includes(snippet)) {
      failures.push(`${filePath}: should not include ${snippet}`);
    }
  }
}

function read(filePath) {
  const fullPath = abs(filePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf8');
}

function abs(filePath) {
  return path.join(root, filePath);
}
