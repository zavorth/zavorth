#!/usr/bin/env node

const { ChannelProviderDoctorService } = await import('../dist/services/ChannelProviderDoctorService.js');

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const localOnly = argv.includes('--local-only');
  const service = new ChannelProviderDoctorService();
  const report = await service.run({ localOnly });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log('[channels] doctor');
  console.log(`[channels] resumo: ${report.summary}`);
  console.log(`[channels] status: ${report.status}`);
  for (const item of report.items) {
    console.log(
      `[channels] ${item.channelId}: ${item.status} | mode=${item.mode} | configured=${item.configured ? 'sim' : 'nao'} | ${item.summary}`,
    );
    if (item.error) {
      console.log(`[channels] ${item.channelId} erro: ${item.error}`);
    }
    if (item.details.length > 0) {
      for (const detail of item.details) {
        console.log(`- ${detail}`);
      }
    }
  }

  if (report.status === 'failed') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[channels] doctor falhou: ${error.message || error}`);
  process.exitCode = 1;
});
