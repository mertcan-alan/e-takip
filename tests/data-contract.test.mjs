import test from 'node:test'
import assert from 'node:assert/strict'
import { readProjectFile } from './helpers/project.mjs'

test('patient records enforce unique numeric identity values at the schema boundary', async () => {
  const database = await readProjectFile('src/main/db/database.js')
  const handlers = await readProjectFile('src/main/db/handlers.js')

  assert.match(database, /tc_id\s+TEXT UNIQUE NOT NULL/)
  assert.match(database, /CHECK\(length\(tc_id\) = 11/)
  assert.match(handlers, /function normalizeTcId\(value\)/)
  assert.match(handlers, /digits\[9\]\s*!==\s*tenthDigit/)
  assert.match(handlers, /digits\[10\]\s*!==\s*eleventhDigit/)
})

test('prescription entities retain relational integrity and item cascading', async () => {
  const database = await readProjectFile('src/main/db/database.js')

  assert.match(database, /patient_id\s+TEXT NOT NULL REFERENCES patients\(id\)/)
  assert.match(database, /doctor_id\s+TEXT NOT NULL REFERENCES doctors\(id\)/)
  assert.match(database, /prescription_id\s+TEXT NOT NULL REFERENCES prescriptions\(id\) ON DELETE CASCADE/)
  assert.match(database, /drug_id\s+TEXT NOT NULL REFERENCES drugs\(id\)/)
  assert.match(database, /PRAGMA foreign_keys = ON/)
})

test('write workflows use transactions and append audit records', async () => {
  const handlers = await readProjectFile('src/main/db/handlers.js')

  assert.match(handlers, /db\.transaction\(\(\) =>/)
  assert.match(handlers, /INSERT INTO audit_log/)
  assert.match(handlers, /audit\(['"]prescriptions['"]/)
  assert.match(handlers, /audit\(['"]patients['"]/)
})

test('range reports are bounded and capped before returning rows', async () => {
  const handlers = await readProjectFile('src/main/db/handlers.js')

  assert.match(handlers, /REPORT_ROW_LIMIT\s*=\s*500/)
  assert.match(handlers, /db:reports:generateRange/)
  assert.match(handlers, /maxDays:\s*366/)
  assert.match(handlers, /prescriptionsTruncated/)
  assert.match(handlers, /alertsTruncated/)
})

test('database initialization never generates demo health records', async () => {
  const database = await readProjectFile('src/main/db/database.js')

  assert.doesNotMatch(database, /faker|mockaroo|seedPatients|seedPrescriptions/i)
  assert.doesNotMatch(database, /INSERT\s+INTO\s+patients\s+VALUES/i)
  assert.doesNotMatch(database, /INSERT\s+INTO\s+prescriptions\s+VALUES/i)
})
