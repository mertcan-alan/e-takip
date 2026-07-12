import test from 'node:test'
import assert from 'node:assert/strict'
import { readPackage, readProjectFile } from './helpers/project.mjs'

test('package metadata keeps the desktop application private and reproducible', async () => {
  const packageJson = await readPackage()

  assert.equal(packageJson.private, true)
  assert.equal(packageJson.type, 'module')
  assert.match(packageJson.engines.node, />=22/)
  assert.equal(packageJson.scripts.test, 'node --test')
  assert.ok(packageJson.scripts.lint)
  assert.ok(packageJson.scripts.build)
  assert.equal(packageJson.dependencies['sql.js'], '^1.12.0')
})

test('the build only packages generated application assets', async () => {
  const packageJson = await readPackage()

  assert.deepEqual(packageJson.build.files, ['dist/**/*', 'dist-electron/**/*'])
  assert.equal(packageJson.build.appId, 'tr.local.etakip')
  assert.equal(packageJson.build.win.target, 'nsis')
})

test('renderer build uses a fixed loopback development origin', async () => {
  const viteConfig = await readProjectFile('vite.config.js')

  assert.match(viteConfig, /host:\s*['"]127\.0\.0\.1['"]/)
  assert.match(viteConfig, /strictPort:\s*true/)
  assert.match(viteConfig, /port:\s*5173/)
})
