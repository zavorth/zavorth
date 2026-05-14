import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export type ApprovalSigningKeyResolution = {
  key: string;
  source: 'env' | 'local-file';
  envVar: string | null;
  filePath: string | null;
  created: boolean;
};

export type ApprovalSigningKeyInspection = {
  status: 'ready' | 'ready-on-demand' | 'attention' | 'blocked';
  source: 'env' | 'local-file' | 'missing-local-file' | 'invalid-env' | 'invalid-local-file';
  persistent: boolean;
  willAutoCreateOnUse: boolean;
  envVar: string | null;
  filePath: string | null;
  summary: string;
  reasons: string[];
  nextSteps: string[];
};

const PRIMARY_ENV_KEY = 'ZAVORTH_TOOL_APPROVAL_SIGNING_KEY';
const FALLBACK_ENV_KEY = 'ZAVORTH_SECURITY_APPROVAL_SIGNING_KEY';
const KEY_FILE_ENV_KEY = 'ZAVORTH_TOOL_APPROVAL_SIGNING_KEY_FILE';
const GENERATED_KEY_PATTERN = /^[a-f0-9]{64}$/i;
let cachedResolution: ApprovalSigningKeyResolution | null = null;

export function resolveToolApprovalSigningKey(): string {
  return resolveToolApprovalSigningKeyDetails().key;
}

export function resolveToolApprovalSigningKeyDetails(): ApprovalSigningKeyResolution {
  if (cachedResolution) {
    return cachedResolution;
  }

  const fromEnv = resolveEnvSigningKey();
  if (fromEnv) {
    cachedResolution = fromEnv;
    return cachedResolution;
  }

  cachedResolution = resolveLocalFileSigningKey();
  return cachedResolution;
}

export function resolveToolApprovalSigningKeyFilePath(): string {
  return resolveToolApprovalSigningKeyFilePathForEnv(process.env);
}

export function inspectToolApprovalSigningKeyState(
  env: Record<string, string | undefined> = process.env,
): ApprovalSigningKeyInspection {
  for (const envVar of [PRIMARY_ENV_KEY, FALLBACK_ENV_KEY]) {
    const raw = String(env[envVar] || '').trim();
    if (!raw) {
      continue;
    }
    if (raw.length < 32) {
      return {
        status: 'blocked',
        source: 'invalid-env',
        persistent: false,
        willAutoCreateOnUse: false,
        envVar,
        filePath: null,
        summary: `${envVar} esta configurada, mas curta demais para assinar aprovacoes.`,
        reasons: [`${envVar} precisa ter pelo menos 32 caracteres.`],
        nextSteps: [`Defina ${envVar} com pelo menos 32 caracteres ou remova a variavel para usar a chave local automatica.`],
      };
    }
    return {
      status: 'ready',
      source: 'env',
      persistent: true,
      willAutoCreateOnUse: false,
      envVar,
      filePath: null,
      summary: `Aprovacoes persistem usando ${envVar}.`,
      reasons: ['Chave explicita de assinatura de aprovacao esta pronta.'],
      nextSteps: [],
    };
  }

  const filePath = resolveToolApprovalSigningKeyFilePathForEnv(env);
  if (!fs.existsSync(filePath)) {
    return {
      status: 'ready-on-demand',
      source: 'missing-local-file',
      persistent: false,
      willAutoCreateOnUse: true,
      envVar: null,
      filePath,
      summary: 'A chave local de aprovacao ainda nao existe, mas sera criada automaticamente no primeiro uso.',
      reasons: ['Nenhuma chave por ambiente foi definida e o arquivo local ainda nao existe.'],
      nextSteps: ['Nenhuma acao obrigatoria para uso pessoal/profissional; o Zavorth criara a chave local quando precisar assinar uma aprovacao.'],
    };
  }

  const existing = readExistingGeneratedKeyWithoutRepair(filePath);
  if (!existing) {
    return {
      status: 'attention',
      source: 'invalid-local-file',
      persistent: false,
      willAutoCreateOnUse: true,
      envVar: null,
      filePath,
      summary: 'O arquivo local de assinatura existe, mas nao contem uma chave valida.',
      reasons: ['O conteudo esperado e uma chave hexadecimal de 64 caracteres.'],
      nextSteps: ['Remova o arquivo invalido ou deixe o Zavorth arquivar e recriar a chave no proximo uso de aprovacao.'],
    };
  }

  return {
    status: 'ready',
    source: 'local-file',
    persistent: true,
    willAutoCreateOnUse: false,
    envVar: null,
    filePath,
    summary: 'Aprovacoes persistem usando chave local protegida por usuario.',
    reasons: ['Arquivo local de assinatura esta presente e valido.'],
    nextSteps: [],
  };
}

function resolveToolApprovalSigningKeyFilePathForEnv(env: Record<string, string | undefined>): string {
  const explicitPath = String(env[KEY_FILE_ENV_KEY] || '').trim();
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  const baseDir = process.platform === 'win32'
    ? String(env.APPDATA || '').trim() || path.join(os.homedir(), 'AppData', 'Roaming')
    : String(env.XDG_CONFIG_HOME || '').trim() || path.join(os.homedir(), '.config');
  return path.join(baseDir, 'Zavorth', 'security', 'approval-signing-key');
}

export function resetApprovalSigningKeyCacheForTests(): void {
  cachedResolution = null;
}

function resolveEnvSigningKey(): ApprovalSigningKeyResolution | null {
  for (const envVar of [PRIMARY_ENV_KEY, FALLBACK_ENV_KEY]) {
    const raw = String(process.env[envVar] || '').trim();
    if (!raw) {
      continue;
    }
    assertUsableSigningKey(raw, envVar);
    return {
      key: raw,
      source: 'env',
      envVar,
      filePath: null,
      created: false,
    };
  }
  return null;
}

function resolveLocalFileSigningKey(): ApprovalSigningKeyResolution {
  const filePath = resolveToolApprovalSigningKeyFilePath();
  const existing = readExistingGeneratedKey(filePath);
  if (existing) {
    return {
      key: existing,
      source: 'local-file',
      envVar: null,
      filePath,
      created: false,
    };
  }

  const key = randomBytes(32).toString('hex');
  writeGeneratedKey(filePath, key);
  return {
    key,
    source: 'local-file',
    envVar: null,
    filePath,
    created: true,
  };
}

function readExistingGeneratedKey(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (GENERATED_KEY_PATTERN.test(raw)) {
    return raw.toLowerCase();
  }

  archiveInvalidKeyFile(filePath);
  return null;
}

function readExistingGeneratedKeyWithoutRepair(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (GENERATED_KEY_PATTERN.test(raw)) {
    return raw.toLowerCase();
  }
  return null;
}

function writeGeneratedKey(filePath: string, key: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(path.dirname(filePath), 0o700);
  } catch {
    // Best effort on Windows and restricted filesystems.
  }
  try {
    fs.writeFileSync(filePath, `${key}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch (error: any) {
    if (error?.code === 'EEXIST') {
      const existing = readExistingGeneratedKey(filePath);
      if (existing) {
        return;
      }
    }
    throw error;
  }
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Best effort on Windows and restricted filesystems.
  }
}

function archiveInvalidKeyFile(filePath: string): void {
  const archivePath = `${filePath}.invalid-${Date.now()}`;
  try {
    fs.renameSync(filePath, archivePath);
  } catch {
    fs.rmSync(filePath, { force: true });
  }
}

function assertUsableSigningKey(value: string, source: string): void {
  if (value.length < 32) {
    throw new Error(`${source} must contain at least 32 characters for approval signing.`);
  }
}
