import { AutomaticBrowserDoctorService } from '../src/mcp/AutomaticBrowserDoctorService.js';

async function main(): Promise<void> {
  const report = await new AutomaticBrowserDoctorService().run();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
