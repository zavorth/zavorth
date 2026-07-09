import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import {
  SharedSurfaceNaturalChannelCommandPack,
  type SharedSurfaceNaturalChannelCommandPackDeps,
} from './SharedSurfaceNaturalChannelCommandPack.js';
import {
  SharedSurfaceNaturalPluginCommandPack,
  type SharedSurfaceNaturalPluginCommandPackDeps,
} from './SharedSurfaceNaturalPluginCommandPack.js';
import {
  SharedSurfaceNaturalTransportCommandPack,
  type SharedSurfaceNaturalTransportCommandPackDeps,
} from './SharedSurfaceNaturalTransportCommandPack.js';
import {
  SharedSurfaceNaturalNodeCommandPack,
  type SharedSurfaceNaturalNodeCommandPackDeps,
} from './SharedSurfaceNaturalNodeCommandPack.js';



export type SharedSurfaceNaturalMeshCommandPackDeps = SharedSurfaceNaturalChannelCommandPackDeps
  & SharedSurfaceNaturalPluginCommandPackDeps
  & SharedSurfaceNaturalTransportCommandPackDeps
  & SharedSurfaceNaturalNodeCommandPackDeps;

export class SharedSurfaceNaturalMeshCommandPack {
  private readonly pluginCommandPack: SharedSurfaceNaturalPluginCommandPack;
  private readonly transportCommandPack: SharedSurfaceNaturalTransportCommandPack;
  private readonly channelCommandPack: SharedSurfaceNaturalChannelCommandPack;
  private readonly nodeCommandPack: SharedSurfaceNaturalNodeCommandPack;

  public constructor(deps: SharedSurfaceNaturalMeshCommandPackDeps) {
    this.pluginCommandPack = new SharedSurfaceNaturalPluginCommandPack({
      integrationCommandPack: deps.integrationCommandPack,
      pluginRegistryService: deps.pluginRegistryService,
    });
    this.transportCommandPack = new SharedSurfaceNaturalTransportCommandPack({
      integrationCommandPack: deps.integrationCommandPack,
      remoteTransportService: deps.remoteTransportService,
    });
    this.channelCommandPack = new SharedSurfaceNaturalChannelCommandPack({
      channelInstallService: deps.channelInstallService,
      channelSetupAssistantService: deps.channelSetupAssistantService,
      naturalChannelSetupTurnService: deps.naturalChannelSetupTurnService,
      integrationHubService: deps.integrationHubService,
      integrationCommandPack: deps.integrationCommandPack,
    });
    this.nodeCommandPack = new SharedSurfaceNaturalNodeCommandPack({
      sessionNodeCommandPack: deps.sessionNodeCommandPack,
      nodeMeshService: deps.nodeMeshService,
      nodeDeviceProfiles: deps.nodeDeviceProfiles,
      nodePairingService: deps.nodePairingService,
    });
  }

  public async maybeHandle(ctx: IMessageContext, rawText: string): Promise<boolean> {
    const normalizedRawText = String(rawText || '').trim();
    if (!normalizedRawText || normalizedRawText.startsWith('/')) {
      return false;
    }

    if (await this.pluginCommandPack.maybeHandle(ctx, normalizedRawText)) {
      return true;
    }
    if (await this.transportCommandPack.maybeHandle(ctx, normalizedRawText)) {
      return true;
    }
    if (await this.channelCommandPack.maybeHandle(ctx, normalizedRawText)) {
      return true;
    }
    if (await this.nodeCommandPack.maybeHandle(ctx, normalizedRawText)) {
      return true;
    }

    return false;
  }
}
