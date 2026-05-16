import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

for (const file of [
  'assets/command-center/index.html',
  'assets/command-center/scripts/app.js',
  'assets/command-center/styles/chat.css',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const html = readFileSync(path.join(root, 'assets/command-center/index.html'), 'utf8');
const app = readFileSync(path.join(root, 'assets/command-center/scripts/app.js'), 'utf8');
const css = readFileSync(path.join(root, 'assets/command-center/styles/chat.css'), 'utf8');

for (const marker of [
  'data-profile="developer"',
  'data-mission="review-workspace"',
  'Review this workspace safely. Read first, list risks, and do not change files.',
]) {
  if (!html.includes(marker)) {
    throw new Error(`developer flow html marker missing: ${marker}`);
  }
}

for (const marker of [
  'pendingWorkspaceSelection',
  'chooseWorkspaceFolder',
  'summarizeWorkspaceSelection',
  'shouldHandleDeveloperReviewFlow',
  'renderDeveloperWorkspacePicker',
  'renderDeveloperReviewFlow',
  'Patch preview prepared',
  'Patch approval required',
  'File mutation still requires runtime safety approval.',
  'Reverse patch or git diff before mutation',
]) {
  if (!app.includes(marker)) {
    throw new Error(`developer flow app marker missing: ${marker}`);
  }
}

for (const marker of [
  '.developer-flow-grid',
  '.developer-flow-card',
  '.developer-flow-diff',
  '.developer-flow-receipt',
  '.developer-flow-actions',
]) {
  if (!css.includes(marker)) {
    throw new Error(`developer flow style marker missing: ${marker}`);
  }
}

console.log('[zavorth-developer-flow-check] ok');
