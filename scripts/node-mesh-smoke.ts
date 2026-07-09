import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../src/config/index.js';
import { ZavorthControlService } from '../src/services/ZavorthControlService.js';
import { runNodeMeshHost } from './node-mesh-host.js';
import { asErrorLike } from '../src/utils/errorLike';

type ConfigSnapshot = {
  zavorthWebHost: string;
  zavorthWebPort: number;
  zavorthWebAuthToken: string;
  zavorthControlRuntimeStateFile: string;
  nodeMeshStateFile: string;
  nodeMeshSecretsFile: string;
  nodeMeshInvocationFile: string;
  dbEncryptionKeyFile: string;
  nodeMeshHeartbeatIntervalMs: number;
  nodeMeshHeartbeatStaleMs: number;
};

type JsonRecord = Record<string, any>;
export type NodeMeshSmokeStatus = 'running' | 'passed' | 'failed';
export type NodeMeshSmokeReport = {
  startedAt: string;
  finishedAt: string | null;
  status: NodeMeshSmokeStatus;
  ok: boolean;
  command: string;
  summary: string;
  nodeId: string | null;
  baseUrl: string | null;
  runStdout: string | null;
  outputFile: string | null;
  finalNodeStatus: string | null;
  recentCapabilityId: string | null;
  error: string | null;
  artifactsRoot: string | null;
  artifactsPreserved: boolean;
};
export type NodeMeshSmokeOptions = {
  keepArtifacts?: boolean;
};

const SMOKE_TOKEN = 'node-mesh-smoke-token';
const RUN_MARKER = 'NODE_MESH_SMOKE_OK';
const WRITE_MARKER = `NODE_MESH_WRITE_OK ${new Date().toISOString()}`;
const WATCH_MARKER = `NODE_MESH_WATCH_OK ${new Date().toISOString()}`;
const LOCATION_LABEL = 'Restaurante Smoke';
const WRITE_RELATIVE_PATH = path.join('artifacts', 'node-mesh-smoke.txt');
const WATCH_RELATIVE_PATH = path.dirname(WRITE_RELATIVE_PATH);
const CAMERA_SOURCE_RELATIVE_PATH = path.join('artifacts', 'mobile-camera-source.png');
const CAMERA_OUTPUT_RELATIVE_PATH = path.join('artifacts', 'mobile-camera-output.png');
const PAIR_WAIT_MS = 20_000;
const HEADLESS_INVOCATION_WAIT_MS = 60_000;
const MOBILE_INVOCATION_WAIT_MS = 40_000;
const WATCH_TRIGGER_DELAY_MS = 12_000;
const WATCH_TIMEOUT_MS = 18_000;

export async function runNodeMeshSmoke(options: NodeMeshSmokeOptions = {}): Promise<NodeMeshSmokeReport> {
  const keepArtifacts = Boolean(options.keepArtifacts);
  const smokeRoot = fs.mkdtempSync(path.join(resolveTmpRoot(), 'node-mesh-smoke-'));
  const workspaceRoot = path.join(smokeRoot, 'workspace');
  const runtimeRoot = path.join(smokeRoot, 'runtime');
  const hostStateFile = path.join(runtimeRoot, 'node-host-state.json');
  const targetFile = path.join(workspaceRoot, WRITE_RELATIVE_PATH);
  const startedAt = new Date().toISOString();
  fs.mkdirSync(workspaceRoot, { recursive: true });
  fs.mkdirSync(runtimeRoot, { recursive: true });

  const previousConfig = snapshotConfig();
  const logRepo = {
    log: () => undefined,
    getRecentLogs: () => [],
  } as any;

  let preservedArtifacts = keepArtifacts;
  let hostAbort: AbortController | null = null;
  let hostPromise: Promise<void> | null = null;
  let zavorthControl: ZavorthControlService | null = null;
  let nodeId: string | null = null;
  let baseUrl: string | null = null;
  let runStdout: string | null = null;
  let finalNodeStatus: string | null = null;
  let recentCapabilityId: string | null = null;

  writeSmokeReport({
    startedAt,
    finishedAt: null,
    status: 'running',
    ok: false,
    command: buildSmokeCommand(),
    summary: 'Smoke do Node Mesh em andamento.',
    nodeId: null,
    baseUrl: null,
    runStdout: null,
    outputFile: null,
    finalNodeStatus: null,
    recentCapabilityId: null,
    error: null,
    artifactsRoot: smokeRoot,
    artifactsPreserved: preservedArtifacts,
  });

  try {
    applySmokeConfig(smokeRoot);
    zavorthControl = new ZavorthControlService(logRepo);
    baseUrl = await zavorthControl.start();

    console.log(`[node-mesh-smoke] zavorthControl online em ${baseUrl}`);

    const draftResponse = await postJson(
      `${baseUrl}/api/web/nodes/pairing-draft`,
      {
        profileId: 'headless-worker',
        label: 'Node Mesh Smoke',
        requestedBy: 'node-mesh-smoke',
      },
      SMOKE_TOKEN,
    );
    const draft = draftResponse.draft;
    nodeId = String(draft?.entry?.id || '').trim();
    const pairingCode = String(draft?.pairingCode || '').trim();
    if (!nodeId || !pairingCode) {
      throw new Error('O pairing draft nao retornou nodeId/pairingCode validos.');
    }
    const selectedNodeId = nodeId;

    console.log(`[node-mesh-smoke] pairing draft criado para ${nodeId}`);

    hostAbort = new AbortController();
    hostPromise = runNodeMeshHost({
      baseUrl,
      token: SMOKE_TOKEN,
      nodeId,
      pairingCode,
      sharedSecret: null,
      capabilities: ['device.info', 'system.run', 'files.read', 'files.write', 'files.watch', 'browser.proxy'],
      intervalMs: 3000,
      once: false,
      workspace: workspaceRoot,
      surface: 'node-host',
      hostname: os.hostname(),
      label: 'Node Mesh Smoke',
      stateFile: hostStateFile,
      abortSignal: hostAbort.signal,
    });

    const pairedSnapshot = await waitFor(async () => {
      const response = await getJson(
        `${baseUrl}/api/web/nodes?selectedId=${encodeURIComponent(selectedNodeId)}`,
        SMOKE_TOKEN,
      );
      const selected = response?.nodeMesh?.selected || null;
      if (selected?.paired && selected?.pairingStatus === 'paired' && selected?.status === 'online') {
        return response;
      }
      return null;
    }, PAIR_WAIT_MS, 250);

    console.log(
      `[node-mesh-smoke] node pareado: ${pairedSnapshot.nodeMesh.selected.id} (${pairedSnapshot.nodeMesh.selected.status})`,
    );

    await postJson(
      `${baseUrl}/api/web/nodes/invoke`,
      {
        nodeId,
        capabilityId: 'device.info',
        action: 'describe',
        payload: {},
        requestedBy: 'node-mesh-smoke',
      },
      SMOKE_TOKEN,
    );

    await postJson(
      `${baseUrl}/api/web/nodes/invoke`,
      {
        nodeId,
        capabilityId: 'system.run',
        action: 'run',
        payload: {
          command: `echo ${RUN_MARKER}`,
        },
        requestedBy: 'node-mesh-smoke',
      },
      SMOKE_TOKEN,
    );

    await postJson(
      `${baseUrl}/api/web/nodes/invoke`,
      {
        nodeId,
        capabilityId: 'files.write',
        action: 'write',
        payload: {
          path: WRITE_RELATIVE_PATH,
          content: `${WRITE_MARKER}\n`,
          mode: 'create',
        },
        requestedBy: 'node-mesh-smoke',
      },
      SMOKE_TOKEN,
    );

    await postJson(
      `${baseUrl}/api/web/nodes/invoke`,
      {
        nodeId,
        capabilityId: 'browser.proxy',
        action: 'open',
        payload: {
          proxyUrl: 'http://127.0.0.1:9222/devtools/browser/smoke',
          url: 'https://example.com/app',
        },
        requestedBy: 'node-mesh-smoke',
      },
      SMOKE_TOKEN,
    );

    const watchResponse = await postJson(
      `${baseUrl}/api/web/nodes/invoke`,
      {
        nodeId,
        capabilityId: 'files.watch',
        action: 'watch',
        payload: {
          path: WATCH_RELATIVE_PATH,
          timeoutMs: WATCH_TIMEOUT_MS,
        },
        requestedBy: 'node-mesh-smoke',
      },
      SMOKE_TOKEN,
    );

    const watchInvocationId = String(watchResponse?.invocation?.id || watchResponse?.id || '').trim();
    if (watchInvocationId) {
      appendMarkerWhenWatchActive(config.nodeMeshInvocationFile, watchInvocationId, targetFile, WATCH_TIMEOUT_MS + 45_000);
    } else {
      scheduleWatchMarker(targetFile, WATCH_TRIGGER_DELAY_MS, WATCH_TIMEOUT_MS + 15_000);
    }

    console.log('[node-mesh-smoke] invocacoes device.info, system.run, files.write, browser.proxy e files.watch enfileiradas');

    const invocations = await waitFor(async () => {
      const state = readJsonFile<JsonRecord>(config.nodeMeshInvocationFile, { entries: {} });
      const entries = Object.values(state.entries || {}) as JsonRecord[];
      const completed = entries.filter((entry) =>
        String(entry.nodeId || '').trim() === nodeId && ['completed', 'failed'].includes(String(entry.status || '').trim()),
      );
      return completed.length >= 5 ? completed : null;
    }, HEADLESS_INVOCATION_WAIT_MS, 300);

    if (!hostPromise) {
      throw new Error('O node host do smoke nao foi iniciado.');
    }
    hostAbort?.abort();
    await waitForHostPromise(hostPromise, 10000);
    hostAbort = null;
    hostPromise = null;

    const infoInvocation = invocations.find((entry) => entry.capabilityId === 'device.info');
    const runInvocation = invocations.find((entry) => entry.capabilityId === 'system.run');
    const writeInvocation = invocations.find((entry) => entry.capabilityId === 'files.write');
    if (!infoInvocation || !runInvocation || !writeInvocation) {
      throw new Error('Nem todas as invocacoes apareceram como concluidas no estado do Node Mesh.');
    }
    if (infoInvocation.status !== 'completed' || String(infoInvocation.output?.data?.platform || '').trim() !== process.platform) {
      throw new Error('device.info nao retornou a identidade esperada no smoke real.');
    }
    if (runInvocation.status !== 'completed' || !String(runInvocation.output?.stdout || '').includes(RUN_MARKER)) {
      throw new Error('system.run nao retornou o marcador esperado no smoke real.');
    }
    runStdout = String(runInvocation.output?.stdout || '').trim() || null;
    const browserInvocation = invocations.find((entry) => entry.capabilityId === 'browser.proxy');
    const watchInvocation = invocations.find((entry) => entry.capabilityId === 'files.watch');
    if (writeInvocation.status !== 'completed') {
      throw new Error(`files.write nao concluiu com sucesso: ${writeInvocation.resultSummary || 'sem detalhe'}`);
    }
    if (!browserInvocation || browserInvocation.status !== 'completed') {
      throw new Error('browser.proxy nao concluiu com sucesso no smoke real.');
    }
    if (String(browserInvocation.output?.stdout || '').trim() !== 'http://127.0.0.1:9222/devtools/browser/smoke') {
      throw new Error('browser.proxy nao devolveu o endpoint esperado no smoke real.');
    }
    if (!watchInvocation || watchInvocation.status !== 'completed') {
      throw new Error('files.watch nao concluiu com sucesso no smoke real.');
    }
    if (!Array.isArray(watchInvocation.output?.data?.changes) || watchInvocation.output.data.changes.length === 0) {
      throw new Error('files.watch nao registrou nenhuma mudanca observada.');
    }
    if (!fs.existsSync(targetFile)) {
      throw new Error(`O arquivo esperado nao foi criado pelo node host: ${targetFile}`);
    }

    const writtenContent = fs.readFileSync(targetFile, 'utf8');
    if (!writtenContent.includes(WRITE_MARKER) || !writtenContent.includes(WATCH_MARKER)) {
      throw new Error('O conteudo gravado/observado pelo node host nao contem os marcadores esperados.');
    }

    hostAbort = null;
    hostPromise = null;

    const mobileDraftResponse = await postJson(
      `${baseUrl}/api/web/nodes/pairing-draft`,
      {
        profileId: 'mobile-companion',
        label: 'Node Mesh Mobile Smoke',
        requestedBy: 'node-mesh-smoke',
      },
      SMOKE_TOKEN,
    );
    const mobileDraft = mobileDraftResponse.draft;
    const mobileNodeId = String(mobileDraft?.entry?.id || '').trim();
    const mobilePairingCode = String(mobileDraft?.pairingCode || '').trim();
    if (!mobileNodeId || !mobilePairingCode) {
      throw new Error('O pairing draft mobile nao retornou nodeId/pairingCode validos.');
    }

    const cameraSourcePath = path.join(workspaceRoot, CAMERA_SOURCE_RELATIVE_PATH);
    const cameraOutputPath = path.join(workspaceRoot, CAMERA_OUTPUT_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(cameraSourcePath), { recursive: true });
    fs.writeFileSync(cameraSourcePath, 'fake-mobile-camera', 'utf8');

    hostAbort = new AbortController();
    hostPromise = runNodeMeshHost({
      baseUrl,
      token: SMOKE_TOKEN,
      nodeId: mobileNodeId,
      pairingCode: mobilePairingCode,
      sharedSecret: null,
      capabilities: ['device.info', 'camera.capture', 'location.read', 'notifications.send'],
      intervalMs: 3000,
      once: true,
      workspace: workspaceRoot,
      surface: 'mobile',
      hostname: os.hostname(),
      label: 'Node Mesh Mobile Smoke',
      deviceModel: 'Smoke Phone',
      networkType: 'wifi',
      locationLabel: LOCATION_LABEL,
      stateFile: path.join(runtimeRoot, 'node-host-mobile-state.json'),
      abortSignal: hostAbort.signal,
    });

    await waitFor(async () => {
      const response = await getJson(
        `${baseUrl}/api/web/nodes?selectedId=${encodeURIComponent(mobileNodeId)}`,
        SMOKE_TOKEN,
      );
      const selected = response?.nodeMesh?.selected || null;
      if (selected?.paired && selected?.pairingStatus === 'paired' && selected?.status === 'online') {
        return response;
      }
      return null;
    }, PAIR_WAIT_MS, 250);

    await postJson(
      `${baseUrl}/api/web/nodes/invoke`,
      {
        nodeId: mobileNodeId,
        capabilityId: 'device.info',
        action: 'describe',
        payload: {},
        requestedBy: 'node-mesh-smoke',
      },
      SMOKE_TOKEN,
    );
    await postJson(
      `${baseUrl}/api/web/nodes/invoke`,
      {
        nodeId: mobileNodeId,
        capabilityId: 'location.read',
        action: 'locate',
        payload: {
          latitude: -23.561414,
          longitude: -46.655881,
          label: LOCATION_LABEL,
          accuracyMeters: 18,
        },
        requestedBy: 'node-mesh-smoke',
      },
      SMOKE_TOKEN,
    );
    await postJson(
      `${baseUrl}/api/web/nodes/invoke`,
      {
        nodeId: mobileNodeId,
        capabilityId: 'camera.capture',
        action: 'capture',
        payload: {
          sourcePath: cameraSourcePath,
          outputPath: cameraOutputPath,
        },
        requestedBy: 'node-mesh-smoke',
      },
      SMOKE_TOKEN,
    );

    const mobileInvocations = await waitFor(async () => {
      const state = readJsonFile<JsonRecord>(config.nodeMeshInvocationFile, { entries: {} });
      const entries = Object.values(state.entries || {}) as JsonRecord[];
      const completed = entries.filter((entry) =>
        String(entry.nodeId || '').trim() === mobileNodeId && ['completed', 'failed'].includes(String(entry.status || '').trim()),
      );
      return completed.length >= 3 ? completed : null;
    }, MOBILE_INVOCATION_WAIT_MS, 300);

    if (!hostPromise) {
      throw new Error('O node host mobile do smoke nao foi iniciado.');
    }
    await waitForHostPromise(hostPromise, 10000);
    hostAbort = null;
    hostPromise = null;

    const mobileInfoInvocation = mobileInvocations.find((entry) => entry.capabilityId === 'device.info');
    const mobileLocationInvocation = mobileInvocations.find((entry) => entry.capabilityId === 'location.read');
    const mobileCameraInvocation = mobileInvocations.find((entry) => entry.capabilityId === 'camera.capture');
    if (!mobileInfoInvocation || !mobileLocationInvocation || !mobileCameraInvocation) {
      throw new Error('Nem todas as invocacoes mobile apareceram como concluidas no estado do Node Mesh.');
    }
    if (mobileInfoInvocation.status !== 'completed' || String(mobileInfoInvocation.output?.data?.deviceModel || '').trim() !== 'Smoke Phone') {
      throw new Error('device.info mobile nao retornou a identidade esperada.');
    }
    if (mobileLocationInvocation.status !== 'completed' || String(mobileLocationInvocation.output?.data?.label || '').trim() !== LOCATION_LABEL) {
      throw new Error('location.read nao retornou o contexto esperado para o companion mobile.');
    }
    if (mobileCameraInvocation.status !== 'completed' || !fs.existsSync(cameraOutputPath)) {
      throw new Error('camera.capture nao produziu o artefato esperado para o companion mobile.');
    }
    if (fs.readFileSync(cameraOutputPath, 'utf8') !== 'fake-mobile-camera') {
      throw new Error('camera.capture nao preservou o artefato esperado para o companion mobile.');
    }

    nodeId = `${nodeId},${mobileNodeId}`;
    const finalSnapshot = await getJson(
      `${baseUrl}/api/web/nodes?selectedId=${encodeURIComponent(selectedNodeId)}`,
      SMOKE_TOKEN,
    );
    const finalNode = finalSnapshot?.nodeMesh?.selected || null;
    finalNodeStatus = String(finalNode?.status || '').trim() || null;
    recentCapabilityId = String(finalNode?.recentInvocation?.capabilityId || '').trim() || null;

    console.log('[node-mesh-smoke] PASSOU');
    console.log(`  node: ${nodeId}`);
    console.log(`  run stdout: ${runStdout}`);
    console.log(`  file: ${targetFile}`);
    console.log(`  mobile camera: ${cameraOutputPath}`);
    console.log(`  final status: ${String(finalNodeStatus || 'n/d')}`);
    console.log(`  recente: ${String(recentCapabilityId || 'n/d')}`);

    const report: NodeMeshSmokeReport = {
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'passed',
      ok: true,
      command: buildSmokeCommand(),
      summary: 'Smoke real do Node Mesh passou com headless worker e companion mobile pragmatica.',
      nodeId,
      baseUrl,
      runStdout,
      outputFile: targetFile,
      finalNodeStatus,
      recentCapabilityId,
      error: null,
      artifactsRoot: preservedArtifacts ? smokeRoot : null,
      artifactsPreserved: preservedArtifacts,
    };
    writeSmokeReport(report);
    return report;
  } catch (error: unknown) {
    const err = asErrorLike(error);

    preservedArtifacts = true;
    console.error(`[node-mesh-smoke] FALHOU: ${error?.message || String(error)}`);
    console.error(`[node-mesh-smoke] artefatos preservados em ${smokeRoot}`);
    const report: NodeMeshSmokeReport = {
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'failed',
      ok: false,
      command: buildSmokeCommand(),
      summary: 'Smoke real do Node Mesh falhou.',
      nodeId,
      baseUrl,
      runStdout,
      outputFile: fs.existsSync(targetFile) ? targetFile : null,
      finalNodeStatus,
      recentCapabilityId,
      error: error?.message || String(error),
      artifactsRoot: smokeRoot,
      artifactsPreserved: true,
    };
    writeSmokeReport(report);
    return report;
  } finally {
    if (hostPromise) {
      hostAbort?.abort();
      try {
        await waitForHostPromise(hostPromise, 2000);
      } catch {}
    }

    if (zavorthControl) {
      await zavorthControl.stopAsync();
    }

    restoreConfig(previousConfig);

    if (!preservedArtifacts) {
      fs.rmSync(smokeRoot, { recursive: true, force: true });
    }
  }
}

async function main(): Promise<void> {
  const keepArtifacts = process.argv.includes('--keep') || process.argv.includes('--keep-artifacts');
  const report = await runNodeMeshSmoke({ keepArtifacts });
  process.exitCode = report.ok ? 0 : 1;
}

function snapshotConfig(): ConfigSnapshot {
  return {
    zavorthWebHost: config.zavorthWebHost,
    zavorthWebPort: config.zavorthWebPort,
    zavorthWebAuthToken: config.zavorthWebAuthToken,
    zavorthControlRuntimeStateFile: config.zavorthControlRuntimeStateFile,
    nodeMeshStateFile: config.nodeMeshStateFile,
    nodeMeshSecretsFile: config.nodeMeshSecretsFile,
    nodeMeshInvocationFile: config.nodeMeshInvocationFile,
    dbEncryptionKeyFile: config.dbEncryptionKeyFile,
    nodeMeshHeartbeatIntervalMs: config.nodeMeshHeartbeatIntervalMs,
    nodeMeshHeartbeatStaleMs: config.nodeMeshHeartbeatStaleMs,
  };
}

function applySmokeConfig(smokeRoot: string): void {
  const runtimeRoot = path.join(smokeRoot, 'runtime');
  config.zavorthWebHost = '127.0.0.1';
  config.zavorthWebPort = 33400 + Math.floor(Math.random() * 800);
  config.zavorthWebAuthToken = SMOKE_TOKEN;
  config.zavorthControlRuntimeStateFile = path.join(runtimeRoot, 'zavorthControl-runtime.json');
  config.nodeMeshStateFile = path.join(runtimeRoot, 'node-mesh-state.json');
  config.nodeMeshSecretsFile = path.join(runtimeRoot, 'node-mesh-secrets.json');
  config.nodeMeshInvocationFile = path.join(runtimeRoot, 'node-mesh-invocations.json');
  config.dbEncryptionKeyFile = path.join(runtimeRoot, 'db-field.key');
  config.nodeMeshHeartbeatIntervalMs = 5000;
  config.nodeMeshHeartbeatStaleMs = 20000;
}

function restoreConfig(snapshot: ConfigSnapshot): void {
  config.zavorthWebHost = snapshot.zavorthWebHost;
  config.zavorthWebPort = snapshot.zavorthWebPort;
  config.zavorthWebAuthToken = snapshot.zavorthWebAuthToken;
  config.zavorthControlRuntimeStateFile = snapshot.zavorthControlRuntimeStateFile;
  config.nodeMeshStateFile = snapshot.nodeMeshStateFile;
  config.nodeMeshSecretsFile = snapshot.nodeMeshSecretsFile;
  config.nodeMeshInvocationFile = snapshot.nodeMeshInvocationFile;
  config.dbEncryptionKeyFile = snapshot.dbEncryptionKeyFile;
  config.nodeMeshHeartbeatIntervalMs = snapshot.nodeMeshHeartbeatIntervalMs;
  config.nodeMeshHeartbeatStaleMs = snapshot.nodeMeshHeartbeatStaleMs;
}

async function postJson(url: string, body: JsonRecord, token?: string | null): Promise<JsonRecord> {
  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(token, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Falha HTTP ${response.status} em ${url}`);
  }
  return payload;
}

async function getJson(url: string, token?: string | null): Promise<JsonRecord> {
  const response = await fetch(url, {
    headers: buildHeaders(token),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Falha HTTP ${response.status} em ${url}`);
  }
  return payload;
}

function buildHeaders(token?: string | null, extra: Record<string, string> = {}): Headers {
  const headers = new Headers(extra);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Connection', 'close');
  return headers;
}

async function waitFor<T>(
  factory: () => Promise<T | null | undefined>,
  timeoutMs: number,
  intervalMs: number,
): Promise<T> {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while ((Date.now() - startedAt) < timeoutMs) {
    try {
      const result = await factory();
      if (result) {
        return result;
      }
    } catch (error: unknown) {
      lastError = error;
    }

    await delay(intervalMs);
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error(`Timeout aguardando condicao por ${timeoutMs}ms.`);
}

async function waitForHostPromise(hostPromise: Promise<void>, timeoutMs: number): Promise<void> {
  await Promise.race([
    hostPromise,
    new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout aguardando node-mesh-host encerrar em ${timeoutMs}ms.`));
      }, timeoutMs);
    }),
  ]);
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleWatchMarker(targetFile: string, initialDelayMs: number, deadlineMs: number): void {
  const startedAt = Date.now();
  const tryAppend = () => {
    try {
      if (fs.existsSync(targetFile)) {
        fs.appendFileSync(targetFile, `${WATCH_MARKER}\n`, 'utf8');
        return;
      }
    } catch {}

    if ((Date.now() - startedAt) >= deadlineMs) {
      return;
    }
    setTimeout(tryAppend, 2_000);
  };

  setTimeout(tryAppend, initialDelayMs);
}

function appendMarkerWhenWatchActive(
  invocationFile: string,
  invocationId: string,
  targetFile: string,
  deadlineMs: number,
): void {
  const startedAt = Date.now();
  const tryAppend = () => {
    const state = readJsonFile<JsonRecord>(invocationFile, { entries: {} });
    const entry = state?.entries?.[invocationId];
    const status = String(entry?.status || '').trim().toLowerCase();
    if (status === 'claimed' || status === 'completed') {
      try {
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.appendFileSync(targetFile, `${WATCH_MARKER}\n`, 'utf8');
        return;
      } catch {}
    }

    if ((Date.now() - startedAt) >= deadlineMs) {
      return;
    }
    setTimeout(tryAppend, 1_500);
  };

  setTimeout(tryAppend, 500);
}

function resolveTmpRoot(): string {
  const repoTmp = path.resolve(config.projectRoot, 'tmp');
  try {
    fs.mkdirSync(repoTmp, { recursive: true });
    return repoTmp;
  } catch {
    return os.tmpdir();
  }
}

function buildSmokeCommand(): string {
  return process.platform === 'win32'
    ? 'npm.cmd run test:nodes:smoke'
    : 'npm run test:nodes:smoke';
}

function writeSmokeReport(report: NodeMeshSmokeReport): void {
  const reportPath = String(config.nodeMeshSmokeReportFile || '').trim();
  if (!reportPath) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } catch {}
}

const executedAsScript =
  typeof require !== 'undefined'
  && typeof module !== 'undefined'
  && require.main === module;

if (executedAsScript) {
  void main();
}
