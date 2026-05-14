import type { NodeMeshCapabilityId } from '../../../../contracts/NodeMeshContract.js';

export const NODE_HOST_SUPPORTED_CAPABILITY_IDS: NodeMeshCapabilityId[] = [
  'system.run',
  'node.maintenance',
  'browser.proxy',
  'device.info',
  'files.read',
  'files.write',
  'files.watch',
  'screen.capture',
  'camera.capture',
  'location.read',
  'device.confirm',
  'haptics.vibrate',
  'clipboard.read',
  'clipboard.write',
  'notifications.send',
];
