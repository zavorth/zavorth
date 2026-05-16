import { ZavorthProductDemoService } from '../src/services/ZavorthProductDemoService.js';
import { spawn } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const doctor = args.includes('--doctor') || args[0] === 'doctor' || args[0] === 'check';
const browser = args.includes('browser') || args.includes('--browser');
const start = args.includes('start') || args.includes('--start');
const service = new ZavorthProductDemoService();
const snapshot = service.buildSnapshot();

if (asJson) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else if (browser) {
  const target = path.resolve(process.cwd(), snapshot.visualHome.browserDemoPath);
  process.stdout.write([
    'Zavorth Browser Demo',
    `file: ${target}`,
    `open: ${snapshot.visualHome.browserDemoCommand}`,
    'This demo is local-only and does not require connector secrets.',
    '',
  ].join('\n'));
  if (!args.includes('--no-open')) {
    openLocalTarget(target);
  }
} else if (doctor) {
  process.stdout.write(service.renderDoctor(snapshot));
} else if (start) {
  process.stdout.write([
    'Zavorth Start',
    'One command path: setup preview, Home, optional browser demo and connector doctor.',
    '',
    service.renderText(snapshot),
    'Run next:',
    '- zavorth setup --dry-run',
    '- zavorth go',
    '- zavorth connectors doctor',
    '- zavorth demo browser',
    '',
  ].join('\n'));
} else {
  process.stdout.write(service.renderText(snapshot));
}

function openLocalTarget(target: string): void {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/d', '/s', '/c', 'start', '', target], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return;
  }
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(command, [target], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}
