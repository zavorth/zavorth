#!/usr/bin/env node

import fs from 'fs';
import net from 'net';
import path from 'path';
import { execFileSync, spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const runtimeDir = path.join(projectRoot, 'data', 'runtime');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const skipSmoke = args.has('--skip-smoke');
const leaveCold = args.has('--leave-cold');
const reportPath = path.join(runtimeDir, 'essential-maintain-last.json');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const ports = {
  host: Number.parseInt(process.env.ZAVORTH_WEB_PORT || process.env.PORT || '33333', 10),
  aiGateway: 20128,
  aiGatewayProxy: 21128,
  zavorthTerminal: 4747,
};

function quoteWindowsArg(value) {
  const normalized = String(value ?? '');
  if (!normalized) {
    return '""';
  }

  if (!/[\s"&()<>^|%!]/.test(normalized)) {
    return normalized;
  }

  const escaped = normalized.replace(/(["^&|<>()%!])/g, '^$1');
  return `"${escaped}"`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, argsList, cwd = projectRoot) {
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec || 'cmd.exe',
          ['/d', '/s', '/c', [command, ...argsList].map(quoteWindowsArg).join(' ')],
          {
            cwd,
            stdio: 'inherit',
            shell: false,
          },
        )
      : spawnSync(command, argsList, {
          cwd,
          stdio: 'inherit',
          shell: false,
        });
  if (result.status !== 0) {
    if (result.error) {
      throw result.error;
    }
    throw new Error(`${command} ${argsList.join(' ')} failed with status ${result.status}`);
  }
}

function capture(command, argsList, cwd = projectRoot) {
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec || 'cmd.exe',
          ['/d', '/s', '/c', [command, ...argsList].map(quoteWindowsArg).join(' ')],
          {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
            encoding: 'utf8',
          },
        )
      : spawnSync(command, argsList, {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          encoding: 'utf8',
        });
  if (result.status !== 0) {
    return '';
  }
  return String(result.stdout || '').trim();
}

function readLockPid(relativePath) {
  try {
    const absolute = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolute)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    const pid = Number(parsed?.pid);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isPidAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

function isPortListening(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    let settled = false;
    const finalize = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(1000);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));
  });
}

function getListeningPidWindows(port) {
  const output = capture('netstat', ['-ano', '-p', 'tcp']);
  if (!output) {
    return null;
  }

  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes(`:${port}`) || !/\bLISTENING\b/i.test(line)) {
      continue;
    }

    const parts = line.trim().split(/\s+/);
    const pid = Number(parts[parts.length - 1]);
    if (Number.isFinite(pid) && pid > 0) {
      return pid;
    }
  }

  return null;
}

function getListeningPid(port) {
  if (process.platform === 'win32') {
    return getListeningPidWindows(port);
  }

  const output = capture('bash', ['-lc', `lsof -ti tcp:${port} -sTCP:LISTEN | head -n 1`]);
  const pid = Number(output);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function killPid(pid) {
  if (!pid) {
    return;
  }

  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } catch (error) {
      if (!isPidAlive(pid)) {
        return;
      }
      throw error;
    }
    return;
  }

  process.kill(pid, 'SIGTERM');
}

async function waitForPortState(port, shouldBeListening, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const listening = await isPortListening(port);
    if (listening === shouldBeListening) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

function spawnDetached(command, argsList, cwd, env = process.env) {
  const child =
    process.platform === 'win32'
      ? spawn(
          process.env.ComSpec || 'cmd.exe',
          ['/d', '/s', '/c', [command, ...argsList].map(quoteWindowsArg).join(' ')],
          {
            cwd,
            env,
            stdio: 'ignore',
            shell: false,
            detached: true,
          },
        )
      : spawn(command, argsList, {
          cwd,
          env,
          stdio: 'ignore',
          shell: false,
          detached: true,
        });
  child.unref();
  return child.pid ?? null;
}

function getCurrentState() {
  const hostLockPid = readLockPid(path.join('data', 'runtime', 'host-supervisor.lock.json'));
  const telegramLockPid = readLockPid(path.join('data', 'runtime', 'telegram-bot.lock.json'));
  const remoteKeepalivePid = readLockPid(path.join('data', 'runtime', 'ops-remote-keepalive.lock.json'));
  const zavorthCorePid = getListeningPid(ports.host);
  const aiGatewayPid = getListeningPid(ports.aiGateway);
  const aiGatewayProxyPid = getListeningPid(ports.aiGatewayProxy);
  const zavorthTerminalPid = getListeningPid(ports.zavorthTerminal);

  return {
    host: {
      pid: hostLockPid,
      alive: isPidAlive(hostLockPid),
    },
    zavorthCore: {
      pid: zavorthCorePid,
      alive: Boolean(zavorthCorePid),
    },
    telegram: {
      pid: telegramLockPid,
      alive: isPidAlive(telegramLockPid),
    },
    remoteKeepalive: {
      pid: remoteKeepalivePid,
      alive: isPidAlive(remoteKeepalivePid),
    },
    aiGateway: {
      pid: aiGatewayPid,
      alive: Boolean(aiGatewayPid),
    },
    aiGatewayProxy: {
      pid: aiGatewayProxyPid,
      alive: Boolean(aiGatewayProxyPid),
    },
    zavorthTerminal: {
      pid: zavorthTerminalPid,
      alive: Boolean(zavorthTerminalPid),
    },
  };
}

async function main() {
  fs.mkdirSync(runtimeDir, { recursive: true });
  const before = getCurrentState();
  const report = {
    startedAt: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'apply',
    before,
    actions: [],
    after: null,
  };

  console.log('===========================================');
  console.log('  Zavorth Essential Maintenance');
  console.log('===========================================');
  console.log(dryRun ? 'Modo: simulacao' : 'Modo: aplicar manutencao');
  if (leaveCold) {
    console.log('Perfil: cold mode (nao reinicia sidecars externos apos o trim)');
  }
  console.log('');

  if (dryRun) {
    console.log(JSON.stringify(before, null, 2));
    console.log('');
    console.log(
      `Passos previstos: backup -> parada controlada -> trim -> ${
        leaveCold ? 'sem restart' : 'restart'
      } -> smoke.`,
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    return;
  }

  run(npmCommand, ['run', 'essential:backup']);
  report.actions.push('backup');

  if (before.remoteKeepalive.alive) {
    console.log(`[maintain] encerrando ops remote keepalive PID ${before.remoteKeepalive.pid}`);
    killPid(before.remoteKeepalive.pid);
    await sleep(3000);
    report.actions.push(`ops-remote-keepalive-stopped:${before.remoteKeepalive.pid}`);
  }

  if (before.host.alive) {
    console.log(`[maintain] encerrando host supervisor PID ${before.host.pid}`);
    killPid(before.host.pid);
    await waitForPortState(ports.host, false, 15000);
    report.actions.push(`host-stopped:${before.host.pid}`);
  }

  if (before.zavorthCore.alive && before.zavorthCore.pid !== before.host.pid) {
    console.log(`[maintain] encerrando runtime Zavorth PID ${before.zavorthCore.pid}`);
    killPid(before.zavorthCore.pid);
    await waitForPortState(ports.host, false, 15000);
    report.actions.push(`zavorth-core-stopped:${before.zavorthCore.pid}`);
  }

  if (before.aiGatewayProxy.alive) {
    console.log(`[maintain] encerrando AI Gateway proxy PID ${before.aiGatewayProxy.pid}`);
    killPid(before.aiGatewayProxy.pid);
    await waitForPortState(ports.aiGatewayProxy, false, 20000);
    report.actions.push(`zavorth-control-proxy-stopped:${before.aiGatewayProxy.pid}`);
  }

  if (before.aiGateway.alive) {
    console.log(`[maintain] encerrando AI Gateway PID ${before.aiGateway.pid}`);
    killPid(before.aiGateway.pid);
    await waitForPortState(ports.aiGateway, false, 20000);
    report.actions.push(`zavorth-control-stopped:${before.aiGateway.pid}`);
  }

  if (before.zavorthTerminal.alive) {
    console.log(`[maintain] encerrando Zavorth Terminal PID ${before.zavorthTerminal.pid}`);
    killPid(before.zavorthTerminal.pid);
    await waitForPortState(ports.zavorthTerminal, false, 15000);
    report.actions.push(`zavorth-terminal-stopped:${before.zavorthTerminal.pid}`);
  }

  run(npmCommand, ['run', 'essential:trim']);
  report.actions.push('trim');

  if (before.host.alive && !leaveCold) {
    console.log('[maintain] reiniciando stack completa via start:full');
    spawnDetached(process.execPath, [path.join(projectRoot, 'scripts', 'start-full.mjs')], projectRoot);
    await waitForPortState(ports.aiGateway, true, 240000);
    report.actions.push('host-restarted');
    if (before.remoteKeepalive.alive) {
      console.log('[maintain] reiniciando ops remote keepalive');
      spawnDetached(npmCommand, ['run', 'ops:remote:keepalive'], projectRoot);
      report.actions.push('ops-remote-keepalive-restarted');
    }
  } else if (!leaveCold) {
    if (before.remoteKeepalive.alive) {
      console.log('[maintain] reiniciando ops remote keepalive');
      spawnDetached(npmCommand, ['run', 'ops:remote:keepalive'], projectRoot);
      report.actions.push('ops-remote-keepalive-restarted');
    }

    if (before.aiGatewayProxy.alive && !before.remoteKeepalive.alive) {
      console.log('[maintain] reiniciando AI Gateway proxy');
      spawnDetached(process.execPath, [path.join(projectRoot, 'scripts', 'start-ai-gateway-runtime.mjs')], projectRoot);
      await waitForPortState(ports.aiGatewayProxy, true, 120000);
      report.actions.push('zavorth-control-proxy-restarted');
    }

    if (before.aiGateway.alive) {
      console.log('[maintain] reiniciando AI Gateway');
      spawnDetached(npmCommand, ['run', 'dev'], path.join(projectRoot, 'src', 'zavorth-control'), {
        ...process.env,
        PORT: String(ports.aiGateway),
      });
      await waitForPortState(ports.aiGateway, true, 240000);
      report.actions.push('zavorth-control-restarted');
    }

    if (before.zavorthTerminal.alive) {
      console.log('[maintain] reiniciando Zavorth Terminal');
      spawnDetached(
        npmCommand,
        ['run', 'dev'],
        path.join(projectRoot, 'apps', 'zavorth-terminal'),
        {
          ...process.env,
          PORT: String(ports.zavorthTerminal),
          APP_PASSWORD: process.env.ZAVORTH_BRIDGE_REMOTE_APP_PASSWORD || '',
        },
      );
      await waitForPortState(ports.zavorthTerminal, true, 120000);
      report.actions.push('zavorth-terminal-restarted');
    }
  }

  if (!skipSmoke) {
    run(npmCommand, ['run', 'test:smoke']);
    report.actions.push('smoke');
  }

  report.after = getCurrentState();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('');
  console.log(`Relatorio: ${reportPath}`);
}

await main();
