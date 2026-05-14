import { ZavorthClient } from '../../sdk/typescript/src';

async function main() {
  const client = new ZavorthClient({
    baseUrl: process.env.ZAVORTH_BASE_URL || 'http://127.0.0.1:33333',
    token: process.env.ZAVORTH_WEB_TOKEN,
  });

  const status = await client.getGatewayStatus();
  const platform = await client.getPlatformStatus();
  const sessions = await client.listSessions({ limit: 5 });
  const learning = await client.getLearningCandidates();
  const learningMetrics = await client.getLearningMetrics();
  const procedures = await client.getMemoryProcedures();
  const memoryMetrics = await client.getMemoryMetrics();
  const quality = await client.getOpsQuality();

  console.log('[example-client] gateway:', status.status, status.version);
  console.log('[example-client] plugins:', platform.plugins.length);
  console.log('[example-client] sessions:', sessions.total);
  console.log('[example-client] learning pendente:', learning.summary.pending);
  console.log('[example-client] learning avg score:', learningMetrics.summary.averageScore);
  console.log('[example-client] procedimentos:', procedures.total);
  console.log('[example-client] memory pressure:', memoryMetrics.summary.pressure);
  console.log('[example-client] ops quality:', quality.score, quality.gate.state);
  console.log('[example-client] gate next step:', quality.gate.nextStep || 'nenhum');
}

main().catch((error) => {
  console.error('[example-client] falhou:', error);
  process.exit(1);
});
