import readline from 'readline';
import { FirecrackerSandboxRuntime } from '../dist/services/sandbox/FirecrackerSandboxRuntime.js';

const runtime = new FirecrackerSandboxRuntime();

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handleRequest(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload ausente ou invalido.');
  }

  if (payload.mode === 'status') {
    return { status: runtime.getStatus() };
  }

  if (payload.mode === 'execute') {
    return { result: await runtime.execute(payload.request) };
  }

  throw new Error(`Modo desconhecido: ${String(payload.mode || '')}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

send({ event: 'ready' });

rl.on('line', async (line) => {
  const trimmed = String(line || '').trim();
  if (!trimmed) {
    return;
  }

  let envelope;
  try {
    envelope = JSON.parse(trimmed);
  } catch (error) {
    send({
      id: null,
      ok: false,
      error: `JSON invalido: ${error.message}`,
    });
    return;
  }

  const requestId = typeof envelope.id === 'string' ? envelope.id : null;

  try {
    const data = await handleRequest(envelope.payload);
    send({
      id: requestId,
      ok: true,
      data,
    });
  } catch (error) {
    send({
      id: requestId,
      ok: false,
      error: String(error?.message || error),
    });
  }
});

rl.on('close', () => {
  process.exit(0);
});
