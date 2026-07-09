const CALLBACK_MAX_LENGTH = 100;

const SAFE_ARG_TOKEN_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;
const SAFE_MODEL_TOKEN_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,79}$/i;
const UNSAFE_CALLBACK_CHAR_PATTERN = /[;&|`$<>\\]/;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;

const SAFE_NO_ARG_COMMANDS = new Set([
  '/doctor',
  '/zavorthcontrol',
  '/echoapprovals',
  '/fixes',
  '/gateway',
  '/help',
  '/models',
  '/ready',
  '/readiness',
  '/runtime',
  '/status',
  '/stayonline',
]);

const SAFE_LIMITED_ARG_COMMANDS = new Set([
  '/commands',
  '/tools',
]);

const SAFE_CHANNEL_CALLBACK_ACTIONS = new Set([
  'doctor',
  'inspect',
  'login-qr',
  'consistency',
  'policy',
  'status',
]);

const KNOWN_CHANNEL_ACTIONS = new Set([
  'broadcast-test',
  'doctor',
  'inspect',
  'login-qr',
  'logout',
  'consistency',
  'policy',
  'policy-reload',
  'prepare',
  'relink',
  'repair',
  'send-test',
  'status',
]);

const PUBLIC_CALLBACK_COMMANDS = new Set([
  '/commands',
  '/help',
]);

export type SharedSurfaceCallbackCommandDecision =
  | {
      allowed: true;
      commandText: string;
      commandType: string;
    }
  | {
      allowed: false;
      reason: string;
    };

export function evaluateSharedSurfaceCommandCallback(value: unknown): SharedSurfaceCallbackCommandDecision {
  const normalized = normalizeCallbackText(value);
  if (!normalized) {
    return { allowed: false, reason: 'Callback vazio ou invalido.' };
  }

  if (normalized.length > CALLBACK_MAX_LENGTH) {
    return { allowed: false, reason: 'Callback excede o tamanho seguro.' };
  }

  if (
    !normalized.startsWith('/') ||
    CONTROL_CHAR_PATTERN.test(normalized) ||
    UNSAFE_CALLBACK_CHAR_PATTERN.test(normalized)
  ) {
    return { allowed: false, reason: 'Callback contem caracteres nao permitidos.' };
  }

  const tokens = normalized.split(' ');
  const commandType = String(tokens[0] || '').trim().toLowerCase();
  const args = tokens.slice(1);

  if (!commandType || !SAFE_ARG_TOKEN_PATTERN.test(commandType.replace(/^\//, ''))) {
    return { allowed: false, reason: 'Comando de callback invalido.' };
  }

  if (SAFE_NO_ARG_COMMANDS.has(commandType)) {
    return args.length === 0
      ? { allowed: true, commandText: commandType, commandType }
      : { allowed: false, reason: 'Esse callback nao aceita argumentos.' };
  }

  if (SAFE_LIMITED_ARG_COMMANDS.has(commandType)) {
    return evaluateLimitedArgCommand(commandType, args);
  }

  if (commandType === '/model') {
    if (args.length !== 1 || !SAFE_MODEL_TOKEN_PATTERN.test(args[0])) {
      return { allowed: false, reason: 'Callback de modelo invalido.' };
    }
    return { allowed: true, commandText: `${commandType} ${args[0]}`, commandType };
  }

  if (commandType === '/channels') {
    return evaluateChannelCommand(args);
  }

  return { allowed: false, reason: 'Comando de callback nao permitido.' };
}

export function normalizeSharedSurfaceCommandCallback(value: unknown): string | null {
  const decision = evaluateSharedSurfaceCommandCallback(value);
  return decision.allowed ? decision.commandText : null;
}

export function isSharedSurfaceCommandCallback(value: unknown): boolean {
  return normalizeSharedSurfaceCommandCallback(value) !== null;
}

export function isSharedSurfaceChannelCallbackAction(kind: unknown): boolean {
  return SAFE_CHANNEL_CALLBACK_ACTIONS.has(String(kind || '').trim().toLowerCase());
}

export function isSharedSurfaceOperationalCallbackCommand(value: unknown): boolean {
  const decision = evaluateSharedSurfaceCommandCallback(value);
  if (!decision.allowed) {
    return false;
  }
  return !PUBLIC_CALLBACK_COMMANDS.has(decision.commandType);
}

function evaluateLimitedArgCommand(
  commandType: string,
  args: string[],
): SharedSurfaceCallbackCommandDecision {
  if (args.length > 3 || args.some((arg) => !SAFE_ARG_TOKEN_PATTERN.test(arg))) {
    return { allowed: false, reason: 'Argumentos de callback invalidos.' };
  }

  return {
    allowed: true,
    commandText: [commandType, ...args].join(' '),
    commandType,
  };
}

function evaluateChannelCommand(args: string[]): SharedSurfaceCallbackCommandDecision {
  if (args.length === 0) {
    return { allowed: true, commandText: '/channels', commandType: '/channels' };
  }

  if (args.some((arg) => !SAFE_ARG_TOKEN_PATTERN.test(arg))) {
    return { allowed: false, reason: 'Callback de canal invalido.' };
  }

  const firstArg = String(args[0] || '').trim().toLowerCase();
  if (args.length === 1) {
    if (firstArg === 'consistency') {
      return { allowed: true, commandText: '/channels consistency', commandType: '/channels' };
    }
    if (KNOWN_CHANNEL_ACTIONS.has(firstArg)) {
      return { allowed: false, reason: 'Acao de canal exige alvo explicito.' };
    }
    return { allowed: true, commandText: `/channels ${args[0]}`, commandType: '/channels' };
  }

  if (args.length !== 2) {
    return { allowed: false, reason: 'Callback de canal tem argumentos demais.' };
  }

  if (!SAFE_CHANNEL_CALLBACK_ACTIONS.has(firstArg)) {
    return { allowed: false, reason: 'Acao de canal exige comando explicito.' };
  }

  return {
    allowed: true,
    commandText: `/channels ${firstArg} ${args[1]}`,
    commandType: '/channels',
  };
}

function normalizeCallbackText(value: unknown): string {
  const raw = String(value || '');
  if (CONTROL_CHAR_PATTERN.test(raw)) {
    return '';
  }
  return raw.replace(/\s+/g, ' ').trim();
}
