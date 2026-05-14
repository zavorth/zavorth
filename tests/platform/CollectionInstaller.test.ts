import {
  CollectionInstaller,
  RecipeRunner,
} from '../../src/platform/collections/CollectionInstaller.js';

describe('CollectionInstaller', () => {
  it('installs all packages resolved from a platform collection', async () => {
    const install = jest.fn(async () => true);
    const installer = new CollectionInstaller({
      registryClient: { install } as any,
      platformRegistryService: {
        buildSnapshot: () => ({
          selectedCollection: {
            id: 'collection:ui-debug',
            entryIds: ['skill:playwright-interactive', 'mcp:playwright'],
            missingCount: 0,
          },
        }),
      } as any,
    });

    await expect(installer.installCollection('ui-debug')).resolves.toEqual(
      expect.objectContaining({
        collectionId: 'collection:ui-debug',
        installedCount: 2,
      }),
    );
    expect(install).toHaveBeenCalledTimes(2);
  });

  it('runs install steps in a recipe and keeps manual steps explicit', async () => {
    const install = jest.fn(async () => true);
    const runner = new RecipeRunner({
      installer: {
        installCollection: jest.fn(async () => ({
          collectionId: 'collection:ui-debug',
          resolvedPackageIds: ['skill:playwright-interactive'],
          installedCount: 1,
          missingCount: 0,
        })),
      } as any,
      registryClient: { install } as any,
    });

    await expect(runner.runRecipe({
      id: 'ui-debug-onboarding',
      applySteps: [
        { action: 'install_pkg', target: 'collection:ui-debug' },
        { action: 'install_pkg', target: 'mcp:playwright' },
        { action: 'configure_env', target: 'PLAYWRIGHT_BROWSERS_PATH' },
      ],
    })).resolves.toEqual(
      expect.objectContaining({
        recipeId: 'ui-debug-onboarding',
        appliedSteps: 2,
        manualSteps: ['configure_env:PLAYWRIGHT_BROWSERS_PATH'],
      }),
    );
    expect(install).toHaveBeenCalledWith('mcp:playwright');
  });
});
