export const DEFAULT_CHILD_PROCESS_ENV_KEYS = [
  'PATH',
  'Path',
  'PATHEXT',
  'SystemRoot',
  'WINDIR',
  'COMSPEC',
  'ComSpec',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'NODE_ENV',
];

export type BuildChildProcessEnvInput = {
  explicitEnv?: Record<string, string | undefined>;
  allowedEnv?: string[];
  hostEnv?: NodeJS.ProcessEnv;
};

export function buildChildProcessEnv(input: BuildChildProcessEnvInput = {}): Record<string, string> {
  const {
    explicitEnv = {},
    allowedEnv = [],
    hostEnv = process.env,
  } = input;
  const childEnv: Record<string, string> = {};
  const allowedKeys = [
    ...DEFAULT_CHILD_PROCESS_ENV_KEYS,
    ...allowedEnv,
  ]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  for (const key of allowedKeys) {
    const value = hostEnv[key];
    if (typeof value === 'string') {
      childEnv[key] = value;
    }
  }

  for (const [key, value] of Object.entries(explicitEnv)) {
    if (typeof value === 'string') {
      childEnv[key] = value;
    }
  }

  return childEnv;
}
