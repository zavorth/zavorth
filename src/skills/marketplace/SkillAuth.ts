import fs from 'node:fs';
import path from 'node:path';

type AuthConfig = {
  tokens: Record<string, string>;
};

const AUTH_FILE = '.zavorth-skill-auth.json';

export function getAuthConfig(projectRoot: string): AuthConfig {
  const configPath = path.join(projectRoot, AUTH_FILE);
  if (!fs.existsSync(configPath)) return { tokens: {} };
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch { return { tokens: {} }; }
}

export function setAuthToken(projectRoot: string, host: string, token: string): void {
  const config = getAuthConfig(projectRoot);
  config.tokens[host] = token;
  const configPath = path.join(projectRoot, AUTH_FILE);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

export function removeAuthToken(projectRoot: string, host: string): void {
  const config = getAuthConfig(projectRoot);
  delete config.tokens[host];
  const configPath = path.join(projectRoot, AUTH_FILE);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function getAuthTokenForUrl(url: string, projectRoot: string): string | null {
  try {
    const parsed = new URL(url);
    const config = getAuthConfig(projectRoot);
    return config.tokens[parsed.host] || null;
  } catch { return null; }
}

export function getGitCredentialHelper(projectRoot: string): string | null {
  const config = getAuthConfig(projectRoot);
  const hosts = Object.keys(config.tokens);
  if (hosts.length === 0) return null;

  const helperScript = `#!/bin/sh
host="$1"
case "$host" in
${hosts.map((h) => `  ${h}) echo "username=token\npassword=${config.tokens[h]}" ;;`).join('\n')}
  *) echo "" ;;
esac`;

  const helperPath = path.join(projectRoot, '.zavorth-git-credential-helper.sh');
  fs.writeFileSync(helperPath, helperScript, { mode: 0o700 });
  return helperPath;
}

export function buildGitCloneUrl(url: string, projectRoot: string): string {
  const token = getAuthTokenForUrl(url, projectRoot);
  if (!token) return url;
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch { return url; }
}

export function getGitPasswordEnv(url: string, projectRoot: string): string | undefined {
  const token = getAuthTokenForUrl(url, projectRoot);
  return token || undefined;
}
