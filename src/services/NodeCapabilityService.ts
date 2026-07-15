import type { NodeMeshCapabilityDescriptor, NodeMeshCapabilityId } from '../contracts/NodeMeshContract.js';

const NODE_MESH_CAPABILITY_CATALOG: Record<string, NodeMeshCapabilityDescriptor> = {
  'system.run': {
    id: 'system.run',
    label: 'System Run',
    summary: 'Allows controlled command execution on the paired node.',
    category: 'system',
    risky: true,
    actionHint: 'Use for remote execution under zero-trust policy.',
  },
  'node.maintenance': {
    id: 'node.maintenance',
    label: 'Node Maintenance',
    summary: 'Runs operational doctor and repair on the paired node host.',
    category: 'system',
    risky: false,
    actionHint: 'Use to diagnose the host and repair local state before reinvoking the mesh.',
  },
  'browser.proxy': {
    id: 'browser.proxy',
    label: 'Browser Proxy',
    summary: 'Exposes the node browser or headless proxy for guided tasks.',
    category: 'browser',
    risky: false,
    actionHint: 'Good for remote browser automation or assisted web reading.',
  },
  'screen.capture': {
    id: 'screen.capture',
    label: 'Screen Capture',
    summary: 'Captures a remote screen or window from the node.',
    category: 'device',
    risky: false,
    actionHint: 'Use when you need visual context from the node host.',
  },
  'device.info': {
    id: 'device.info',
    label: 'Device Info',
    summary: 'Reads identity, platform, and operational metadata from the paired node.',
    category: 'device',
    risky: false,
    actionHint: 'Ideal to discover real companion context before invoking other capabilities.',
  },
  'camera.capture': {
    id: 'camera.capture',
    label: 'Camera Capture',
    summary: 'Reads the paired device camera when allowed.',
    category: 'device',
    risky: true,
    actionHint: 'Reserve for multimodal flows that need a camera.',
  },
  'notifications.send': {
    id: 'notifications.send',
    label: 'Notifications',
    summary: 'Sends local notifications through the paired node.',
    category: 'notifications',
    risky: false,
    actionHint: 'Good for operational signals and handoffs.',
  },
  'location.read': {
    id: 'location.read',
    label: 'Location Read',
    summary: 'Reads device location when explicitly allowed.',
    category: 'location',
    risky: true,
    actionHint: 'Avoid using without a clear operational reason.',
  },
  'device.confirm': {
    id: 'device.confirm',
    label: 'Device Confirm',
    summary: 'Confirms a sensitive action on the paired device with user presence or WebAuthn.',
    category: 'device',
    risky: true,
    actionHint: 'Use before camera, location, remote commands, or sensitive handoffs.',
  },
  'haptics.vibrate': {
    id: 'haptics.vibrate',
    label: 'Haptics Vibrate',
    summary: 'Triggers a haptic pulse on the companion when the surface supports vibration.',
    category: 'device',
    risky: false,
    actionHint: 'Use for short operational feedback on mobile devices.',
  },
  'files.read': {
    id: 'files.read',
    label: 'Files Read',
    summary: 'Reads files on the node within the authorized scope.',
    category: 'files',
    risky: false,
    actionHint: 'Ideal for controlled remote reads.',
  },
  'files.write': {
    id: 'files.write',
    label: 'Files Write',
    summary: 'Writes files on the node within the authorized scope.',
    category: 'files',
    risky: true,
    actionHint: 'Combine with approvals and policy before enabling.',
  },
  'files.watch': {
    id: 'files.watch',
    label: 'Files Watch',
    summary: 'Watches file or directory changes on the node for a controlled window.',
    category: 'files',
    risky: false,
    actionHint: 'Use to wait for local artifacts, logs, or checkpoints without aggressive polling.',
  },
  'clipboard.read': {
    id: 'clipboard.read',
    label: 'Clipboard Read',
    summary: 'Reads the local clipboard on the paired node.',
    category: 'device',
    risky: true,
    actionHint: 'Use only when the operator knows exactly what will be read.',
  },
  'clipboard.write': {
    id: 'clipboard.write',
    label: 'Clipboard Write',
    summary: 'Writes controlled text to the local clipboard on the paired node.',
    category: 'device',
    risky: true,
    actionHint: 'Use for short handoffs on the operator host, always with explicit text.',
  },
};

export class NodeCapabilityService {
  public listCatalog(): NodeMeshCapabilityDescriptor[] {
    return Object.values(NODE_MESH_CAPABILITY_CATALOG).sort((left, right) =>
      left.label.localeCompare(right.label, 'en-US'),
    );
  }

  public normalizeCapabilityIds(input: Array<string | null | undefined> | null | undefined): NodeMeshCapabilityId[] {
    return Array.from(new Set((input || []).map((entry) => String(entry || '').trim()).filter(Boolean))).sort(
      (left, right) => left.localeCompare(right, 'en-US'),
    );
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
        label: 'Capability not provided',
        summary: 'The node did not provide enough detail about the capability.',
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
      summary: 'Capability declared by the node itself and not yet cataloged in core.',
      category: 'misc',
      risky: /run|write|camera|clipboard|location/i.test(normalizedId),
      actionHint: 'Review the capability before using it in remote automation.',
    };
  }
}
