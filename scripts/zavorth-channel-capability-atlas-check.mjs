#!/usr/bin/env node
import { execSync } from 'node:child_process';

const raw = execSync('npx tsx scripts/zavorth-channel-capability-atlas.ts --json', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
const snapshot = JSON.parse(raw);
const channels = new Map((snapshot.channels || []).map((channel) => [channel.id, channel]));
const serialized = JSON.stringify(snapshot);

assert(snapshot.surface === 'channel-capability-atlas', 'channel atlas surface is exposed');
assert(snapshot.status === 'ready', 'channel atlas is ready');
assert(snapshot.summary.total >= 30, 'channel atlas includes core and long-tail channels');
assert(snapshot.summary.coreNative >= 9, 'core native channels are counted');
assert(snapshot.summary.nativeConfigurable >= 25, 'long-tail native configurable channels are counted');
assert(snapshot.summary.doctorAvailable === snapshot.summary.total, 'every channel has a doctor command');
assert(snapshot.summary.liveSmokeAvailable >= 25, 'long-tail channels expose live smoke commands');
assert(channels.get('telegram')?.level === 'core-native', 'telegram is core native');
assert(channels.get('feishu')?.level === 'native-configurable', 'feishu is native configurable');
assert(!channels.has('runtime-adapter-gateway'), 'removed optional gateway is not exposed in channel atlas');
assert(String(snapshot.llmContextBlock || '').includes('Core and long-tail channels are Zavorth-native'), 'native channel language is present');
assert(!/external dependency required|delegated by default/i.test(serialized), 'external dependency confusion is not serialized');

console.log(`[zavorth-channel-capability-atlas] passed channels=${snapshot.summary.total} native_configurable=${snapshot.summary.nativeConfigurable}`);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
