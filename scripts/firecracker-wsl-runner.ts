import fs from 'fs';
import { FirecrackerSandboxRuntime } from '../src/services/sandbox/FirecrackerSandboxRuntime.js';
import { asErrorLike } from '../src/utils/errorLike';

type StatusPayload = {
  mode: 'status';
};

type ExecutePayload = {
  mode: 'execute';
  inputPath: string;
};

type BridgePayload = StatusPayload | ExecutePayload;

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parsePayload(): BridgePayload {
  const encoded = process.argv[2];
  if (!encoded) {
    fail('Firecracker WSL runner requer um payload base64.');
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as BridgePayload;
  } catch (error: unknown) {
    const err = asErrorLike(error);

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

main().catch((error: unknown) => {
  fail(error?.message || String(error));
});
