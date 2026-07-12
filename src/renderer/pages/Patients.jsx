import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

const PAGE_SIZE = 20
const EMPTY_FORM = {
  tc_id: '',
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  blood_type: '',
  phone: '',
  email: '',
  allergies: '',
}

const GENDER_OPTIONS = [
  { value: '', label: 'Belirtilmedi' },
  { value: 'F', label: 'Kadın' },
  { value: 'M', label: 'Erkek' },
]

const GENDER_LABELS = {
  F: 'Kadın',
  female: 'Kadın',
  woman: 'Kadın',
  M: 'Erkek',
  male: 'Erkek',
  man: 'Erkek',
}

const BLOOD_TYPE_OPTIONS = [
  '',
  'A Rh+',
  'A Rh-',
  'B Rh+',
  'B Rh-',
  'AB Rh+',
  'AB Rh-',
  '0 Rh+',
  '0 Rh-',
]

function databaseApiAvailable() {
  return Boolean(
    typeof window !== 'undefined'
    && typeof window.eTakip?.db?.patients?.getAll === 'function'
    && typeof window.eTakip?.db?.patients?.getById === 'function'
    && typeof window.eTakip?.db?.patients?.create === 'function'
    && typeof window.eTakip?.db?.patients?.update === 'function'
  )
}

function assertSuccessfulResponse(response, defaultMessage) {
  if (!response?.success) {
    throw new Error(response?.error || defaultMessage)
  }
  return response.data
}

function displayValue(value) {
  return value === null || value === undefined || value === '' ? '—' : value
}

function maskIdentifier(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return '—'
  if (digits.length <= 4) return '•'.repeat(digits.length)
  return `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`
}

function isValidTcId(value) {
  if (!/^\d{11}$/.test(value) || value.startsWith('0')) return false
  const digits = [...value].map(Number)
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7]
  const tenth = (((oddSum * 7) - evenSum) % 10 + 10) % 10
  const eleventh = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10
  return digits[9] === tenth && digits[10] === eleventh
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits ? `••• ••• ${digits.slice(-4).padStart(4, '•')}` : '—'
}

function maskEmail(value) {
  const [local, domain] = String(value || '').split('@')
  if (!local || !domain) return '—'
  return `${local.charAt(0)}•••@${domain}`
}

function formatDate(value) {
  if (!value) return '—'
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? `${value}T00:00:00`
    : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatBirthYear(value) {
  const formatted = formatDate(value)
  return formatted === '—' ? formatted : String(value).slice(0, 4)
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeAllergies(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (!value) return ''

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.join(', ')
    } catch {
      return value
    }
  }

  return String(value)
}

function allergiesToArray(value) {
  const seen = new Set()
  return String(value || '')
    .split(',')
    .map((allergy) => allergy.trim())
    .filter((allergy) => {
      if (!allergy) return false
      const key = allergy.toLocaleLowerCase('tr-TR')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function patientToForm(patient) {
  return {
    tc_id: String(patient?.tc_id || ''),
    first_name: String(patient?.first_name || ''),
    last_name: String(patient?.last_name || ''),
    date_of_birth: String(patient?.date_of_birth || ''),
    gender: String(patient?.gender || ''),
    blood_type: String(patient?.blood_type || ''),
    phone: String(patient?.phone || ''),
    email: String(patient?.email || ''),
    allergies: normalizeAllergies(patient?.allergies),
  }
}

function validateForm(form) {
  const errors = {}
  const tcId = form.tc_id.trim()
  const firstName = form.first_name.trim()
  const lastName = form.last_name.trim()

  if (!isValidTcId(tcId)) {
    errors.tc_id = 'Geçerli bir T.C. kimlik numarası girin.'
  }
  if (!firstName) errors.first_name = 'Ad alanı zorunludur.'
  if (!lastName) errors.last_name = 'Soyad alanı zorunludur.'

  if (form.date_of_birth) {
    const birthDate = new Date(`${form.date_of_birth}T00:00:00`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (Number.isNaN(birthDate.getTime())) {
      errors.date_of_birth = 'Geçerli bir doğum tarihi girin.'
    } else if (birthDate > today) {
      errors.date_of_birth = 'Doğum tarihi gelecekte olamaz.'
    }
  }

  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Geçerli bir e-posta adresi girin.'
  }

  if (form.phone.trim()) {
    const phone = form.phone.trim()
    const digitCount = phone.replace(/\D/g, '').length
    if (!/^\+?[0-9 ()-]+$/.test(phone) || digitCount < 7 || digitCount > 15) {
      errors.phone = 'Geçerli bir telefon numarası girin.'
    }
  }


  const allergies = allergiesToArray(form.allergies)
  if (allergies.length > 100) {
    errors.allergies = 'En fazla 100 alerji kaydı girilebilir.'
  } else if (allergies.some((allergy) => allergy.length > 120)) {
    errors.allergies = 'Her alerji bilgisi en fazla 120 karakter olabilir.'
  }

  return errors
}

function getSaveErrorMessage(error) {
  const rawMessage = error instanceof Error ? error.message : ''
  const normalized = rawMessage.toLocaleLowerCase('tr-TR')
  if ((normalized.includes('unique') && normalized.includes('tc_id'))
    || normalized.includes('kayıtlı bir hasta zaten var')
    || normalized.includes('kayıtlı başka bir hasta var')) {
    return 'Bu T.C. kimlik numarasıyla daha önce hasta kaydı oluşturulmuş.'
  }
  return 'Hasta kaydı veritabanına yazılamadı. Bilgileri kontrol edip yeniden deneyin.'
}

function TableState({ title, message, role = 'status', action }) {
  return (
    <tr className="data-table__state">
      <td colSpan="6">
        <div className="empty-state" role={role}>
          <h3>{title}</h3>
          <p>{message}</p>
          {action}
        </div>
      </td>
    </tr>
  )
}

function FormField({
  id,
  label,
  required = false,
  error,
  hint,
  children,
}) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={`form-field ${error ? 'form-field--error' : ''}`}>
      <label className="form-label" htmlFor={id}>
        {label}{required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {React.cloneElement(children, {
        id,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': descriptionId,
      })}
      {error ? (
        <p className="field-message field-message--error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-message" id={`${id}-hint`}>{hint}</p>
      ) : null}
    </div>
  )
}

export default function Patients() {
  const { addToast } = useApp()
  const integrationAvailable = databaseApiAvailable()
  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [listLoading, setListLoading] = useState(integrationAvailable)
  const [listError, setListError] = useState('')
  const [panelMode, setPanelMode] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const listRequestRef = useRef(0)
  const detailRequestRef = useRef(0)
  const originalFormRef = useRef(EMPTY_FORM)

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstRecord = total === 0 ? 0 : page * PAGE_SIZE + 1
  const lastRecord = Math.min((page + 1) * PAGE_SIZE, total)
  const hasSearch = Boolean(search.trim())
  const hasUnsavedChanges = Boolean(panelMode)
    && JSON.stringify(form) !== JSON.stringify(originalFormRef.current)

  const loadPatients = useCallback(async ({
    requestedPage = page,
    requestedSearch = search,
  } = {}) => {
    const requestId = ++listRequestRef.current

    if (!databaseApiAvailable()) {
      setPatients([])
      setTotal(0)
      setListError('')
      setListLoading(false)
      return false
    }

    setListLoading(true)
    setListError('')

    try {
      const response = await window.eTakip.db.patients.getAll({
        limit: PAGE_SIZE,
        offset: requestedPage * PAGE_SIZE,
        search: requestedSearch.trim() || undefined,
      })
      const data = assertSuccessfulResponse(response, 'Hasta kayıtları alınamadı.')
      if (requestId !== listRequestRef.current) return false

      const rows = Array.isArray(data?.rows) ? data.rows : []
      const rowCount = Number(data?.total)
      setPatients(rows)
      setTotal(Number.isFinite(rowCount) && rowCount >= 0 ? rowCount : 0)
      return true
    } catch (error) {
      if (requestId !== listRequestRef.current) return false
      console.error('[Hastalar] Liste alınamadı:', error)
      setPatients([])
      setTotal(0)
      setListError('Hasta kayıtları alınamadı. Lütfen yeniden deneyin.')
      return false
    } finally {
      if (requestId === listRequestRef.current) setListLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const delay = search.trim() ? 250 : 0
    const timer = window.setTimeout(() => loadPatients(), delay)
    return () => window.clearTimeout(timer)
  }, [loadPatients, search])

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined
    const warnBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const confirmInternalNavigation = (event) => {
      const anchor = event.target.closest?.('a[href^="#/"]')
      if (anchor && !window.confirm('Kaydedilmemiş hasta bilgileri silinecek. Sayfadan ayrılmak istiyor musunuz?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    document.addEventListener('click', confirmInternalNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload)
      document.removeEventListener('click', confirmInternalNavigation, true)
    }
  }, [hasUnsavedChanges])

  const confirmDiscardChanges = () => !hasUnsavedChanges
    || window.confirm('Kaydedilmemiş hasta bilgileri silinecek. Devam etmek istiyor musunuz?')

  const closePanel = () => {
    detailRequestRef.current += 1
    setPanelMode(null)
    setEditingId(null)
    setDetailLoading(false)
    setDetailError('')
    setForm(EMPTY_FORM)
    originalFormRef.current = EMPTY_FORM
    setFormErrors({})
    setSaveError('')
  }

  const openCreatePanel = () => {
    if (!confirmDiscardChanges()) return
    detailRequestRef.current += 1
    setPanelMode('create')
    setEditingId(null)
    setDetailLoading(false)
    setDetailError('')
    setForm(EMPTY_FORM)
    originalFormRef.current = EMPTY_FORM
    setFormErrors({})
    setSaveError('')
  }

  const openEditPanel = async (id) => {
    if (!id || !integrationAvailable) return
    if (!confirmDiscardChanges()) return

    const requestId = ++detailRequestRef.current
    setPanelMode('edit')
    setEditingId(id)
    setDetailLoading(true)
    setDetailError('')
    setSaveError('')
    setFormErrors({})
    setForm(EMPTY_FORM)
    originalFormRef.current = EMPTY_FORM

    try {
      const response = await window.eTakip.db.patients.getById(id)
      const patient = assertSuccessfulResponse(response, 'Hasta bilgileri alınamadı.')
      if (requestId !== detailRequestRef.current) return
      if (!patient || typeof patient !== 'object') throw new Error('Hasta kaydı bulunamadı.')
      const nextForm = patientToForm(patient)
      originalFormRef.current = nextForm
      setForm(nextForm)
    } catch (error) {
      if (requestId !== detailRequestRef.current) return
      console.error('[Hastalar] Ayrıntı alınamadı:', error)
      setDetailError('Hasta bilgileri alınamadı. Lütfen yeniden deneyin.')
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false)
    }
  }

  const changePage = (nextPage) => {
    const boundedPage = Math.min(Math.max(nextPage, 0), pageCount - 1)
    if (boundedPage === page) return
    if (!confirmDiscardChanges()) return
    closePanel()
    setPage(boundedPage)
  }

  const handleSearchChange = (event) => {
    if (!confirmDiscardChanges()) return
    setSearch(event.target.value)
    setPage(0)
    closePanel()
  }

  const clearSearch = () => {
    if (!confirmDiscardChanges()) return
    setSearch('')
    setPage(0)
    closePanel()
  }

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFormErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setSaveError('')
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!integrationAvailable || saving || detailLoading) return

    const nextErrors = validateForm(form)
    setFormErrors(nextErrors)
    setSaveError('')
    if (Object.keys(nextErrors).length > 0) return

    const payload = {
      tc_id: form.tc_id.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      blood_type: form.blood_type || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      allergies: allergiesToArray(form.allergies),
    }

    setSaving(true)
    try {
      const response = panelMode === 'create'
        ? await window.eTakip.db.patients.create(payload)
        : await window.eTakip.db.patients.update(editingId, payload)
      assertSuccessfulResponse(response, 'Hasta kaydı kaydedilemedi.')

      const listRefreshed = await loadPatients()
      if (!listRefreshed) {
        closePanel()
        addToast({
          type: 'warning',
          title: 'Liste yenilenemedi',
          message: 'Hasta kaydedildi; güncel liste alınamadı.',
        })
        return
      }

      const wasCreate = panelMode === 'create'
      closePanel()
      addToast({
        type: 'success',
        title: wasCreate ? 'Hasta kaydı oluşturuldu' : 'Hasta kaydı güncellendi',
        message: wasCreate
          ? 'Hasta bilgileri veritabanına kaydedildi.'
          : 'Hasta bilgilerindeki değişiklikler kaydedildi.',
      })
    } catch (error) {
      console.error('[Hastalar] Kayıt kaydedilemedi:', error)
      setSaveError(getSaveErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-shell patients-page" aria-labelledby="patients-title">
      <header className="page-header">
        <div>
          <p className="page-kicker">Hasta yönetimi</p>
          <h1 id="patients-title">Hasta kayıtları</h1>
          <p>
            {integrationAvailable
              ? `${total} kayıt bulundu. Hasta bilgileri yerel veritabanından alınır.`
              : 'Tarayıcı önizlemesinde hasta veri bağlantısı kullanılmaz.'}
          </p>
        </div>
        <div className="actions">
          <span className={`status-badge ${
            integrationAvailable ? 'status-badge--verified' : 'status-badge--neutral'
          }`}>
            {integrationAvailable ? 'Yerel veri bağlı' : 'Önizleme modu'}
          </span>
          <button
            className="btn btn--primary"
            type="button"
            onClick={openCreatePanel}
            disabled={!integrationAvailable || saving}
          >
            Yeni hasta kaydı
          </button>
        </div>
      </header>

      <div className={`content-split ${panelMode ? 'content-split--detail' : ''}`}>
        <section className="panel records-panel" aria-labelledby="patient-list-title">
          <div className="panel-header">
            <div>
              <h2 id="patient-list-title">Kayıt listesi</h2>
              <p id="patient-list-description">Ad, soyad veya T.C. kimlik numarasına göre arayın.</p>
            </div>
          </div>

          <form className="toolbar patients-toolbar" onSubmit={(event) => event.preventDefault()}>
            <label className="field field--search">
              <span>Hasta ara</span>
              <input
                className="form-control"
                type="search"
                value={search}
                onChange={handleSearchChange}
                placeholder="Ad, soyad veya T.C. kimlik no"
                autoComplete="off"
                disabled={!integrationAvailable}
              />
            </label>
            {hasSearch && (
              <button className="btn btn--secondary" type="button" onClick={clearSearch}>
                Aramayı temizle
              </button>
            )}
          </form>

          <div className="table-wrap" aria-live="polite">
            <table
              className="data-table patients-table"
              aria-describedby="patient-list-description"
              aria-busy={listLoading}
            >
              <caption className="sr-only">Hasta kayıtları</caption>
              <thead>
                <tr>
                  <th scope="col">T.C. kimlik no</th>
                  <th scope="col">Ad soyad</th>
                  <th scope="col">Doğum yılı</th>
                  <th scope="col">İletişim</th>
                  <th scope="col">Kan grubu</th>
                  <th scope="col"><span className="sr-only">İşlem</span></th>
                </tr>
              </thead>
              <tbody>
                {!integrationAvailable ? (
                  <TableState
                    title="Hasta entegrasyonu kullanılamıyor"
                    message="Gerçek hasta kayıtlarını görüntülemek ve düzenlemek için masaüstü uygulamasını kullanın. Tarayıcı önizlemesinde örnek veri gösterilmez."
                  />
                ) : listLoading ? (
                  <TableState
                    title="Hasta kayıtları yükleniyor"
                    message="Yerel veritabanından güncel kayıtlar alınıyor."
                  />
                ) : listError ? (
                  <TableState
                    title="Hasta kayıtları alınamadı"
                    message={listError}
                    role="alert"
                    action={(
                      <button className="btn btn--primary" type="button" onClick={() => loadPatients()}>
                        Yeniden dene
                      </button>
                    )}
                  />
                ) : patients.length === 0 ? (
                  <TableState
                    title={hasSearch ? 'Aramayla eşleşen hasta yok' : 'Henüz hasta kaydı yok'}
                    message={hasSearch
                      ? 'Arama metnini değiştirin veya aramayı temizleyin.'
                      : 'İlk hasta kaydını oluşturmak için “Yeni hasta kaydı” düğmesini kullanın.'}
                    action={hasSearch ? (
                      <button className="btn btn--secondary" type="button" onClick={clearSearch}>
                        Aramayı temizle
                      </button>
                    ) : (
                      <button className="btn btn--primary" type="button" onClick={openCreatePanel}>
                        Yeni hasta kaydı
                      </button>
                    )}
                  />
                ) : (
                  patients.map((patient) => (
                    <tr
                      key={patient.id}
                      className={patient.id === editingId ? 'data-table__row--selected' : ''}
                    >
                      <td><span className="mono">{maskIdentifier(patient.tc_id)}</span></td>
                      <td>
                        <strong>{displayValue(`${patient.first_name || ''} ${patient.last_name || ''}`.trim())}</strong>
                        <small>{GENDER_LABELS[patient.gender] || displayValue(patient.gender)}</small>
                      </td>
                      <td>{formatBirthYear(patient.date_of_birth)}</td>
                      <td>
                        <strong>{maskPhone(patient.phone)}</strong>
                        <small>{maskEmail(patient.email)}</small>
                      </td>
                      <td>{displayValue(patient.blood_type)}</td>
                      <td>
                        <button
                          className="btn btn--secondary btn-sm"
                          type="button"
                          onClick={() => openEditPanel(patient.id)}
                          aria-label={`${patient.first_name || ''} ${patient.last_name || ''} hasta kaydını düzenle`.trim()}
                        >
                          Düzenle
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {integrationAvailable && !listLoading && !listError && total > 0 && (
            <nav className="pagination" aria-label="Hasta kayıt sayfaları">
              <p><strong>{firstRecord}–{lastRecord}</strong> / {total} kayıt</p>
              <div className="pagination-actions">
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={() => changePage(page - 1)}
                  disabled={page === 0}
                >
                  Önceki
                </button>
                <span aria-current="page">Sayfa {page + 1} / {pageCount}</span>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={() => changePage(page + 1)}
                  disabled={page + 1 >= pageCount}
                >
                  Sonraki
                </button>
              </div>
            </nav>
          )}
        </section>

        {panelMode && (
          <aside className="panel detail-panel patient-form-panel" aria-labelledby="patient-form-title">
            <div className="panel-header detail-header">
              <div>
                <p className="page-kicker">{panelMode === 'create' ? 'Yeni kayıt' : 'Kayıt düzenleme'}</p>
                <h2 id="patient-form-title">
                  {panelMode === 'create' ? 'Hasta bilgileri' : 'Hasta kaydını düzenle'}
                </h2>
              </div>
              <button className="btn btn--secondary" type="button" onClick={() => { if (confirmDiscardChanges()) closePanel() }} disabled={saving}>
                Kapat
              </button>
            </div>

            {detailLoading ? (
              <div className="empty-state" role="status">
                <h3>Hasta bilgileri yükleniyor</h3>
                <p>Seçilen kaydın güncel bilgileri alınıyor.</p>
              </div>
            ) : detailError ? (
              <div className="empty-state" role="alert">
                <h3>Hasta bilgileri alınamadı</h3>
                <p>{detailError}</p>
                <button className="btn btn--primary" type="button" onClick={() => openEditPanel(editingId)}>
                  Yeniden dene
                </button>
              </div>
            ) : (
              <form className="detail-content patient-form" onSubmit={handleSave} noValidate>
                <section className="detail-section" aria-labelledby="identity-fields-title">
                  <h3 id="identity-fields-title">Kimlik bilgileri</h3>
                  <p className="patient-form__description">Yıldızlı alanların doldurulması zorunludur.</p>
                  <div className="patient-form-grid">
                    <FormField
                      id="patient-tc-id"
                      label="T.C. kimlik numarası"
                      required
                      error={formErrors.tc_id}
                      hint="11 rakam girin."
                    >
                      <input
                        className="form-control mono"
                        name="tc_id"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={11}
                        pattern="[0-9]{11}"
                        required
                        value={form.tc_id}
                        onChange={(event) => updateForm('tc_id', event.target.value.replace(/\D/g, '').slice(0, 11))}
                      />
                    </FormField>

                    <FormField id="patient-first-name" label="Ad" required error={formErrors.first_name}>
                      <input
                        className="form-control"
                        name="first_name"
                        type="text"
                        autoComplete="given-name"
                        maxLength={80}
                        required
                        value={form.first_name}
                        onChange={(event) => updateForm('first_name', event.target.value)}
                      />
                    </FormField>

                    <FormField id="patient-last-name" label="Soyad" required error={formErrors.last_name}>
                      <input
                        className="form-control"
                        name="last_name"
                        type="text"
                        autoComplete="family-name"
                        maxLength={80}
                        required
                        value={form.last_name}
                        onChange={(event) => updateForm('last_name', event.target.value)}
                      />
                    </FormField>

                    <FormField id="patient-birth-date" label="Doğum tarihi" error={formErrors.date_of_birth}>
                      <input
                        className="form-control"
                        name="date_of_birth"
                        type="date"
                        max={getLocalDateInputValue()}
                        value={form.date_of_birth}
                        onChange={(event) => updateForm('date_of_birth', event.target.value)}
                      />
                    </FormField>

                    <FormField id="patient-gender" label="Cinsiyet">
                      <select
                        className="form-control"
                        name="gender"
                        value={form.gender}
                        onChange={(event) => updateForm('gender', event.target.value)}
                      >
                        {GENDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </FormField>

                    <FormField id="patient-blood-type" label="Kan grubu">
                      <select
                        className="form-control"
                        name="blood_type"
                        value={form.blood_type}
                        onChange={(event) => updateForm('blood_type', event.target.value)}
                      >
                        {BLOOD_TYPE_OPTIONS.map((bloodType) => (
                          <option key={bloodType || 'empty'} value={bloodType}>
                            {bloodType || 'Belirtilmedi'}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                </section>

                <section className="detail-section" aria-labelledby="contact-fields-title">
                  <h3 id="contact-fields-title">İletişim ve sağlık bilgileri</h3>
                  <div className="patient-form-grid">
                    <FormField id="patient-phone" label="Telefon" error={formErrors.phone}>
                      <input
                        className="form-control"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        maxLength={24}
                        value={form.phone}
                        onChange={(event) => updateForm('phone', event.target.value)}
                      />
                    </FormField>

                    <FormField id="patient-email" label="E-posta" error={formErrors.email}>
                      <input
                        className="form-control"
                        name="email"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        value={form.email}
                        onChange={(event) => updateForm('email', event.target.value)}
                      />
                    </FormField>

                    <FormField
                      id="patient-allergies"
                      label="Alerjiler"
                      error={formErrors.allergies}
                      hint="Birden fazla alerjiyi virgülle ayırın."
                    >
                      <textarea
                        className="form-control patient-form__textarea"
                        name="allergies"
                        rows={3}
                        maxLength={1000}
                        value={form.allergies}
                        onChange={(event) => updateForm('allergies', event.target.value)}
                      />
                    </FormField>
                  </div>
                </section>

                {saveError && (
                  <div className="form-alert" role="alert">
                    <p>{saveError}</p>
                  </div>
                )}

                <div className="patient-form__actions actions">
                  <button className="btn btn--secondary" type="button" onClick={() => { if (confirmDiscardChanges()) closePanel() }} disabled={saving}>
                    Vazgeç
                  </button>
                  <button className="btn btn--primary" type="submit" disabled={saving} aria-busy={saving}>
                    {saving
                      ? 'Kaydediliyor…'
                      : panelMode === 'create'
                        ? 'Hasta kaydını oluştur'
                        : 'Değişiklikleri kaydet'}
                  </button>
                </div>
              </form>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
