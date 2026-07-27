import { randomUUID } from 'crypto';
import { NodeHostCapabilityService } from '../../services/NodeHostCapabilityService.js';
import { CapabilityId } from '../policy/DeviceCapabilityPolicy.js';

export interface NodeCapabilityHandler {
  id: CapabilityId;
  description: string;
  isAvailableOnHost(): Promise<boolean>;
  execute(payload: any): Promise<any>;
}

type NodeCapabilityRegistryOptions = {
  capabilityService?: Pick<NodeHostCapabilityService, 'executeAssignment' | 'listSupportedCapabilityIds'>;
};

class NodeHostCapabilityAdapter implements NodeCapabilityHandler {
  constructor(
    public readonly id: CapabilityId,
    public readonly description: string,
    private readonly capabilityService: Pick<NodeHostCapabilityService, 'executeAssignment' | 'listSupportedCapabilityIds'>,
  ) {}

  async isAvailableOnHost(): Promise<boolean> {
    return this.capabilityService.listSupportedCapabilityIds().includes(this.id);
  }

  async execute(payload: any): Promise<any> {
    const result = await this.capabilityService.executeAssignment({
      id: randomUUID(),
      capabilityId: this.id,
      action: 'invoke',
      payload: payload && typeof payload === 'object' ? payload : null,
    });
    return {
      ok: result.ok,
      summary: result.resultSummary,
      stdout: result.stdout || null,
      stderr: result.stderr || null,
      exitCode: result.exitCode ?? null,
      data: result.data || null,
    };
  }
}

export function buildNodeCapabilitiesRegistry(
  options: NodeCapabilityRegistryOptions = {},
): NodeCapabilityHandler[] {
  const capabilityService = options.capabilityService || new NodeHostCapabilityService();
  const descriptors: Array<{ id: CapabilityId; description: string }> = [
    {
      id: 'device.info',
      description: 'Describes identity, platform and operational signals of the paired device.',
    },
    {
      id: 'browser.proxy',
      description: 'Opens or confirms browser/proxy endpoint on the paired host.',
    },
    {
      id: 'files.read',
      description: 'Reads files within authorized roots of the node.',
    },
    {
      id: 'files.write',
      description: 'Writes files within authorized roots of the node.',
    },
    {
      id: 'files.watch',
      description: 'Watches for changes in files or directories within a controlled window.',
    },
    {
      id: 'screen.capture',
      description: 'Passive capture of the operator device current screen.',
    },
    {
      id: 'camera.capture',
      description: 'Captures image from camera from an explicitly configured source.',
    },
    {
      id: 'location.read',
      description: 'Reads configured location of the device when local policy allows.',
    },
    {
      id: 'clipboard.read',
      description: 'Reads the current clipboard content of the paired host.',
    },
    {
      id: 'clipboard.write',
      description: 'Writes explicit text to the paired host clipboard.',
    },
    {
      id: 'notifications.send',
      description: 'Sends a native notification on the paired host.',
    },
    {
      id: 'system.run',
      description: 'Executes controlled commands on the paired host under local policy.',
    },
    {
      id: 'node.maintenance',
      description: 'Runs doctor and repair on the local state of the node host.',
    },
  ];

  return descriptors.map((descriptor) => new NodeHostCapabilityAdapter(
    descriptor.id,
    descriptor.description,
    capabilityService,
  ));
}

export const RegistryOfNodeCapabilities = buildNodeCapabilitiesRegistry();
