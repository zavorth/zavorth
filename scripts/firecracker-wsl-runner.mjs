import fs from 'fs';
import { FirecrackerSandboxRuntime } from '../dist/services/sandbox/FirecrackerSandboxRuntime.js';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parsePayload() {
  const encoded = process.argv[2];
  if (!encoded) {
    fail('Firecracker WSL runner requer um payload base64.');
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch (error) {
    fail(`Payload invalid: ${error.message}`);
  }
}

async function main() {
  const payload = parsePayload();
  const runtime = new FirecrackerSandboxRuntime();

  if (payload.mode === 'status') {
    process.stdout.write(JSON.stringify({ status: runtime.getStatus() }));
    return;
  }

  if (!payload.inputPath) {
    fail('Execution payload without inputPath.');
  }

  const raw = fs.readFileSync(payload.inputPath, 'utf8');
  const request = JSON.parse(raw);
  const result = await runtime.execute(request);
  process.stdout.write(JSON.stringify({ result }));
}

main().catch((error) => {
  fail(error?.message || String(error));
});
