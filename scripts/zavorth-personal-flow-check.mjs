import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

for (const file of [
  'assets/zavorthControl/index.html',
  'assets/zavorthControl/scripts/app.js',
  'assets/zavorthControl/styles/chat.css',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const html = readFileSync(path.join(root, 'assets/zavorthControl/index.html'), 'utf8');
const app = readFileSync(path.join(root, 'assets/zavorthControl/scripts/app.js'), 'utf8');
const css = readFileSync(path.join(root, 'assets/zavorthControl/styles/chat.css'), 'utf8');

for (const marker of [
  'data-profile="personal"',
  'data-mission="organize-day"',
  'data-auto-submit="true"',
  'Organize my day safely. Start read-only and tell me what needs approval.',
]) {
  if (!html.includes(marker)) {
    throw new Error(`personal flow html marker missing: ${marker}`);
  }
}

for (const marker of [
  'selectedExperienceProfile',
  'pendingGuidedFlow',
  'setSelectedExperienceProfile',
  'shouldHandlePersonalDayFlow',
  'renderPersonalDayFlow',
  'buildPersonalDayFlowCards',
  'No approval is needed for planning only.',
  'Approval is required before creating reminders, sending messages, editing calendars, changing files or using external apps.',
  'Daily plan generated without external changes.',
]) {
  if (!app.includes(marker)) {
    throw new Error(`personal flow app marker missing: ${marker}`);
  }
}

for (const marker of [
  '.home-profile-card.is-selected',
  '.personal-flow-grid',
  '.personal-flow-card',
  '.personal-flow-receipt',
  '.personal-flow-steps',
]) {
  if (!css.includes(marker)) {
    throw new Error(`personal flow style marker missing: ${marker}`);
  }
}

console.log('[zavorth-personal-flow-check] ok');
