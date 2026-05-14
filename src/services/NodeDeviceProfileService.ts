import type {
  NodeMeshDeviceProfileDescriptor,
  NodeMeshDeviceProfileId,
  NodeMeshNodeKind,
} from '../contracts/NodeMeshContract.js';

const NODE_DEVICE_PROFILES: Record<string, NodeMeshDeviceProfileDescriptor> = {
  'headless-worker': {
    id: 'headless-worker',
    label: 'Headless Worker',
    kind: 'headless',
    transport: 'bridge',
    summary: 'Node utilitario para execucao remota segura, browser proxy e leitura/escrita controlada de arquivos.',
    operatorSummary: 'Perfil ideal para servidores, WSL e hosts sem UI dedicada.',
    defaultCapabilityIds: ['device.info', 'system.run', 'files.read', 'files.write', 'files.watch', 'browser.proxy'],
    actionHint: 'Use para filas remotas, automacao de navegador e IO controlado no host.',
  },
  'desktop-companion': {
    id: 'desktop-companion',
    label: 'Desktop Companion',
    kind: 'desktop',
    transport: 'remote',
    summary: 'Node com contexto visual do desktop, notificacoes e leitura/escrita controlada do host.',
    operatorSummary: 'Perfil pensado para Windows/macOS/Linux com tela e operador por perto.',
    defaultCapabilityIds: ['device.info', 'screen.capture', 'notifications.send', 'files.read', 'files.write', 'files.watch', 'clipboard.read', 'clipboard.write'],
    actionHint: 'Use para suporte visual, contexto de tela, notificacoes e IO local controlado.',
  },
  'mobile-companion': {
    id: 'mobile-companion',
    label: 'Mobile Companion',
    kind: 'mobile',
    transport: 'remote',
    summary: 'Node para dispositivo movel com sinais de camera, localizacao e notificacoes.',
    operatorSummary: 'Perfil preparado para companion mobile com sinais reais de contexto e captura pragmatica.',
    defaultCapabilityIds: ['device.info', 'camera.capture', 'notifications.send', 'location.read', 'device.confirm', 'haptics.vibrate'],
    actionHint: 'Use para companion mobile, camera/localizacao contextual e handoffs remotos.',
  },
  'browser-companion': {
    id: 'browser-companion',
    label: 'Browser Companion',
    kind: 'browser',
    transport: 'sidecar',
    summary: 'Node especializado em browser proxy e contexto visual leve para navegacao guiada.',
    operatorSummary: 'Perfil util para sidecars de browser e bridges de automacao web.',
    defaultCapabilityIds: ['device.info', 'browser.proxy', 'screen.capture', 'files.read'],
    actionHint: 'Use quando o objetivo principal for navegacao assistida e automacao web.',
  },
};

const NODE_DEVICE_PROFILE_ALIASES: Record<string, NodeMeshDeviceProfileId> = {
  headless: 'headless-worker',
  worker: 'headless-worker',
  desktop: 'desktop-companion',
  mobile: 'mobile-companion',
  browser: 'browser-companion',
};

export class NodeDeviceProfileService {
  public listProfiles(): NodeMeshDeviceProfileDescriptor[] {
    return Object.values(NODE_DEVICE_PROFILES).sort((left, right) =>
      left.label.localeCompare(right.label, 'en-US'),
    );
  }

  public listRecommendedProfiles(): NodeMeshDeviceProfileDescriptor[] {
    return [
      this.describeProfile('headless-worker'),
      this.describeProfile('desktop-companion'),
      this.describeProfile('browser-companion'),
      this.describeProfile('mobile-companion'),
    ].filter(Boolean) as NodeMeshDeviceProfileDescriptor[];
  }

  public resolveProfile(
    profileId?: string | null,
    kind?: NodeMeshNodeKind | null,
  ): NodeMeshDeviceProfileDescriptor {
    const normalizedProfileId = this.normalizeProfileId(profileId);
    if (normalizedProfileId && NODE_DEVICE_PROFILES[normalizedProfileId]) {
      return NODE_DEVICE_PROFILES[normalizedProfileId];
    }

    switch (String(kind || '').trim().toLowerCase()) {
      case 'desktop':
        return NODE_DEVICE_PROFILES['desktop-companion'];
      case 'mobile':
        return NODE_DEVICE_PROFILES['mobile-companion'];
      case 'browser':
        return NODE_DEVICE_PROFILES['browser-companion'];
      default:
        return NODE_DEVICE_PROFILES['headless-worker'];
    }
  }

  public describeProfile(profileId?: string | null): NodeMeshDeviceProfileDescriptor | null {
    const normalizedProfileId = this.normalizeProfileId(profileId);
    return normalizedProfileId && NODE_DEVICE_PROFILES[normalizedProfileId]
      ? NODE_DEVICE_PROFILES[normalizedProfileId]
      : null;
  }

  public normalizeProfileId(profileId?: string | null): NodeMeshDeviceProfileId | null {
    const normalizedProfileId = String(profileId || '').trim().toLowerCase();
    if (!normalizedProfileId) {
      return null;
    }

    return NODE_DEVICE_PROFILE_ALIASES[normalizedProfileId] || normalizedProfileId;
  }
}
