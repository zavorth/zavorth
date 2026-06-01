import { CommandParser } from '../../src/telegram/CommandParser';
import { ZavorthChannelActionService } from '../../src/services/ZavorthChannelActionService';
import { ZavorthChannelMeshService } from '../../src/services/ZavorthChannelMeshService';
import { buildSharedSurfaceCommandServiceComposition } from '../../src/domain/surface/presentation/shared-surface/factory/SharedSurfaceCommandServiceFactory.js';
import { SharedSurfaceControlPlaneCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceControlPlaneCommandPack';
import { SharedSurfacePresentationCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfacePresentationCommandPack';
import { SharedSurfaceTaskVariationCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceTaskVariationCommandPack';

describe('buildSharedSurfaceCommandServiceComposition', () => {
  it('builds the default shared-surface composition from minimal deps', () => {
    const composition = buildSharedSurfaceCommandServiceComposition({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
    });

    expect(composition.parser).toBeInstanceOf(CommandParser);
    expect(composition.controlPlaneCommandPack).toBeInstanceOf(SharedSurfaceControlPlaneCommandPack);
    expect(composition.presentationCommandPack).toBeInstanceOf(SharedSurfacePresentationCommandPack);
    expect(composition.taskVariationCommandPack).toBeInstanceOf(SharedSurfaceTaskVariationCommandPack);
  });

  it('preserves injected parser and channel services', () => {
    const parser = new CommandParser();
    const channelMeshService = new ZavorthChannelMeshService();
    const channelActionService = new ZavorthChannelActionService({
      channelMeshService,
    });

    const composition = buildSharedSurfaceCommandServiceComposition({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      parser,
      channelMeshService,
      channelActionService,
    });

    expect(composition.parser).toBe(parser);
    expect(composition.channelMeshService).toBe(channelMeshService);
    expect(composition.channelActionService).toBe(channelActionService);
    expect(composition.integrationCommandPack).toBeDefined();
  });
});

