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
      description: 'Descreve identidade, plataforma e sinais operacionais do device pareado.',
    },
    {
      id: 'browser.proxy',
      description: 'Abre ou confirma endpoint de navegador/proxy no host pareado.',
    },
    {
      id: 'files.read',
      description: 'Le arquivos dentro das raizes autorizadas do node.',
    },
    {
      id: 'files.write',
      description: 'Escreve arquivos dentro das raizes autorizadas do node.',
    },
    {
      id: 'files.watch',
      description: 'Observa mudancas em arquivos ou diretorios por uma janela controlada.',
    },
    {
      id: 'screen.capture',
      description: 'Captura passiva da tela atual do device do operador.',
    },
    {
      id: 'camera.capture',
      description: 'Captura imagem de camera a partir de fonte explicitamente configurada.',
    },
    {
      id: 'location.read',
      description: 'Le localizacao configurada do device quando a policy local permite.',
    },
    {
      id: 'clipboard.read',
      description: 'Le o conteudo atual do clipboard do host pareado.',
    },
    {
      id: 'clipboard.write',
      description: 'Escreve texto explicito no clipboard do host pareado.',
    },
    {
      id: 'notifications.send',
      description: 'Envia uma notificacao nativa no host pareado.',
    },
    {
      id: 'system.run',
      description: 'Executa comandos controlados no host pareado sob policy local.',
    },
    {
      id: 'node.maintenance',
      description: 'Executa doctor e repair do state local do node host.',
    },
  ];

  return descriptors.map((descriptor) => new NodeHostCapabilityAdapter(
    descriptor.id,
    descriptor.description,
    capabilityService,
  ));
}

export const RegistryOfNodeCapabilities = buildNodeCapabilitiesRegistry();
