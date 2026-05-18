import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Command Center Provider & Model Catalog Implementation', () => {
  it('exposes a read-only provider model catalog route, scripts, and dashboard panel', () => {
    const routeSource = readFileSync(
      join(process.cwd(), 'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts'),
      'utf8',
    );
    const pagesSource = readFileSync(
      join(process.cwd(), 'assets/command-center/scripts/pages.js'),
      'utf8',
    );
    const runtimeBridgeSource = readFileSync(
      join(process.cwd(), 'assets/command-center/scripts/runtime-bridge.js'),
      'utf8',
    );
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(routeSource).toContain("pathname === '/api/providers/model-catalog'");
    expect(routeSource).toContain('buildProviderModelCatalogProjection');
    expect(routeSource).toContain('provider_model_catalog_live_probe_requires_explicit_operator_cli_or_approved_api');
    expect(pagesSource).toContain('Provider & Model Catalog');
    expect(pagesSource).toContain('data-provider-model-catalog-summary');
    expect(pagesSource).toContain('data-provider-model-catalog-list');
    expect(runtimeBridgeSource).toContain('/api/providers/model-catalog');
    expect(runtimeBridgeSource).toContain('updateProviderModelCatalog');
    expect(runtimeBridgeSource).toContain('state.providerModelCatalog');
    expect(packageJson.scripts['zavorth:provider-model-catalog']).toContain('zavorth-provider-model-catalog.ts');
    expect(packageJson.scripts['zavorth:provider-model-catalog:check']).toContain('zavorth-provider-model-catalog-check.mjs');
    expect(packageJson.scripts['qa:zavorth-provider-model-catalog']).toContain('zavorth-provider-model-catalog-check.mjs');
  });
});
