/**
 * e-Takip — SQLite Database (sql.js — pure WebAssembly, no native compilation)
 *
 * sql.js is a port of SQLite to WebAssembly. It requires:
 * - No MSBuild / node-gyp / native compilation
 * - Works on all platforms (Windows, macOS, Linux) out-of-the-box
 * - The .wasm binary is loaded at runtime from the sql.js package
 *
 * Persistence strategy:
 * - sql.js holds the database in memory as a Uint8Array
 * - We serialize to disk (userData/e-takip/e-takip.db) after successful writes
 * - We load from disk on startup if the file exists
 *
 * API differences from better-sqlite3:
 * - All operations are still synchronous (sql.js is sync in Node)
 * - `db.run(sql, params)` for mutations
 * - `db.exec(sql)` for DDL
 * - `db.prepare(sql)` → Statement with .get(), .all(), .run()
 */

import { createRequire } from 'module'
import { join, dirname } from 'path'
import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'fs'

const require   = createRequire(import.meta.url)

// ─── Paths ────────────────────────────────────────────────────────────────────
const DB_DIR   = app.getPath('userData')
const DB_PATH  = join(DB_DIR, 'e-takip.db')

// sql.js WASM binary — located inside the sql.js package
const WASM_PATH = join(
  dirname(require.resolve('sql.js')),
  'sql-wasm.wasm'
)

/** @type {import('sql.js').Database} */
export let db = null

// ─── Helpers: sql.js result → array of plain objects ─────────────────────────
function resultToObjects(result) {
  if (!result || result.length === 0) return []
  const { columns, values } = result[0]
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  )
}

/**
 * Wraps sql.js to expose a better-sqlite3-like API surface so the handlers
 * module doesn't need to change significantly.
 */
function createDbWrapper(sqlJsDb, persistFn, SQL) {
  let transactionDepth = 0

  const restoreSnapshot = (snapshot) => {
    try {
      sqlJsDb.close()
    } catch {
      // The old in-memory database may already be unusable.
    }
    sqlJsDb = new SQL.Database(snapshot)
    sqlJsDb.run('PRAGMA foreign_keys = ON')
  }

  const mutate = (operation) => {
    if (transactionDepth > 0) return operation()
    const snapshot = sqlJsDb.export()
    const result = operation()
    try {
      persistFn(sqlJsDb)
      return result
    } catch (error) {
      restoreSnapshot(snapshot)
      throw error
    }
  }

  return {
    /** Execute a DDL/DML string (no results expected) */
    exec(sql) {
      mutate(() => sqlJsDb.run(sql))
    },

    /**
     * prepare(sql) → { get, all, run }
     * Mimics better-sqlite3's synchronous prepared statement API.
     */
    prepare(sql) {
      return {
        get(...params) {
          const flat = params.flat()
          const stmt = sqlJsDb.prepare(sql)
          stmt.bind(flat)
          const hasRow = stmt.step()
          if (!hasRow) { stmt.free(); return undefined }
          const row = stmt.getAsObject()
          stmt.free()
          return row
        },
        all(...params) {
          const flat = params.flat()
          const result = sqlJsDb.exec(sql, flat.length ? flat : undefined)
          return resultToObjects(result)
        },
        run(...params) {
          const flat = params.flat()
          return mutate(() => {
            sqlJsDb.run(sql, flat.length ? flat : undefined)
            return { changes: sqlJsDb.getRowsModified() }
          })
        },
      }
    },

    /** Convenience: run a single SQL with params, persist */
    run(sql, params) {
      mutate(() => sqlJsDb.run(sql, params))
    },

    /** Execute within a transaction (sql.js has manual BEGIN/COMMIT) */
    transaction(fn) {
      return () => {
        if (transactionDepth > 0) return fn()

        const snapshot = sqlJsDb.export()
        sqlJsDb.run('BEGIN')
        transactionDepth += 1
        try {
          const result = fn()
          sqlJsDb.run('COMMIT')
          transactionDepth = Math.max(0, transactionDepth - 1)
          try {
            persistFn(sqlJsDb)
          } catch (error) {
            restoreSnapshot(snapshot)
            throw error
          }
          return result
        } catch (err) {
          if (transactionDepth > 0) {
            try {
              sqlJsDb.run('ROLLBACK')
            } catch (rollbackError) {
              console.error('[e-Takip DB] İşlem geri alınamadı:', rollbackError.message)
              restoreSnapshot(snapshot)
            }
          }
          throw err
        } finally {
          transactionDepth = Math.max(0, transactionDepth - 1)
        }
      }
    },

    /** Expose underlying sql.js db for advanced use */
    get _raw() {
      return sqlJsDb
    },
  }
}

// ─── Initialize ───────────────────────────────────────────────────────────────
export async function initDatabase() {
  mkdirSync(DB_DIR, { recursive: true })

  // Dynamically load sql.js (ESM compatible)
  const initSqlJs = require('sql.js')

  const SQL = await initSqlJs({
    locateFile: () => WASM_PATH,
  })

  // Load existing DB from disk, or create fresh
  let sqlJsDb
  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH)
    sqlJsDb = new SQL.Database(fileBuffer)
    console.log('[e-Takip DB] Mevcut veritabanı yüklendi:', DB_PATH)
  } else {
    sqlJsDb = new SQL.Database()
    console.log('[e-Takip DB] Yeni veritabanı oluşturuldu:', DB_PATH)
  }

  // Persistence function: serialize in-memory DB → disk
  const persist = (database) => {
    const data = database.export()
    const temporaryPath = `${DB_PATH}.tmp`
    writeFileSync(temporaryPath, Buffer.from(data))
    renameSync(temporaryPath, DB_PATH)
  }

  // Wrap with better-sqlite3-like API
  db = createDbWrapper(sqlJsDb, persist, SQL)

  // Run pragmas (informational only in sql.js — WAL not available in WASM)
  sqlJsDb.run('PRAGMA foreign_keys = ON')

  // Schema creation is atomic. Production-like records are never generated.
  db.transaction(() => {
    createSchema()
  })()

  console.log('[e-Takip DB] Hazır')
}

// ─── Schema ───────────────────────────────────────────────────────────────────
function createSchema() {
  db._raw.run(/* sql */`
    CREATE TABLE IF NOT EXISTS patients (
      id            TEXT PRIMARY KEY,
      tc_id         TEXT UNIQUE NOT NULL
                    CHECK(length(tc_id) = 11 AND tc_id NOT GLOB '*[^0-9]*'),
      first_name    TEXT NOT NULL,
      last_name     TEXT NOT NULL,
      date_of_birth TEXT,
      gender        TEXT,
      blood_type    TEXT,
      phone         TEXT,
      email         TEXT,
      allergies     TEXT DEFAULT '[]',
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id          TEXT PRIMARY KEY,
      license_no  TEXT UNIQUE NOT NULL,
      first_name  TEXT NOT NULL,
      last_name   TEXT NOT NULL,
      specialty   TEXT,
      hospital    TEXT,
      digital_sig TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS drugs (
      id              TEXT PRIMARY KEY,
      barcode         TEXT UNIQUE,
      name            TEXT NOT NULL,
      generic_name    TEXT,
      category        TEXT,
      form            TEXT,
      strength        TEXT,
      manufacturer    TEXT,
      requires_cold   INTEGER DEFAULT 0,
      controlled      INTEGER DEFAULT 0,
      max_daily_dose  REAL,
      dose_unit       TEXT,
      contraindications TEXT DEFAULT '[]',
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS drug_interactions (
      id          TEXT PRIMARY KEY,
      drug_a_id   TEXT NOT NULL REFERENCES drugs(id),
      drug_b_id   TEXT NOT NULL REFERENCES drugs(id),
      severity    TEXT NOT NULL,
      description TEXT NOT NULL,
      mechanism   TEXT
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id             TEXT PRIMARY KEY,
      barcode        TEXT UNIQUE,
      patient_id     TEXT NOT NULL REFERENCES patients(id),
      doctor_id      TEXT NOT NULL REFERENCES doctors(id),
      issued_date    TEXT NOT NULL,
      expiry_date    TEXT,
      status         TEXT DEFAULT 'pending',
      diagnosis_code TEXT,
      notes          TEXT,
      verified_by    TEXT,
      verified_at    TEXT,
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rx_items (
      id               TEXT PRIMARY KEY,
      prescription_id  TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
      drug_id          TEXT NOT NULL REFERENCES drugs(id),
      quantity         REAL NOT NULL,
      unit             TEXT,
      frequency        TEXT,
      duration_days    INTEGER,
      instructions     TEXT,
      substitutable    INTEGER DEFAULT 1,
      status           TEXT DEFAULT 'safe'
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id   TEXT NOT NULL,
      action      TEXT NOT NULL,
      actor       TEXT DEFAULT 'system',
      details     TEXT DEFAULT '{}',
      timestamp   TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_prescriptions_patient  ON prescriptions(patient_id);
    CREATE INDEX IF NOT EXISTS idx_prescriptions_status   ON prescriptions(status);
    CREATE INDEX IF NOT EXISTS idx_prescriptions_created  ON prescriptions(created_at);
    CREATE INDEX IF NOT EXISTS idx_rx_items_prescription  ON rx_items(prescription_id);
    CREATE INDEX IF NOT EXISTS idx_drugs_barcode          ON drugs(barcode);
    CREATE INDEX IF NOT EXISTS idx_patients_name          ON patients(last_name, first_name);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp        ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_entity           ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action           ON audit_log(action);
  `)
}
