import { startGatewayHost } from '../../src/gateway/index.js';
import { fetchJsonWithTimeout } from '../QaSupport.js';

async function run() {
  const boot = await startGatewayHost({
    ...process.env,
    TELEGRAM_BOT_TOKEN: '',
  }, {
    host: '127.0.0.1',
    port: 0,
  });

  try {
    const status = await fetchJsonWithTimeout<Record<string, any>>(`${boot.url}/api/v1/gateway/status`);
    const domains = await fetchJsonWithTimeout<Record<string, any>>(`${boot.url}/api/v1/gateway/domains`);

    if (status.status !== 200 || String(status.payload?.status || '') !== 'ready') {
    throw new Error('Gateway status did not return a valid payload.');
    }
    if (domains.status !== 200 || !domains.payload?.summary) {
    throw new Error('Gateway domains did not return a valid summary.');
    }

    console.log('[qa] gateway smoke PASS');
    console.log(`[qa] baseUrl: ${boot.url}`);
    console.log(`[qa] domains.total: ${domains.payload.summary.total}`);
  } finally {
    await boot.host.stop();
    await boot.runtime.stop();
  }
}

run().catch((error) => {
  console.error('[qa] gateway smoke FAIL:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
