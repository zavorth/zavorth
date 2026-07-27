/**
 * Zavorth-governed scaffold guidance for the create/test apps loop.
 * Hints are copyable — never auto-executed.
 */

export type VibeScaffoldStep = {
  id: string;
  title: string;
  command: string;
  note?: string;
};

export type VibeScaffoldHint = {
  id: string;
  title: string;
  description: string;
  steps: VibeScaffoldStep[];
};

export const DEFAULT_PREVIEW_URL = 'http://localhost:5173';

export const VIBE_SCAFFOLD_HINTS: VibeScaffoldHint[] = [
  {
    id: 'vite-react',
    title: 'Vite + React app',
    description: 'Scaffold a local frontend, install deps, and open a governed preview on localhost.',
    steps: [
      {
        id: 'create',
        title: 'Create project',
        command: 'npm create vite@latest my-app -- --template react-ts',
        note: 'Pick a folder name that fits your workspace policy.',
      },
      {
        id: 'install',
        title: 'Install dependencies',
        command: 'cd my-app && npm install',
      },
      {
        id: 'dev',
        title: 'Start dev server',
        command: 'npm run dev -- --host 127.0.0.1 --port 5173',
        note: 'Point Web Preview at the local URL once the server is up.',
      },
    ],
  },
  {
    id: 'node-api',
    title: 'Minimal Node HTTP service',
    description: 'Spin up a tiny API for local smoke tests under Zavorth terminal trust.',
    steps: [
      {
        id: 'init',
        title: 'Init package',
        command: 'npm init -y',
      },
      {
        id: 'server',
        title: 'Run a one-file server',
        command: 'node -e "require(\'http\').createServer((_,r)=>{r.end(\'ok\')}).listen(3000,\'127.0.0.1\')"',
        note: 'Prefer a checked-in server.js for real work; this is a smoke scaffold only.',
      },
    ],
  },
  {
    id: 'static-preview',
    title: 'Static folder preview',
    description: 'Serve an existing dist/public folder without scaffolding a new app.',
    steps: [
      {
        id: 'serve',
        title: 'Serve static files',
        command: 'npx --yes serve -l 5173 .',
        note: 'Run from the folder that contains index.html.',
      },
    ],
  },
];

export function normalizePreviewUrl(value: string, fallback = DEFAULT_PREVIEW_URL): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return fallback;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)...(\/.*)...$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return fallback;
}

export function formatScaffoldCopyBlock(hint: VibeScaffoldHint): string {
  const lines = [
    `# ${hint.title}`,
    hint.description,
    '',
    ...hint.steps.map((step, i) => `${i + 1}. ${step.title}\n   ${step.command}${step.note ? `\n   # ${step.note}` : ''}`),
  ];
  return lines.join('\n');
}
