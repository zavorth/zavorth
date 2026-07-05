const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const {
  buildRuntimeBaseUrl,
  isWeakToken,
  readTokenFile,
  resolveAccessToken,
  resolveRuntimePaths,
  resolveZavorthHome,
} = require('./runtime-access.cjs')

test('isWeakToken rejects short and placeholder tokens', () => {
  assert.equal(isWeakToken('token'), true)
  assert.equal(isWeakToken('dev'), true)
  assert.equal(isWeakToken('short'), true)
  assert.equal(isWeakToken('abcdefghijklmnopqrstuvwxyz123456'), false)
})

test('resolveZavorthHome prefers explicit home env', () => {
  assert.equal(
    resolveZavorthHome({
      env: { ZAVORTH_HOME: 'C:/custom/zavorth' },
      homedir: () => 'C:/Users/test',
    }),
    path.resolve('C:/custom/zavorth'),
  )
})

test('resolveRuntimePaths uses explicit token file without probing the real filesystem', () => {
  const paths = resolveRuntimePaths({
    env: {
      ZAVORTH_ROOT: 'C:/repo',
      ZAVORTH_WEB_AUTH_TOKEN_FILE: 'C:/secrets/token.txt',
    },
    dirname: 'C:/repo/apps/zavorth-desktop/electron',
    existsSync: (candidate) => String(candidate).replace(/\\/g, '/').endsWith('/package.json'),
    homedir: () => 'C:/Users/test',
  })

  assert.equal(paths.repoRoot, path.resolve('C:/repo'))
  assert.equal(paths.tokenFile, 'C:/secrets/token.txt')
  assert.equal(paths.hostLockFile, path.join(path.resolve('C:/repo'), 'data', 'runtime', 'host-supervisor.lock.json'))
})

test('readTokenFile ignores weak stored tokens', () => {
  assert.equal(
    readTokenFile('unused', {
      readFileSync: () => 'dev\n',
    }),
    null,
  )
})

test('resolveAccessToken prefers strong env token', () => {
  const token = 'abcdefghijklmnopqrstuvwxyz123456'
  const access = resolveAccessToken({
    env: { ZAVORTH_WEB_AUTH_TOKEN: token },
    paths: { tokenFile: 'unused' },
  })

  assert.deepEqual(access, { token, source: 'env' })
})

test('resolveAccessToken generates and persists a token when requested', () => {
  const writes = []
  const chmods = []
  const access = resolveAccessToken({
    env: {},
    generate: true,
    paths: { tokenFile: path.join('C:/runtime', 'web-api-token.txt') },
    readFileSync: () => {
      throw new Error('missing')
    },
    mkdirSync: () => {},
    writeFileSync: (...args) => writes.push(args),
    chmodSync: (...args) => chmods.push(args),
    randomBytes: () => Buffer.from('x'.repeat(36)),
  })

  assert.equal(access.source, 'generated')
  assert.equal(access.token.length > 32, true)
  assert.equal(writes.length, 1)
  assert.equal(chmods.length, 1)
})

test('buildRuntimeBaseUrl normalizes wildcard host to loopback', () => {
  assert.equal(
    buildRuntimeBaseUrl({
      env: {
        ZAVORTH_WEB_HOST: '0.0.0.0',
        ZAVORTH_WEB_PORT: '4455',
      },
    }),
    'http://127.0.0.1:4455',
  )
})
