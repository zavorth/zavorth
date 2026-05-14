import { ChannelProviderDoctorService } from '../../src/services/ChannelProviderDoctorService.js';
import { RemoteTransportDoctorService } from '../../src/services/RemoteTransportDoctorService.js';
import { BenchmarkHarness } from './Harness.js';

async function runSidecarBenchmarks() {
  const harness = new BenchmarkHarness('Transport and Sidecar Operations');
  const transportDoctor = new RemoteTransportDoctorService();
  const channelDoctor = new ChannelProviderDoctorService();
  const warningFromDoctor = (report: { status: 'passed' | 'failed' | 'skipped'; summary: string }) =>
    report.status === 'passed' ? null : report.summary;

  await harness.measure('Remote transport doctor', async () => {
    return await transportDoctor.run();
  }, {
    detail: (report) => ({
      status: report.status,
      items: report.items.length,
    }),
    warning: warningFromDoctor,
  });

  await harness.measure('Channel provider doctor', async () => {
    return await channelDoctor.run();
  }, {
    detail: (report) => ({
      status: report.status,
      items: report.items.length,
    }),
    warning: warningFromDoctor,
  });

  const reportPath = harness.writeReport('benchmark-sidecars.json');
  harness.printReport();
  console.log(`[qa] sidecar benchmark salvo em ${reportPath}`);
}

runSidecarBenchmarks().catch((error) => {
  console.error('[qa] sidecar benchmark falhou:', error);
  process.exit(1);
});
