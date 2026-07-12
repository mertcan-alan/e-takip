import test from 'node:test'
import assert from 'node:assert/strict'
import { readProjectFile } from './helpers/project.mjs'

test('BrowserWindow keeps the renderer isolated from Node.js', async () => {
  const main = await readProjectFile('src/main/index.js')

  assert.match(main, /nodeIntegration:\s*false/)
  assert.match(main, /contextIsolation:\s*true/)
  assert.match(main, /sandbox:\s*true/)
  assert.match(main, /webSecurity:\s*true/)
  assert.match(main, /will-attach-webview[\s\S]*preventDefault/)
  assert.match(main, /will-navigate[\s\S]*preventDefault/)
  assert.match(main, /setPermissionCheckHandler\(\(\) => false\)/)
})

test('preload exposes an allowlisted bridge and keeps session tokens private', async () => {
  const preload = await readProjectFile('src/main/preload.js')

  assert.match(preload, /contextBridge\.exposeInMainWorld\(['"]eTakip['"]/)
  assert.match(preload, /let sessionToken = null/)
  assert.match(preload, /invokeWithSession/)
  assert.doesNotMatch(preload, /exposeInMainWorld\([^)]*ipcRenderer/)
  assert.doesNotMatch(preload, /sessionToken:\s*sessionToken/)
})

test('database IPC is protected by trusted-sender and expiring-session checks', async () => {
  const handlers = await readProjectFile('src/main/db/handlers.js')

  assert.match(handlers, /function isTrustedSender\(event\)/)
  assert.match(handlers, /requiresAuth = true/)
  assert.match(handlers, /session\.senderId === event\.sender\.id/)
  assert.match(handlers, /session\.expiresAt > Date\.now\(\)/)
  assert.match(handlers, /randomUUID\(\)/)
  assert.match(handlers, /MAX_LOGIN_ATTEMPTS\s*=\s*5/)
  assert.match(handlers, /LOGIN_LOCK_MS\s*=\s*30 \* 1000/)
})

test('audit details redact sensitive patient and credential fields', async () => {
  const handlers = await readProjectFile('src/main/db/handlers.js')

  for (const field of ['tc_id', 'phone', 'email', 'date_of_birth', 'allergies', 'password']) {
    assert.match(handlers, new RegExp(`['"]${field}['"]`))
  }
  assert.match(handlers, /safeAuditDetails/)
  assert.match(handlers, /JSON\.stringify\(safeAuditDetails/)
})
