const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

function resolveRepoRoot(options = {}) {
  const env = options.env || process.env
  const dirname = options.dirname || __dirname
  const resourcesPath = options.resourcesPath || process.resourcesPath
  const existsSync = options.existsSync || fs.existsSync

  const fromEnv = env.ZAVORTH_ROOT && path.resolve(env.ZAVORTH_ROOT)
  if (fromEnv && existsSync(path.join(fromEnv, 'package.json'))) {
    return fromEnv
  }

  const devRoot = path.resolve(dirname, '..', '..', '..')
  if (existsSync(path.join(devRoot, 'package.json'))) {
    return devRoot
  }

  return resourcesPath || devRoot
}

function resolveZavorthHome(options = {}) {
  const env = options.env || process.env
  const homedir = options.homedir || os.homedir
  if (env.ZAVORTH_HOME) {
    return path.resolve(env.ZAVORTH_HOME)
  }
  if (process.platform === 'win32' && env.LOCALAPPDATA) {
    return path.join(env.LOCALAPPDATA, 'Zavorth')
  }
  return path.join(homedir(), '.zavorth')
}

function resolveRuntimePaths(options = {}) {
  const repoRoot = resolveRepoRoot(options)
  const runtimeDir = path.join(repoRoot, 'data', 'runtime')
  return {
    repoRoot,
    zavorthHome: resolveZavorthHome(options),
    runtimeDir,
    logsDir: runtimeDir,
    tokenFile:
      (options.env || process.env).ZAVORTH_WEB_AUTH_TOKEN_FILE ||
      path.join(runtimeDir, 'web-api-token.txt'),
    hostLockFile: path.join(runtimeDir, 'host-supervisor.lock.json'),
    cliBin: path.join(repoRoot, 'bin', 'zavorth.js'),
  }
}

function isWeakToken(value) {
  const text = String(value || '').trim()
  return text.length < 32 || /^(changeme|password|token|dev|test)$/iu.test(text)
}

function generateToken(randomBytes = crypto.randomBytes) {
  return randomBytes(36).toString('base64url')
}

function readTokenFile(tokenFile, options = {}) {
  const readFileSync = options.readFileSync || fs.readFileSync
  try {
    const value = readFileSync(tokenFile, 'utf8').trim()
    return value && !isWeakToken(value) ? value : null
  } catch {
    return null
  }
}

function resolveAccessToken(options = {}) {
  const env = options.env || process.env
  const generate = Boolean(options.generate)
  const paths = options.paths || resolveRuntimePaths(options)
  const readFile = options.readFileSync || fs.readFileSync
  const mkdir = options.mkdirSync || fs.mkdirSync
  const writeFile = options.writeFileSync || fs.writeFileSync
  const chmod = options.chmodSync || fs.chmodSync
  const randomBytes = options.randomBytes || crypto.randomBytes

  const envToken = String(env.ZAVORTH_WEB_AUTH_TOKEN || '').trim()
  if (envToken && !isWeakToken(envToken)) {
    return { token: envToken, source: 'env' }
  }

  const fileToken = readTokenFile(paths.tokenFile, { readFileSync: readFile })
  if (fileToken) {
    return { token: fileToken, source: 'file' }
  }

  if (!generate) {
    return { token: '', source: 'missing' }
  }

  const token = generateToken(randomBytes)
  mkdir(path.dirname(paths.tokenFile), { recursive: true })
  writeFile(paths.tokenFile, `${token}\n`, { encoding: 'utf8', mode: 0o600 })
  try {
    chmod(paths.tokenFile, 0o600)
  } catch {
    // Windows may ignore POSIX permissions; the token still stays in the local runtime directory.
  }
  return { token, source: 'generated' }
}

function buildRuntimeBaseUrl(options = {}) {
  const env = options.env || process.env
  const rawHost = String(env.ZAVORTH_WEB_HOST || '127.0.0.1').trim()
  const host = rawHost && rawHost !== '0.0.0.0' ? rawHost : '127.0.0.1'
  const port = Number(env.ZAVORTH_WEB_PORT || env.PORT || 3000)
  return `http://${host}:${Number.isFinite(port) ? port : 3000}`
}

module.exports = {
  buildRuntimeBaseUrl,
  generateToken,
  isWeakToken,
  readTokenFile,
  resolveAccessToken,
  resolveRepoRoot,
  resolveRuntimePaths,
  resolveZavorthHome,
}
