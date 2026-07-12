/**
 * e-Takip — IPC Database Handlers (sql.js compatible)
 *
 * Registers all ipcMain.handle() listeners for the renderer's preload bridge.
 * The db object here is the wrapper created in database.js that mimics
 * the better-sqlite3 API (prepare/get/all/run/transaction).
 *
 * Each handler returns { success: true, data } or { success: false, error }.
 */

import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { db } from './database.js'

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000
const LOGIN_WINDOW_MS = 60 * 1000
const LOGIN_LOCK_MS = 30 * 1000
const MAX_LOGIN_ATTEMPTS = 5
const REPORT_ROW_LIMIT = 500
const sessions = new Map()
const loginAttempts = new Map()

function isTrustedSender(event) {
  const senderUrl = event.senderFrame?.url || event.sender?.getURL?.() || ''
  try {
    const parsed = new URL(senderUrl)
    const isPackagedApplication = parsed.protocol === 'file:'
      && decodeURIComponent(parsed.pathname)
        .replace(/\\/g, '/')
        .endsWith('/dist/index.html')

    return isPackagedApplication || [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ].includes(parsed.origin)
  } catch {
    return false
  }
}

// Database operations require a session token created by auth:login.
function handle(channel, fn, { requiresAuth = true, passContext = false } = {}) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      if (!isTrustedSender(event)) throw new Error('İzin verilmeyen istek kaynağı.')

      let handlerArgs = args
      let sessionToken = null
      if (requiresAuth) {
        const [token, ...rest] = args
        const session = sessions.get(token)
        const sessionIsValid = session
          && session.senderId === event.sender.id
          && session.expiresAt > Date.now()

        if (!sessionIsValid) {
          if (session && session.senderId === event.sender.id) sessions.delete(token)
          throw new Error('Oturum geçersiz. Lütfen yeniden giriş yapın.')
        }
        sessionToken = token
        handlerArgs = rest
      }

      const context = { event, sessionToken }
      const data = await fn(...handlerArgs, ...(passContext ? [context] : []))
      return { success: true, data }
    } catch (err) {
      console.error(`[IPC Error] ${channel}:`, err.message)
      return { success: false, error: err.message }
    }
  })
}

// ─── Unique ID generator ──────────────────────────────────────────────────────
function uid() {
  return randomUUID()
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isValidDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  if (!match) return false

  const [, year, month, day] = match.map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

const PRESCRIPTION_STATUSES = ['pending', 'verified', 'dispensed', 'rejected', 'expired']
const AUDIT_REDACTED_FIELDS = new Set([
  'tc_id', 'patient_tc', 'phone', 'email', 'date_of_birth', 'allergies',
  'notes', 'instructions', 'diagnosis_code', 'password',
])

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requiredText(value, field, maxLength = 120) {
  if (!['string', 'number'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) {
    throw new Error(`${field} geçersiz.`)
  }
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${field} zorunludur.`)
  if (text.length > maxLength) throw new Error(`${field} en fazla ${maxLength} karakter olabilir.`)
  return text
}

function optionalText(value, field, maxLength = 250) {
  if (value === undefined || value === null || value === '') return null
  if (!['string', 'number'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) {
    throw new Error(`${field} geçersiz.`)
  }
  const text = String(value).trim()
  if (text.length > maxLength) throw new Error(`${field} en fazla ${maxLength} karakter olabilir.`)
  return text || null
}

function normalizeTcId(value) {
  if (!['string', 'number'].includes(typeof value)) {
    throw new Error('T.C. kimlik numarası tam 11 rakam olmalıdır.')
  }
  const tcId = String(value ?? '').trim()
  if (!/^\d{11}$/.test(tcId)) throw new Error('T.C. kimlik numarası tam 11 rakam olmalıdır.')
  const digits = [...tcId].map(Number)
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7]
  const tenthDigit = (((oddSum * 7) - evenSum) % 10 + 10) % 10
  const eleventhDigit = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10
  if (digits[0] === 0 || digits[9] !== tenthDigit || digits[10] !== eleventhDigit) {
    throw new Error('T.C. kimlik numarası doğrulama kurallarını karşılamıyor.')
  }
  return tcId
}

function sameText(left, right) {
  return String(left ?? '').trim().toLocaleLowerCase('tr-TR')
    === String(right ?? '').trim().toLocaleLowerCase('tr-TR')
}

function normalizeEmail(value) {
  const email = optionalText(value, 'E-posta adresi', 254)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Geçerli bir e-posta adresi girin.')
  }
  return email
}

function normalizePhone(value) {
  const phone = optionalText(value, 'Telefon numarası', 24)
  if (!phone) return null
  const digitCount = phone.replace(/\D/g, '').length
  if (!/^\+?[0-9 ()-]+$/.test(phone) || digitCount < 7 || digitCount > 15) {
    throw new Error('Geçerli bir telefon numarası girin.')
  }
  return phone
}

function normalizeBooleanFlag(value, field) {
  if (value === undefined || value === null || value === false || value === 0) return 0
  if (value === true || value === 1) return 1
  throw new Error(`${field} geçersiz.`)
}

function normalizeAllergies(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > 100) throw new Error('Alerji listesi geçersiz.')
  return value.map((item) => requiredText(item, 'Alerji bilgisi', 120))
}

function normalizePatient(data) {
  if (!isPlainObject(data)) throw new Error('Hasta bilgileri eksik.')
  const dateOfBirth = optionalText(data.date_of_birth, 'Doğum tarihi', 10)
  if (dateOfBirth && !isValidDateKey(dateOfBirth)) throw new Error('Doğum tarihi geçersiz.')
  if (dateOfBirth && dateOfBirth > localDateKey()) throw new Error('Doğum tarihi gelecekte olamaz.')

  return {
    tc_id: normalizeTcId(data.tc_id),
    first_name: requiredText(data.first_name, 'Ad', 80),
    last_name: requiredText(data.last_name, 'Soyad', 80),
    date_of_birth: dateOfBirth,
    gender: optionalText(data.gender, 'Cinsiyet', 30),
    blood_type: optionalText(data.blood_type, 'Kan grubu', 10),
    phone: normalizePhone(data.phone),
    email: normalizeEmail(data.email),
    allergies: normalizeAllergies(data.allergies),
  }
}

function safeAuditDetails(value) {
  if (Array.isArray(value)) return value.map(safeAuditDetails)
  if (!isPlainObject(value)) return value

  const clean = Object.create(null)
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) continue
    clean[key] = AUDIT_REDACTED_FIELDS.has(key) ? '[GİZLENDİ]' : safeAuditDetails(child)
  }
  return clean
}

function parseAuditDetails(value) {
  try {
    const parsed = JSON.parse(value || '{}')
    return isPlainObject(parsed) ? safeAuditDetails(parsed) : {}
  } catch {
    return {}
  }
}

function parseDateRange(startDate, endDate, { maxDays = null } = {}) {
  if (!isValidDateKey(startDate) || !isValidDateKey(endDate)) {
    throw new Error('Başlangıç ve bitiş tarihlerini geçerli biçimde girin.')
  }
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  const inclusiveDays = Math.floor((end - start) / 86400000) + 1
  if (inclusiveDays < 1) throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.')
  if (maxDays && inclusiveDays > maxDays) throw new Error(`Tarih aralığı en fazla ${maxDays} gün olabilir.`)
  return { startDate, endDate, inclusiveDays }
}

// ─── Audit log helper ─────────────────────────────────────────────────────────
function audit(entityType, entityId, action, actor = 'system', details = {}) {
  db.prepare(
    `INSERT INTO audit_log (id,entity_type,entity_id,action,actor,details)
     VALUES (?,?,?,?,?,?)`
  ).run(
    uid(),
    requiredText(entityType, 'Denetim varlık türü', 60),
    requiredText(entityId, 'Denetim kayıt kimliği', 100),
    requiredText(action, 'Denetim işlemi', 60),
    requiredText(actor, 'Denetim aktörü', 60),
    JSON.stringify(safeAuditDetails(isPlainObject(details) ? details : {})),
  )
}

function expirePrescriptions() {
  const expired = db.prepare(
    `SELECT id,status FROM prescriptions
     WHERE expiry_date IS NOT NULL AND expiry_date < ? AND status IN ('pending','verified')`
  ).all(localDateKey())
  if (!expired.length) return

  db.transaction(() => {
    for (const record of expired) {
      db.prepare(
        `UPDATE prescriptions SET status='expired', updated_at=datetime('now') WHERE id=?`
      ).run(record.id)
      audit('prescriptions', record.id, 'update', 'system', {
        previousStatus: record.status,
        nextStatus: 'expired',
        changedFields: ['status'],
        source: 'expiry_date',
      })
    }
  })()
}

// ─── Drug interaction checker ─────────────────────────────────────────────────
function checkInteractions(drugIds) {
  if (!drugIds || drugIds.length < 2) return []
  const ph = drugIds.map(() => '?').join(',')
  return db.prepare(
    `SELECT di.*, da.name AS drug_a_name, db2.name AS drug_b_name
     FROM drug_interactions di
     JOIN drugs da  ON di.drug_a_id = da.id
     JOIN drugs db2 ON di.drug_b_id = db2.id
     WHERE di.drug_a_id IN (${ph}) AND di.drug_b_id IN (${ph})`
  ).all(...drugIds, ...drugIds)
}

// ─── Register all IPC handlers ────────────────────────────────────────────────
export function registerHandlers() {

  // ══════════════════════════════════════════════════════════════════════════
  //  AUTHENTICATION
  // ══════════════════════════════════════════════════════════════════════════

  handle('auth:login', (username, password, { event }) => {
    const attemptKey = event.sender.id
    const now = Date.now()
    const previousAttempt = loginAttempts.get(attemptKey)
    if (previousAttempt?.lockedUntil > now) {
      throw new Error('Çok sayıda başarısız deneme yapıldı. Lütfen kısa süre sonra yeniden deneyin.')
    }
    const attempt = !previousAttempt || now - previousAttempt.windowStartedAt > LOGIN_WINDOW_MS
      ? { count: 0, windowStartedAt: now, lockedUntil: 0 }
      : previousAttempt

    if (username === 'admin' && password === 'admin') {
      loginAttempts.delete(attemptKey)
      const token = randomUUID()
      for (const [existingToken, session] of sessions) {
        if (session.senderId === event.sender.id) sessions.delete(existingToken)
      }
      audit('auth', 'admin', 'login', 'admin')
      sessions.set(token, {
        senderId: event.sender.id,
        expiresAt: Date.now() + SESSION_DURATION_MS,
      })
      event.sender.once('destroyed', () => {
        sessions.delete(token)
        loginAttempts.delete(attemptKey)
      })
      return {
        token,
        user: {
          username: 'admin',
          displayName: 'Sistem Yöneticisi',
          role: 'Yönetici',
        },
      }
    }

    attempt.count += 1
    if (attempt.count >= MAX_LOGIN_ATTEMPTS) attempt.lockedUntil = now + LOGIN_LOCK_MS
    loginAttempts.set(attemptKey, attempt)
    throw new Error('Kullanıcı adı veya şifre hatalı.')
  }, { requiresAuth: false, passContext: true })

  handle('auth:logout', ({ sessionToken }) => {
    sessions.delete(sessionToken)
    audit('auth', 'admin', 'logout', 'admin')
    return { loggedOut: true }
  }, { passContext: true })

  // ══════════════════════════════════════════════════════════════════════════
  //  PRESCRIPTIONS
  // ══════════════════════════════════════════════════════════════════════════

  handle('db:prescriptions:getAll', ({ limit = 50, offset = 0, status, search = '' } = {}) => {
    expirePrescriptions()
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100)
    const safeOffset = Math.max(Number(offset) || 0, 0)
    const allowedStatuses = ['pending', 'verified', 'dispensed', 'rejected', 'expired']
    const safeStatus = allowedStatuses.includes(status) ? status : ''
    const safeSearch = String(search || '').trim().slice(0, 80)

    let sql = `
      SELECT
        rx.id, rx.barcode, rx.status, rx.issued_date, rx.created_at,
        p.first_name || ' ' || p.last_name  AS patient_name,
        p.tc_id                             AS patient_tc,
        d.first_name || ' ' || d.last_name  AS doctor_name,
        d.specialty                         AS doctor_specialty,
        COUNT(ri.id)                        AS item_count,
        MAX(CASE ri.status WHEN 'critical' THEN 2 WHEN 'warning' THEN 1 ELSE 0 END) AS sev_rank
      FROM prescriptions rx
      JOIN patients  p  ON rx.patient_id = p.id
      JOIN doctors   d  ON rx.doctor_id  = d.id
      LEFT JOIN rx_items ri ON ri.prescription_id = rx.id
    `
    const clauses = []
    const params = []
    if (safeStatus) {
      clauses.push('rx.status = ?')
      params.push(safeStatus)
    }
    if (safeSearch) {
      const like = `%${safeSearch}%`
      clauses.push(`(
        rx.barcode LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ?
        OR p.tc_id LIKE ? OR d.first_name LIKE ? OR d.last_name LIKE ?
      )`)
      params.push(like, like, like, like, like, like)
    }
    if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`
    sql += ' GROUP BY rx.id ORDER BY rx.created_at DESC LIMIT ? OFFSET ?'
    params.push(safeLimit, safeOffset)

    const rows = db.prepare(sql).all(...params).map(r => ({
      ...r,
      highest_severity: r.sev_rank === 2 ? 'critical' : r.sev_rank === 1 ? 'warning' : 'safe',
    }))

    let totalSql = `
      SELECT COUNT(*) AS c FROM prescriptions rx
      JOIN patients p ON rx.patient_id = p.id
      JOIN doctors d ON rx.doctor_id = d.id
    `
    const countParams = params.slice(0, -2)
    if (clauses.length) totalSql += ` WHERE ${clauses.join(' AND ')}`
    const totalRow = db.prepare(totalSql).get(...countParams)
    const total    = totalRow?.c ?? 0

    return { rows, total }
  })

  handle('db:prescriptions:getById', (id) => {
    expirePrescriptions()
    if (typeof id !== 'string' || !id.trim()) throw new Error('Geçersiz kayıt kimliği.')
    const rx = db.prepare(`
      SELECT rx.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        p.tc_id, p.date_of_birth, p.gender, p.blood_type, p.allergies,
        d.first_name || ' ' || d.last_name AS doctor_name,
        d.specialty, d.hospital, d.license_no
      FROM prescriptions rx
      JOIN patients p ON rx.patient_id = p.id
      JOIN doctors  d ON rx.doctor_id  = d.id
      WHERE rx.id = ?
    `).get(id)

    if (!rx) return null

    const items = db.prepare(`
      SELECT ri.*, dr.name AS drug_name, dr.generic_name, dr.category,
             dr.form, dr.strength, dr.controlled, dr.max_daily_dose, dr.dose_unit
      FROM rx_items ri
      JOIN drugs dr ON ri.drug_id = dr.id
      WHERE ri.prescription_id = ?
    `).all(id)

    const drugIds      = items.map(i => i.drug_id)
    const interactions = checkInteractions(drugIds)

    let allergies = []
    try {
      const parsedAllergies = JSON.parse(rx.allergies || '[]')
      allergies = Array.isArray(parsedAllergies) ? parsedAllergies : []
    } catch {
      allergies = []
    }
    audit('prescriptions', id, 'read', 'admin')

    return {
      ...rx,
      items,
      interactions,
      allergies,
    }
  })

  handle('db:prescriptions:create', (data) => {
    if (!isPlainObject(data)) throw new Error('Reçete bilgileri eksik.')

    const patientId = requiredText(data.patient_id, 'Hasta', 100)
    if (!db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId)) {
      throw new Error('Seçilen hasta kaydı bulunamadı.')
    }

    const issuedDate = String(data.issued_date ?? '').trim()
    if (!isValidDateKey(issuedDate)) throw new Error('Düzenlenme tarihi geçersiz.')
    const expiryDate = optionalText(data.expiry_date, 'Geçerlilik tarihi', 10)
    if (expiryDate && !isValidDateKey(expiryDate)) throw new Error('Geçerlilik tarihi geçersiz.')
    if (expiryDate && expiryDate < issuedDate) {
      throw new Error('Geçerlilik tarihi düzenlenme tarihinden önce olamaz.')
    }

    const status = 'pending'
    if (!Array.isArray(data.items) || data.items.length < 1) {
      throw new Error('Reçetede en az bir ilaç kalemi bulunmalıdır.')
    }
    if (data.items.length > 100) throw new Error('Bir reçeteye en fazla 100 ilaç kalemi eklenebilir.')

    let doctor = null
    let legacyDoctorId = null
    if (isPlainObject(data.doctor)) {
      doctor = {
        license_no: requiredText(data.doctor.license_no, 'Doktor sicil numarası', 60),
        first_name: requiredText(data.doctor.first_name, 'Doktor adı', 80),
        last_name: requiredText(data.doctor.last_name, 'Doktor soyadı', 80),
        specialty: optionalText(data.doctor.specialty, 'Uzmanlık alanı', 120),
        hospital: optionalText(data.doctor.hospital, 'Sağlık kuruluşu', 180),
      }
    } else if (data.doctor_id) {
      legacyDoctorId = requiredText(data.doctor_id, 'Doktor', 100)
      if (!db.prepare('SELECT id FROM doctors WHERE id = ?').get(legacyDoctorId)) {
        throw new Error('Seçilen doktor kaydı bulunamadı.')
      }
    } else {
      throw new Error('Doktor bilgileri zorunludur.')
    }

    const normalizedItems = data.items.map((item, index) => {
      if (!isPlainObject(item)) throw new Error(`${index + 1}. ilaç kalemi geçersiz.`)
      const quantity = Number(item.quantity)
      const durationDays = Number(item.duration_days)
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
        throw new Error(`${index + 1}. ilaç kaleminin miktarı geçersiz.`)
      }
      if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
        throw new Error(`${index + 1}. ilaç kaleminin kullanım süresi geçersiz.`)
      }

      let drug = null
      let legacyDrugId = null
      if (isPlainObject(item.drug)) {
        drug = {
          barcode: optionalText(item.drug.barcode, 'İlaç barkodu', 80),
          name: requiredText(item.drug.name, 'İlaç adı', 160),
          generic_name: optionalText(item.drug.generic_name, 'Etken madde', 160),
          category: optionalText(item.drug.category, 'İlaç kategorisi', 100),
          form: optionalText(item.drug.form, 'İlaç formu', 80),
          strength: optionalText(item.drug.strength, 'İlaç dozu', 80),
          manufacturer: optionalText(item.drug.manufacturer, 'Üretici', 160),
          controlled: normalizeBooleanFlag(item.drug.controlled, 'Kontrole tabi ilaç bilgisi'),
        }
      } else if (item.drug_id) {
        legacyDrugId = requiredText(item.drug_id, 'İlaç', 100)
        if (!db.prepare('SELECT id FROM drugs WHERE id = ?').get(legacyDrugId)) {
          throw new Error(`${index + 1}. ilaç kaydı bulunamadı.`)
        }
      } else {
        throw new Error(`${index + 1}. ilaç bilgileri zorunludur.`)
      }

      return {
        drug,
        legacyDrugId,
        quantity,
        unit: requiredText(item.unit, `${index + 1}. kalem birimi`, 40),
        frequency: requiredText(item.frequency, `${index + 1}. kalem kullanım sıklığı`, 100),
        duration_days: durationDays,
        instructions: optionalText(item.instructions, `${index + 1}. kalem kullanım talimatı`, 500),
      }
    })

    const id = uid()
    let barcode
    do {
      barcode = `RX-${randomUUID().replace(/-/g, '').toUpperCase()}`
    } while (db.prepare('SELECT 1 AS found FROM prescriptions WHERE barcode = ?').get(barcode))

    db.transaction(() => {
      let doctorId = legacyDoctorId
      if (doctor) {
        const existingDoctor = db.prepare('SELECT * FROM doctors WHERE license_no = ?')
          .get(doctor.license_no)
        doctorId = existingDoctor?.id || uid()
        if (existingDoctor) {
          if (!sameText(existingDoctor.first_name, doctor.first_name)
            || !sameText(existingDoctor.last_name, doctor.last_name)) {
            throw new Error('Bu hekim sicil numarası farklı bir ad soyadla kayıtlıdır.')
          }
          for (const [field, label] of [['specialty', 'uzmanlık'], ['hospital', 'kurum']]) {
            if (existingDoctor[field] && doctor[field] && !sameText(existingDoctor[field], doctor[field])) {
              throw new Error(`Bu hekim sicil numarası farklı bir ${label} bilgisiyle kayıtlıdır.`)
            }
          }
          db.prepare(
            `UPDATE doctors SET specialty=COALESCE(specialty,?), hospital=COALESCE(hospital,?)
             WHERE id=?`
          ).run(doctor.specialty, doctor.hospital, doctorId)
        } else {
          db.prepare(
            `INSERT INTO doctors (id,license_no,first_name,last_name,specialty,hospital)
             VALUES (?,?,?,?,?,?)`
          ).run(
            doctorId, doctor.license_no, doctor.first_name, doctor.last_name,
            doctor.specialty, doctor.hospital,
          )
          audit('doctors', doctorId, 'create', 'admin', { source: 'prescription' })
        }
      }

      db.prepare(
        `INSERT INTO prescriptions
           (id,barcode,patient_id,doctor_id,issued_date,expiry_date,status,diagnosis_code,notes)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(
        id, barcode, patientId, doctorId, issuedDate, expiryDate, status,
        optionalText(data.diagnosis_code, 'Tanı kodu', 80),
        optionalText(data.notes, 'Reçete notu', 1000),
      )

      const prescriptionDrugIds = []
      for (const item of normalizedItems) {
        let drugId = item.legacyDrugId
        if (item.drug) {
          const existingDrug = item.drug.barcode
            ? db.prepare('SELECT * FROM drugs WHERE barcode = ?').get(item.drug.barcode)
            : db.prepare(
              `SELECT * FROM drugs
               WHERE barcode IS NULL
                 AND lower(trim(name)) = lower(trim(?))
                 AND lower(trim(COALESCE(generic_name,''))) = lower(trim(COALESCE(?,'')))
                 AND lower(trim(COALESCE(form,''))) = lower(trim(COALESCE(?,'')))
                 AND lower(trim(COALESCE(strength,''))) = lower(trim(COALESCE(?,'')))
               LIMIT 1`
            ).get(item.drug.name, item.drug.generic_name, item.drug.form, item.drug.strength)
          drugId = existingDrug?.id || uid()
          if (existingDrug) {
            if (!sameText(existingDrug.name, item.drug.name)) {
              throw new Error(`Barkod ${item.drug.barcode} farklı bir ilaç adıyla kayıtlıdır.`)
            }
            for (const [field, label] of [
              ['generic_name', 'etken madde'],
              ['category', 'kategori'],
              ['form', 'form'],
              ['strength', 'doz/güç'],
              ['manufacturer', 'üretici'],
            ]) {
              if (existingDrug[field] && item.drug[field]
                && !sameText(existingDrug[field], item.drug[field])) {
                throw new Error(`${item.drug.name} farklı bir ${label} bilgisiyle kayıtlıdır.`)
              }
            }
            if (Number(existingDrug.controlled || 0) !== Number(item.drug.controlled || 0)) {
              throw new Error(`${item.drug.name} için kontrole tabi ilaç bilgisi mevcut kayıtla uyuşmuyor.`)
            }
            db.prepare(
              `UPDATE drugs SET generic_name=COALESCE(generic_name,?), category=COALESCE(category,?),
                form=COALESCE(form,?), strength=COALESCE(strength,?), manufacturer=COALESCE(manufacturer,?)
               WHERE id=?`
            ).run(
              item.drug.generic_name, item.drug.category, item.drug.form,
              item.drug.strength, item.drug.manufacturer, drugId,
            )
          } else {
            db.prepare(
              `INSERT INTO drugs
                 (id,barcode,name,generic_name,category,form,strength,manufacturer,controlled)
               VALUES (?,?,?,?,?,?,?,?,?)`
            ).run(
              drugId, item.drug.barcode, item.drug.name, item.drug.generic_name,
              item.drug.category, item.drug.form, item.drug.strength,
              item.drug.manufacturer, item.drug.controlled,
            )
            audit('drugs', drugId, 'create', 'admin', { source: 'prescription' })
          }
        }

        db.prepare(
          `INSERT INTO rx_items
             (id,prescription_id,drug_id,quantity,unit,frequency,duration_days,instructions)
           VALUES (?,?,?,?,?,?,?,?)`
        ).run(
          uid(), id, drugId, item.quantity, item.unit, item.frequency,
          item.duration_days, item.instructions,
        )
        prescriptionDrugIds.push(drugId)
      }

      const interactions = checkInteractions([...new Set(prescriptionDrugIds)])
      const alertRanks = new Map()
      for (const interaction of interactions) {
        const rank = interaction.severity === 'critical' ? 2 : interaction.severity === 'warning' ? 1 : 0
        if (!rank) continue
        for (const drugId of [interaction.drug_a_id, interaction.drug_b_id]) {
          alertRanks.set(drugId, Math.max(alertRanks.get(drugId) || 0, rank))
        }
      }
      for (const [drugId, rank] of alertRanks) {
        db.prepare(
          `UPDATE rx_items SET status=? WHERE prescription_id=? AND drug_id=?`
        ).run(rank === 2 ? 'critical' : 'warning', id, drugId)
      }

      audit('prescriptions', id, 'create', 'admin', {
        itemCount: normalizedItems.length,
        interactionCount: interactions.length,
        status,
      })
    })()

    return { id, barcode }
  })

  handle('db:prescriptions:update', (id, data) => {
    expirePrescriptions()
    if (typeof id !== 'string' || !id.trim()) throw new Error('Geçersiz kayıt kimliği.')
    if (!isPlainObject(data)) throw new Error('Güncellenecek bilgi bulunamadı.')

    const existing = db.prepare('SELECT id,status FROM prescriptions WHERE id = ?').get(id)
    if (!existing) throw new Error('Reçete kaydı bulunamadı.')

    if (data.status && !PRESCRIPTION_STATUSES.includes(data.status)) {
      throw new Error('Geçersiz reçete durumu.')
    }

    const normalized = {}
    if (Object.hasOwn(data, 'notes')) normalized.notes = optionalText(data.notes, 'Reçete notu', 1000)
    if (data.status) {
      const allowedTransitions = {
        pending: ['verified', 'rejected'],
        verified: ['dispensed'],
      }
      if (!allowedTransitions[existing.status]?.includes(data.status)) {
        throw new Error(`${existing.status} durumundaki reçete ${data.status} durumuna geçirilemez.`)
      }
      normalized.status = data.status
      if (data.status === 'verified') {
        normalized.verified_by = 'admin'
        normalized.verified_at = new Date().toISOString()
      }
    }

    const fields = Object.keys(normalized)
    if (!fields.length) throw new Error('Güncellenecek geçerli alan bulunamadı.')

    const sets   = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => normalized[f])

    db.transaction(() => {
      const result = db.prepare(
        `UPDATE prescriptions SET ${sets}, updated_at = datetime('now') WHERE id = ?`
      ).run(...values, id)
      if (result.changes !== 1) throw new Error('Reçete güncellenemedi.')
      audit('prescriptions', id, 'update', 'admin', {
        previousStatus: existing.status,
        nextStatus: normalized.status || existing.status,
        changedFields: fields,
      })
    })()
    return { id }
  })

  handle('db:prescriptions:delete', (id) => {
    if (typeof id !== 'string' || !id.trim()) throw new Error('Geçersiz kayıt kimliği.')
    db.transaction(() => {
      const result = db.prepare('DELETE FROM prescriptions WHERE id = ?').run(id)
      if (result.changes !== 1) throw new Error('Reçete kaydı bulunamadı.')
      audit('prescriptions', id, 'delete', 'admin')
    })()
    return { id }
  })

  handle('db:prescriptions:search', (query) => {
    const safeQuery = String(query || '').trim().slice(0, 80)
    if (!safeQuery) return []
    const like = `%${safeQuery}%`
    return db.prepare(`
      SELECT rx.id, rx.barcode, rx.status, rx.issued_date,
             p.first_name || ' ' || p.last_name AS patient_name, p.tc_id,
             d.first_name || ' ' || d.last_name AS doctor_name
      FROM prescriptions rx
      JOIN patients p ON rx.patient_id = p.id
      JOIN doctors  d ON rx.doctor_id  = d.id
      WHERE rx.barcode LIKE ?
         OR p.first_name LIKE ? OR p.last_name LIKE ?
         OR p.tc_id      LIKE ? OR d.last_name LIKE ?
      ORDER BY rx.created_at DESC LIMIT 20
    `).all(like, like, like, like, like)
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  PATIENTS
  // ══════════════════════════════════════════════════════════════════════════

  handle('db:patients:getAll', ({ limit = 50, offset = 0, search = '' } = {}) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100)
    const safeOffset = Math.max(Number(offset) || 0, 0)
    const safeSearch = String(search || '').trim().slice(0, 80)
    const where = safeSearch
      ? `WHERE tc_id LIKE ? OR first_name LIKE ? OR last_name LIKE ?
         OR phone LIKE ? OR email LIKE ?`
      : ''
    const filterParams = safeSearch ? Array(5).fill(`%${safeSearch}%`) : []
    const rows = db.prepare(
      `SELECT * FROM patients ${where}
       ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE, id
       LIMIT ? OFFSET ?`
    ).all(...filterParams, safeLimit, safeOffset).map((patient) => ({
      ...patient,
      allergies: (() => {
        try {
          const parsed = JSON.parse(patient.allergies || '[]')
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      })(),
    }))
    const total = db.prepare(`SELECT COUNT(*) AS c FROM patients ${where}`)
      .get(...filterParams)?.c ?? 0
    return { rows, total }
  })

  handle('db:patients:getById', (id) => {
    if (typeof id !== 'string' || !id.trim()) throw new Error('Geçersiz hasta kayıt kimliği.')
    const p = db.prepare('SELECT * FROM patients WHERE id = ?').get(id)
    if (p) {
      try {
        const parsed = JSON.parse(p.allergies || '[]')
        p.allergies = Array.isArray(parsed) ? parsed : []
      } catch {
        p.allergies = []
      }
      audit('patients', id, 'read', 'admin')
    }
    return p
  })

  handle('db:patients:create', (data) => {
    const patient = normalizePatient(data)
    if (db.prepare('SELECT id FROM patients WHERE tc_id = ?').get(patient.tc_id)) {
      throw new Error('Bu T.C. kimlik numarasıyla kayıtlı bir hasta zaten var.')
    }
    const id = uid()
    db.transaction(() => {
      db.prepare(
        `INSERT INTO patients (id,tc_id,first_name,last_name,date_of_birth,gender,blood_type,phone,email,allergies)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).run(
        id, patient.tc_id, patient.first_name, patient.last_name,
        patient.date_of_birth, patient.gender, patient.blood_type,
        patient.phone, patient.email, JSON.stringify(patient.allergies),
      )
      audit('patients', id, 'create', 'admin', { changedFields: Object.keys(patient) })
    })()
    return { id }
  })

  handle('db:patients:update', (id, data) => {
    if (typeof id !== 'string' || !id.trim()) throw new Error('Geçersiz hasta kayıt kimliği.')
    if (!isPlainObject(data)) throw new Error('Güncellenecek hasta bilgileri eksik.')
    const existing = db.prepare('SELECT * FROM patients WHERE id = ?').get(id)
    if (!existing) throw new Error('Hasta kaydı bulunamadı.')
    let existingAllergies = []
    try {
      const parsed = JSON.parse(existing.allergies || '[]')
      existingAllergies = Array.isArray(parsed) ? parsed : []
    } catch {
      existingAllergies = []
    }
    const patient = normalizePatient({ ...existing, allergies: existingAllergies, ...data })
    const duplicate = db.prepare('SELECT id FROM patients WHERE tc_id = ? AND id <> ?')
      .get(patient.tc_id, id)
    if (duplicate) throw new Error('Bu T.C. kimlik numarasıyla kayıtlı başka bir hasta var.')

    const changedFields = Object.keys(patient).filter((field) => {
      if (field === 'allergies') return JSON.stringify(patient.allergies) !== JSON.stringify(existingAllergies)
      return (patient[field] ?? null) !== (existing[field] ?? null)
    })

    db.transaction(() => {
      db.prepare(
        `UPDATE patients SET tc_id=?,first_name=?,last_name=?,date_of_birth=?,gender=?,
          blood_type=?,phone=?,email=?,allergies=?,updated_at=datetime('now') WHERE id=?`
      ).run(
        patient.tc_id, patient.first_name, patient.last_name, patient.date_of_birth,
        patient.gender, patient.blood_type, patient.phone, patient.email,
        JSON.stringify(patient.allergies), id,
      )
      audit('patients', id, 'update', 'admin', { changedFields })
    })()
    return { id }
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  DRUGS
  // ══════════════════════════════════════════════════════════════════════════

  handle('db:drugs:getAll', ({ limit = 100, offset = 0 } = {}) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200)
    const safeOffset = Math.max(Number(offset) || 0, 0)
    const rows  = db.prepare('SELECT * FROM drugs ORDER BY name LIMIT ? OFFSET ?').all(safeLimit, safeOffset)
    const total = db.prepare('SELECT COUNT(*) AS c FROM drugs').get()?.c ?? 0
    return { rows, total }
  })

  handle('db:drugs:search', (query) => {
    const safeQuery = String(query || '').trim().slice(0, 80)
    if (!safeQuery) return []
    const like = `%${safeQuery}%`
    return db.prepare(
      `SELECT * FROM drugs WHERE name LIKE ? OR generic_name LIKE ? OR barcode LIKE ? OR category LIKE ? ORDER BY name LIMIT 20`
    ).all(like, like, like, like)
  })

  handle('db:drugs:checkInteractions', (drugIds) => {
    if (!Array.isArray(drugIds) || drugIds.length > 100) throw new Error('İlaç listesi geçersiz.')
    return checkInteractions(drugIds.filter(id => typeof id === 'string'))
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  AUDIT LOG
  // ══════════════════════════════════════════════════════════════════════════

  handle('db:audit:getAll', ({
    limit = 50,
    offset = 0,
    search = '',
    entity = '',
    entityType = '',
    action = '',
    date = '',
    startDate = '',
    endDate = '',
    dateFrom = '',
    dateTo = '',
  } = {}) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100)
    const safeOffset = Math.max(Number(offset) || 0, 0)
    const safeSearch = String(search || '').trim().slice(0, 80)
    const safeEntity = String(entity || entityType || '').trim().slice(0, 60)
    const safeAction = String(action || '').trim().slice(0, 60)
    const safeDate = String(date || '').trim()
    const rangeStart = String(startDate || dateFrom || '').trim()
    const rangeEnd = String(endDate || dateTo || '').trim()
    const clauses = []
    const params = []

    if (safeSearch) {
      const like = `%${safeSearch}%`
      clauses.push(`(entity_type LIKE ? OR entity_id LIKE ? OR action LIKE ? OR actor LIKE ? OR details LIKE ?)`)
      params.push(like, like, like, like, like)
    }
    if (safeEntity) {
      clauses.push('entity_type = ?')
      params.push(safeEntity)
    }
    if (safeAction) {
      clauses.push('action = ?')
      params.push(safeAction)
    }
    if (safeDate) {
      if (!isValidDateKey(safeDate)) throw new Error('Denetim tarihi geçersiz.')
      clauses.push(`date(timestamp, 'localtime') = ?`)
      params.push(safeDate)
    } else if (rangeStart || rangeEnd) {
      if (rangeStart && rangeEnd) {
        parseDateRange(rangeStart, rangeEnd)
        clauses.push(`date(timestamp, 'localtime') BETWEEN ? AND ?`)
        params.push(rangeStart, rangeEnd)
      } else if (rangeStart) {
        if (!isValidDateKey(rangeStart)) throw new Error('Başlangıç tarihi geçersiz.')
        clauses.push(`date(timestamp, 'localtime') >= ?`)
        params.push(rangeStart)
      } else {
        if (!isValidDateKey(rangeEnd)) throw new Error('Bitiş tarihi geçersiz.')
        clauses.push(`date(timestamp, 'localtime') <= ?`)
        params.push(rangeEnd)
      }
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = db.prepare(
      `SELECT id, entity_type, entity_id, action, actor, details, timestamp
       FROM audit_log ${where}
       ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`
    ).all(...params, safeLimit, safeOffset).map((row) => ({
      ...row,
      details: parseAuditDetails(row.details),
    }))
    const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_log ${where}`)
      .get(...params)?.c ?? 0
    return { rows, total }
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════

  handle('db:analytics:getDailySummary', () => {
    expirePrescriptions()
    const today = localDateKey()

    const get = (sql, ...p) => db.prepare(sql).get(...p)?.c ?? 0

    const total     = get(`SELECT COUNT(*) AS c FROM prescriptions WHERE date(created_at, 'localtime') = ?`, today)
    const pending   = get(`SELECT COUNT(*) AS c FROM prescriptions WHERE status='pending'   AND date(created_at, 'localtime')=?`, today)
    const verified  = get(`SELECT COUNT(*) AS c FROM prescriptions WHERE status='verified'  AND date(created_at, 'localtime')=?`, today)
    const dispensed = get(`SELECT COUNT(*) AS c FROM prescriptions WHERE status='dispensed' AND date(created_at, 'localtime')=?`, today)
    const critical  = get(`
      SELECT COUNT(*) AS c FROM rx_items ri
      JOIN prescriptions rx ON rx.id = ri.prescription_id
      WHERE ri.status='critical' AND date(rx.created_at, 'localtime')=?
    `, today)
    const warnings  = get(`
      SELECT COUNT(*) AS c FROM rx_items ri
      JOIN prescriptions rx ON rx.id = ri.prescription_id
      WHERE ri.status='warning' AND date(rx.created_at, 'localtime')=?
    `, today)

    const trend = db.prepare(
      `SELECT date(created_at, 'localtime') AS date, COUNT(*) AS count
       FROM prescriptions
       WHERE datetime(created_at, 'localtime') >= datetime('now','localtime','-7 days')
       GROUP BY date(created_at, 'localtime')
       ORDER BY date ASC`
    ).all()

    return { total, pending, verified, dispensed, critical, warnings, trend }
  })

  handle('db:analytics:getTopCategories', () =>
    db.prepare(
      `SELECT d.category, COUNT(ri.id) AS count
       FROM rx_items ri JOIN drugs d ON ri.drug_id = d.id
       GROUP BY d.category ORDER BY count DESC LIMIT 8`
    ).all()
  )

  handle('db:analytics:getAlerts', (limit = 20) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100)
    return (
    db.prepare(
      `SELECT ri.id, ri.status,
              d.name AS drug_name, d.generic_name,
              rx.barcode AS prescription_barcode,
              p.first_name || ' ' || p.last_name AS patient_name,
              rx.created_at
       FROM rx_items ri
       JOIN drugs d         ON ri.drug_id         = d.id
       JOIN prescriptions rx ON ri.prescription_id = rx.id
       JOIN patients p       ON rx.patient_id      = p.id
       WHERE ri.status IN ('critical','warning')
       ORDER BY CASE ri.status WHEN 'critical' THEN 0 ELSE 1 END, rx.created_at DESC
       LIMIT ?`
    ).all(safeLimit)
    )
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  REPORTS
  // ══════════════════════════════════════════════════════════════════════════

  handle('db:reports:generateDaily', (date) => {
    expirePrescriptions()
    const d = date || localDateKey()
    if (!isValidDateKey(d)) {
      throw new Error('Geçerli bir rapor tarihi seçin.')
    }

    const prescriptions = db.prepare(
      `SELECT rx.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              dr.first_name || ' ' || dr.last_name AS doctor_name, dr.specialty
       FROM prescriptions rx
       JOIN patients p ON rx.patient_id = p.id
       JOIN doctors  dr ON rx.doctor_id = dr.id
       WHERE rx.issued_date = ?
       ORDER BY rx.created_at
       LIMIT ?`
    ).all(d, REPORT_ROW_LIMIT)

    const alerts = db.prepare(
      `SELECT ri.status, d.name AS drug_name,
              rx.barcode,
              p.first_name || ' ' || p.last_name AS patient_name
       FROM rx_items ri
       JOIN drugs d ON ri.drug_id = d.id
       JOIN prescriptions rx ON ri.prescription_id = rx.id
       JOIN patients p ON rx.patient_id = p.id
       WHERE rx.issued_date = ? AND ri.status != 'safe'
       LIMIT ?`
    ).all(d, REPORT_ROW_LIMIT)

    return { date: d, prescriptions, alerts, generatedAt: new Date().toISOString() }
  })

  handle('db:reports:generateRange', ({ startDate, endDate } = {}) => {
    expirePrescriptions()
    const range = parseDateRange(
      String(startDate || '').trim(),
      String(endDate || '').trim(),
      { maxDays: 366 },
    )

    const prescriptionCount = db.prepare(
      `SELECT COUNT(*) AS c FROM prescriptions WHERE issued_date BETWEEN ? AND ?`
    ).get(range.startDate, range.endDate)?.c ?? 0

    const prescriptions = db.prepare(
      `SELECT rx.id, rx.barcode, rx.issued_date, rx.expiry_date, rx.status,
              rx.diagnosis_code, rx.created_at,
              p.first_name || ' ' || p.last_name AS patient_name,
              d.first_name || ' ' || d.last_name AS doctor_name,
              d.specialty, COUNT(ri.id) AS item_count
       FROM prescriptions rx
       JOIN patients p ON rx.patient_id = p.id
       JOIN doctors d ON rx.doctor_id = d.id
       LEFT JOIN rx_items ri ON ri.prescription_id = rx.id
       WHERE rx.issued_date BETWEEN ? AND ?
       GROUP BY rx.id
       ORDER BY rx.issued_date DESC, rx.created_at DESC
       LIMIT ?`
    ).all(range.startDate, range.endDate, REPORT_ROW_LIMIT)

    const statusRows = db.prepare(
      `SELECT status, COUNT(*) AS count
       FROM prescriptions
       WHERE issued_date BETWEEN ? AND ?
       GROUP BY status`
    ).all(range.startDate, range.endDate)
    const statuses = Object.fromEntries(PRESCRIPTION_STATUSES.map((status) => [status, 0]))
    for (const row of statusRows) {
      if (Object.hasOwn(statuses, row.status)) statuses[row.status] = row.count
    }

    const patientCount = db.prepare(
      `SELECT COUNT(DISTINCT patient_id) AS c FROM prescriptions
       WHERE issued_date BETWEEN ? AND ?`
    ).get(range.startDate, range.endDate)?.c ?? 0
    const auditCount = db.prepare(
      `SELECT COUNT(*) AS c FROM audit_log
       WHERE date(timestamp, 'localtime') BETWEEN ? AND ?`
    ).get(range.startDate, range.endDate)?.c ?? 0

    const alertCount = db.prepare(
      `SELECT COUNT(*) AS c FROM rx_items ri
       JOIN prescriptions rx ON ri.prescription_id = rx.id
       WHERE rx.issued_date BETWEEN ? AND ? AND ri.status IN ('critical', 'warning')`
    ).get(range.startDate, range.endDate)?.c ?? 0

    const alerts = db.prepare(
      `SELECT ri.id, ri.status, d.name AS drug_name, d.generic_name,
              rx.id AS prescription_id, rx.barcode AS prescription_barcode,
              rx.issued_date,
              p.first_name || ' ' || p.last_name AS patient_name
       FROM rx_items ri
       JOIN drugs d ON ri.drug_id = d.id
       JOIN prescriptions rx ON ri.prescription_id = rx.id
       JOIN patients p ON rx.patient_id = p.id
       WHERE rx.issued_date BETWEEN ? AND ?
         AND ri.status IN ('critical', 'warning')
       ORDER BY CASE ri.status WHEN 'critical' THEN 0 ELSE 1 END,
                rx.issued_date DESC, ri.id
       LIMIT ?`
    ).all(range.startDate, range.endDate, REPORT_ROW_LIMIT)

    audit('reports', `${range.startDate}:${range.endDate}`, 'read', 'admin', {
      startDate: range.startDate,
      endDate: range.endDate,
      prescriptionCount,
    })

    return {
      startDate: range.startDate,
      endDate: range.endDate,
      generatedAt: new Date().toISOString(),
      summary: {
        prescriptionCount,
        patientCount,
        auditCount,
        alertCount,
      },
      limits: {
        rowLimit: REPORT_ROW_LIMIT,
        prescriptionsTruncated: prescriptionCount > prescriptions.length,
        alertsTruncated: alertCount > alerts.length,
      },
      statuses,
      prescriptions,
      alerts,
    }
  })
}
