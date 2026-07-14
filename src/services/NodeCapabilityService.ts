import type {
  NodeMeshCapabilityDescriptor,
  NodeMeshCapabilityId,
} from '../contracts/NodeMeshContract.js';

const NODE_MESH_CAPABILITY_CATALOG: Record<string, NodeMeshCapabilityDescriptor> = {
  'system.run': {
    id: 'system.run',
    label: 'System Run',
    summary: 'Permite executar comandos controlados no node pareado.',
    category: 'system',
    risky: true,
    actionHint: 'Use para execucao remota com politica zero-trust.',
  },
  'node.maintenance': {
    id: 'node.maintenance',
    label: 'Node Maintenance',
    summary: 'Executa doctor e repair operacional no node host pareado.',
    category: 'system',
    risky: false,
    actionHint: 'Use para diagnosticar o host e reparar o estado local antes de reinvocar a malha.',
  },
  'browser.proxy': {
    id: 'browser.proxy',
    label: 'Browser Proxy',
    summary: 'Expoe navegador ou proxy headless do node para tarefas guiadas.',
    category: 'browser',
    risky: false,
    actionHint: 'Bom para automacao remota de navegador ou leitura web assistida.',
  },
  'screen.capture': {
    id: 'screen.capture',
    label: 'Screen Capture',
    summary: 'Captura tela ou janela remota do node.',
    category: 'device',
    risky: false,
    actionHint: 'Use quando precisar ver o contexto visual do node host.',
  },
  'device.info': {
    id: 'device.info',
    label: 'Device Info',
    summary: 'Le identidade, plataforma e metadados operacionais do node pareado.',
    category: 'device',
    risky: false,
    actionHint: 'Ideal para descobrir o contexto real do companion antes de invocar outras capacidades.',
  },
  'camera.capture': {
    id: 'camera.capture',
    label: 'Camera Capture',
    summary: 'Le camera do dispositivo pareado quando permitido.',
    category: 'device',
    risky: true,
    actionHint: 'Reserve para fluxos multimodais que precisem de camera.',
  },
  'notifications.send': {
    id: 'notifications.send',
    label: 'Notifications',
    summary: 'Envia notifications locais pelo node pareado.',
    category: 'notifications',
    risky: false,
    actionHint: 'Bom para sinais operacionais e handoffs.',
  },
  'location.read': {
    id: 'location.read',
    label: 'Location Read',
    summary: 'Le localizacao do dispositivo quando explicitamente liberado.',
    category: 'location',
    risky: true,
    actionHint: 'Evite usar sem uma razao operacional clara.',
  },
  'device.confirm': {
    id: 'device.confirm',
    label: 'Device Confirm',
    summary: 'Confirma uma acao sensivel no dispositivo pareado, com presenca do usuario ou WebAuthn.',
    category: 'device',
    risky: true,
    actionHint: 'Use antes de camera, localizacao, comandos remotos ou handoffs sensiveis.',
  },
  'haptics.vibrate': {
    id: 'haptics.vibrate',
    label: 'Haptics Vibrate',
    summary: 'Dispara um pulso haptico no companion quando a superficie suporta vibracao.',
    category: 'device',
    risky: false,
    actionHint: 'Use para feedback operacional curto em dispositivos moveis.',
  },
  'files.read': {
    id: 'files.read',
    label: 'Files Read',
    summary: 'Le arquivos do node dentro do escopo autorizado.',
    category: 'files',
    risky: false,
    actionHint: 'Ideal para leitura remota controlada.',
  },
  'files.write': {
    id: 'files.write',
    label: 'Files Write',
    summary: 'Escreve arquivos no node dentro do escopo autorizado.',
    category: 'files',
    risky: true,
    actionHint: 'Combine com approvals e policy antes de liberar.',
  },
  'files.watch': {
    id: 'files.watch',
    label: 'Files Watch',
    summary: 'Observa mudancas em arquivos ou diretorios do node por uma janela controlada.',
    category: 'files',
    risky: false,
    actionHint: 'Use para esperar artefatos, logs ou checkpoints locais sem polling agressivo.',
  },
  'clipboard.read': {
    id: 'clipboard.read',
    label: 'Clipboard Read',
    summary: 'Le clipboard local do node pareado.',
    category: 'device',
    risky: true,
    actionHint: 'Use so quando o operador souber exatamente o que sera lido.',
  },
  'clipboard.write': {
    id: 'clipboard.write',
    label: 'Clipboard Write',
    summary: 'Escreve um texto controlado no clipboard local do node pareado.',
    category: 'device',
    risky: true,
    actionHint: 'Use para preparar handoffs curtos no host do operador, sempre com texto explicito.',
  },
};

export class NodeCapabilityService {
  public listCatalog(): NodeMeshCapabilityDescriptor[] {
    return Object.values(NODE_MESH_CAPABILITY_CATALOG).sort((left, right) =>
      left.label.localeCompare(right.label, 'en-US'),
    );
  }

  public normalizeCapabilityIds(input: Array<string | null | undefined> | null | undefined): NodeMeshCapabilityId[] {
    return Array.from(
      new Set(
        (input || [])
          .map((entry) => String(entry || '').trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right, 'en-US'));
  }

  public describeCapabilityIds(
    input: Array<string | null | undefined> | null | undefined,
  ): NodeMeshCapabilityDescriptor[] {
    return this.normalizeCapabilityIds(input).map((entry) => this.describeCapability(entry));
  }

  public describeCapability(capabilityId: string | null | undefined): NodeMeshCapabilityDescriptor {
    const normalizedId = String(capabilityId || '').trim();
    if (!normalizedId) {
      return {
        id: 'misc.unknown',
        label: 'Capacidade nao informada',
        summary: 'O node nao informou a capacidade com detalhes suficientes.',
        category: 'misc',
        risky: false,
        actionHint: null,
      };
    }

    const known = NODE_MESH_CAPABILITY_CATALOG[normalizedId];
    if (known) {
      return known;
    }

    return {
      id: normalizedId,
      label: normalizedId,
      summary: 'Capacidade declarada pelo proprio node e ainda nao catalogada no core.',
      category: 'misc',
      risky: /run|write|camera|clipboard|location/i.test(normalizedId),
      actionHint: 'Revise a capability antes de usa-la em automacao remota.',
    };
  }
}
