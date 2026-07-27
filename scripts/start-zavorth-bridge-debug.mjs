import {
  buildZavorthBridgeArgs,
  formatZavorthBridgeLaunchSummary,
  launchZavorthBridgeDetached,
  resolveZavorthBridgeLaunchConfig,
} from './zavorth-bridge-launch.mjs';

const config = resolveZavorthBridgeLaunchConfig();
const args = buildZavorthBridgeArgs(config);
const dryRun = process.argv.includes('--dry-run');

if (dryRun) {
  console.log(formatZavorthBridgeLaunchSummary(config, args));
  process.exit(0);
}

const { pid } = launchZavorthBridgeDetached(config);

console.log(formatZavorthBridgeLaunchSummary(config, args, pid));
console.log('');
console.log('ZavorthBridge sent to the background in remote debugging mode.');
console.log('Depois disso, you pode subir o stack completo com: npm run start:full');
