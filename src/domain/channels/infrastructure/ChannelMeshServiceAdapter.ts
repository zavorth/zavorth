import type { ChannelMeshPort, ChannelRegistryPort } from '../domain/ChannelsDomainTypes.js';

export class ChannelMeshServiceAdapter {
  constructor(
    private readonly channelMesh: ChannelMeshPort | null = null,
    private readonly channelRegistry: ChannelRegistryPort | null = null,
  ) {}

  public buildMeshSnapshot(): ReturnType<ChannelMeshPort['buildSnapshot']> | null {
    return this.channelMesh?.buildSnapshot() || null;
  }

  public listRegistryChannels(): ReturnType<ChannelRegistryPort['listChannels']> {
    return this.channelRegistry?.listChannels() || [];
  }
}
