import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ClipboardList,
  Database,
  FilterX,
  Loader2,
  Search,
} from 'lucide-react'

const PAGE_SIZE = 20
const INITIAL_FILTERS = {
  search: '',
  entityType: '',
  action: '',
  dateFrom: '',
  dateTo: '',
}

const ENTITY_LABELS = {
  prescriptions: 'Reçete',
  prescription: 'Reçete',
  patients: 'Hasta',
  patient: 'Hasta',
  doctors: 'Hekim',
  doctor: 'Hekim',
  drugs: 'İlaç',
  drug: 'İlaç',
  auth: 'Oturum',
  reports: 'Rapor',
  system: 'Sistem',
}

const ACTION_LABELS = {
  create: 'Oluşturma',
  update: 'Güncelleme',
  delete: 'Silme',
  login: 'Oturum açma',
  logout: 'Oturum kapatma',
  read: 'Görüntüleme',
  verify: 'Doğrulama',
  dispense: 'Teslim',
}

const DETAIL_LABELS = {
  status: 'Durum',
  notes: 'Not',
  patient_id: 'Hasta kayıt kimliği',
  doctor_id: 'Hekim kayıt kimliği',
  diagnosis_code: 'Tanı kodu',
  issued_date: 'Reçete tarihi',
  expiry_date: 'Son kullanım tarihi',
  barcode: 'Barkod',
  item_count: 'İlaç kalemi sayısı',
  registration_number: 'Sicil numarası',
  license_no: 'Sicil numarası',
  hospital: 'Kurum',
  generic_name: 'Etken madde',
  first_name: 'Ad',
  last_name: 'Soyad',
  phone: 'Telefon',
  email: 'E-posta',
}

function unwrapResponse(response, fallback) {
  if (!response?.success) throw new Error(response?.error || fallback)
  return response.data
}

function formatTimestamp(value) {
  if (!value) return 'Tarih bilgisi yok'
  const normalized = /Z$|[+-]\d\d:\d\d$/.test(String(value))
    ? String(value)
    : `${String(value).replace(' ', 'T')}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function actorLabel(actor) {
  if (!actor) return 'Sistem'
  const normalized = String(actor).toLowerCase()
  if (normalized === 'admin') return 'Yönetici (admin)'
  if (normalized === 'system') return 'Sistem'
  return String(actor)
}

function humanizeKey(key) {
  if (DETAIL_LABELS[key]) return DETAIL_LABELS[key]
  return String(key)
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toLocaleUpperCase('tr-TR'))
}

function displayDetailValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır'
  if (Array.isArray(value)) return value.length ? value.map(displayDetailValue).join(', ') : '—'
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${humanizeKey(key)}: ${displayDetailValue(nestedValue)}`)
      .join(' · ')
  }
  return String(value)
}

function parseDetails(details) {
  if (!details) return []
  let parsed = details
  if (typeof details === 'string') {
    try {
      parsed = JSON.parse(details)
    } catch {
      return [['Açıklama', details]]
    }
  }
  if (Array.isArray(parsed)) return parsed.map((value, index) => [`Kayıt ${index + 1}`, value])
  if (typeof parsed !== 'object') return [['Açıklama', parsed]]
  return Object.entries(parsed).map(([key, value]) => [humanizeKey(key), value])
}

function actionClasses(action) {
  if (action === 'delete') return 'border-[#dfafb7] bg-[#fff2f4] text-[#9f1230]'
  if (action === 'create' || action === 'login') return 'border-[#a9ceba] bg-[#f1faf5] text-[#17633a]'
  if (action === 'update' || action === 'verify' || action === 'dispense' || action === 'read') return 'border-[#b9cfd9] bg-[#f0f7fa] text-[#315c74]'
  return 'border-[#cbd3d8] bg-[#f3f5f6] text-[#59666e]'
}

export default function AuditLogs() {
  const integrationAvailable = Boolean(
    typeof window !== 'undefined' && window.eTakip?.db?.audit?.getAll
  )
  const [draftFilters, setDraftFilters] = useState(INITIAL_FILTERS)
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(integrationAvailable)
  const [error, setError] = useState('')
  const requestRef = useRef(0)

  const fetchLogs = useCallback(async () => {
    const requestId = ++requestRef.current
    if (!integrationAvailable) {
      setRows([])
      setTotal(0)
      setLoading(false)
      setError('')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await window.eTakip.db.audit.getAll({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        search: filters.search.trim() || undefined,
        entityType: filters.entityType || undefined,
        action: filters.action || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      })
      const data = unwrapResponse(response, 'İşlem günlükleri alınamadı.')
      if (requestId !== requestRef.current) return
      const nextRows = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.items) ? data.items : []
      const nextTotal = Number(data?.total)
      setRows(nextRows)
      setTotal(Number.isFinite(nextTotal) && nextTotal >= 0 ? nextTotal : nextRows.length)
    } catch (requestError) {
      if (requestId !== requestRef.current) return
      console.error('[İşlem günlükleri] Kayıtlar alınamadı:', requestError)
      setRows([])
      setTotal(0)
      setError(requestError.message || 'İşlem günlükleri alınamadı. Lütfen yeniden deneyin.')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [filters, integrationAvailable, page])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstRecord = total === 0 ? 0 : page * PAGE_SIZE + 1
  const lastRecord = Math.min((page + 1) * PAGE_SIZE, total)
  const hasFilters = useMemo(
    () => Object.values(filters).some((value) => String(value).trim()),
    [filters]
  )

  const updateDraft = (field, value) => {
    setDraftFilters((current) => ({ ...current, [field]: value }))
  }

  const applyFilters = (event) => {
    event.preventDefault()
    setPage(0)
    setFilters({ ...draftFilters })
  }

  const clearFilters = () => {
    setDraftFilters(INITIAL_FILTERS)
    setFilters(INITIAL_FILTERS)
    setPage(0)
  }

  return (
    <div className="page-shell" aria-labelledby="audit-logs-title">
      <header className="page-header">
        <div>
          <p className="page-kicker">Sistem kayıtları</p>
          <h1 id="audit-logs-title">İşlem günlükleri</h1>
          <p>Yerel verilerde gerçekleştirilen kayıt işlemlerini tarih, kullanıcı ve işlem türüyle izleyin.</p>
        </div>
        <span className={`status-badge ${integrationAvailable ? 'status-badge--verified' : 'status-badge--neutral'}`}>
          {integrationAvailable ? `${total} günlük kaydı` : 'Önizleme modu'}
        </span>
      </header>

      <section className="panel mt-5" aria-labelledby="audit-list-title">
        <div className="panel-header">
          <div>
            <h2 id="audit-list-title">Kayıt listesi</h2>
            <p>Filtreler yalnızca kayıtlı günlük verilerine uygulanır.</p>
          </div>
          <ClipboardList size={20} className="text-[#a50e24]" aria-hidden="true" />
        </div>

        <form className="grid gap-3 border-b border-[#dfe4e7] bg-[#f7f9fa] p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_170px_160px_160px_auto]" onSubmit={applyFilters}>
          <label className="field">
            <span>Arama</span>
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#697586]" size={16} aria-hidden="true" />
              <input
                className="form-control !pl-10"
                type="search"
                disabled={!integrationAvailable}
                value={draftFilters.search}
                onChange={(event) => updateDraft('search', event.target.value)}
                placeholder="Kayıt no, kullanıcı veya açıklama"
                autoComplete="off"
              />
            </span>
          </label>
          <label className="field">
            <span>Kayıt türü</span>
            <select className="form-control" value={draftFilters.entityType} onChange={(event) => updateDraft('entityType', event.target.value)} disabled={!integrationAvailable}>
              <option value="">Tüm kayıt türleri</option>
              <option value="prescriptions">Reçete</option>
              <option value="patients">Hasta</option>
              <option value="doctors">Hekim</option>
              <option value="drugs">İlaç</option>
              <option value="auth">Oturum</option>
              <option value="reports">Rapor</option>
            </select>
          </label>
          <label className="field">
            <span>İşlem</span>
            <select className="form-control" value={draftFilters.action} onChange={(event) => updateDraft('action', event.target.value)} disabled={!integrationAvailable}>
              <option value="">Tüm işlemler</option>
              <option value="create">Oluşturma</option>
              <option value="update">Güncelleme</option>
              <option value="login">Oturum açma</option>
              <option value="logout">Oturum kapatma</option>
              <option value="read">Görüntüleme</option>
            </select>
          </label>
          <label className="field">
            <span>Başlangıç</span>
            <input
              className="form-control"
              type="date"
              disabled={!integrationAvailable}
              value={draftFilters.dateFrom}
              max={draftFilters.dateTo || undefined}
              onChange={(event) => updateDraft('dateFrom', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Bitiş</span>
            <input
              className="form-control"
              type="date"
              disabled={!integrationAvailable}
              value={draftFilters.dateTo}
              min={draftFilters.dateFrom || undefined}
              onChange={(event) => updateDraft('dateTo', event.target.value)}
            />
          </label>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
            <button className="btn btn--primary flex-1" type="submit" disabled={!integrationAvailable}>Filtrele</button>
            {(hasFilters || Object.values(draftFilters).some(Boolean)) && (
              <button className="btn btn--secondary !px-3" type="button" onClick={clearFilters} aria-label="Filtreleri temizle">
                <FilterX size={17} aria-hidden="true" />
              </button>
            )}
          </div>
        </form>

        <div className="overflow-x-auto" aria-live="polite">
          <table className="data-table min-w-[980px]" aria-busy={loading}>
            <caption className="sr-only">Sistem işlem günlükleri</caption>
            <thead>
              <tr>
                <th scope="col">Tarih ve saat</th>
                <th scope="col">Kullanıcı</th>
                <th scope="col">Kayıt türü</th>
                <th scope="col">İşlem</th>
                <th scope="col">Kayıt kimliği</th>
                <th scope="col">Ayrıntı</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="data-table__state">
                  <td colSpan="6">
                    <div className="empty-state" role="status">
                      <Loader2 className="spinner" size={24} aria-hidden="true" />
                      <h3 className="!mt-3">Günlük kayıtları yükleniyor</h3>
                      <p>Yerel veri tabanındaki işlemler alınıyor.</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr className="data-table__state">
                  <td colSpan="6">
                    <div className="empty-state" role="alert">
                      <AlertCircle size={24} className="text-[#a50e24]" aria-hidden="true" />
                      <h3 className="!mt-3">Günlük kayıtları alınamadı</h3>
                      <p>{error}</p>
                      <button className="btn btn--primary" type="button" onClick={fetchLogs}>Yeniden dene</button>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className="data-table__state">
                  <td colSpan="6">
                    <div className="empty-state" role="status">
                      <Database size={24} className="text-[#697586]" aria-hidden="true" />
                      <h3 className="!mt-3">
                        {!integrationAvailable
                          ? 'Önizlemede günlük verisi gösterilmez'
                          : hasFilters ? 'Filtrelerle eşleşen kayıt yok' : 'Henüz işlem günlüğü yok'}
                      </h3>
                      <p>
                        {!integrationAvailable
                          ? 'Gerçek işlem günlükleri yalnızca masaüstü uygulamasındaki yerel veri bağlantısından alınır.'
                          : hasFilters ? 'Arama ölçütlerini değiştirin veya filtreleri temizleyin.' : 'Sistemde kayıt işlemi yapıldığında günlükler burada görünür.'}
                      </p>
                      {hasFilters && <button className="btn btn--secondary" type="button" onClick={clearFilters}>Filtreleri temizle</button>}
                    </div>
                  </td>
                </tr>
              ) : rows.map((log, index) => {
                const details = parseDetails(log.details)
                const entityType = log.entity_type || log.entityType
                return (
                  <tr key={log.id || `${log.created_at || log.timestamp}-${index}`}>
                    <td className="whitespace-nowrap">
                      <strong>{formatTimestamp(log.created_at || log.timestamp)}</strong>
                    </td>
                    <td>{actorLabel(log.actor)}</td>
                    <td>{ENTITY_LABELS[entityType] || entityType || 'Sistem'}</td>
                    <td>
                      <span className={`inline-flex min-h-6 items-center border px-2 py-1 text-[10px] font-extrabold ${actionClasses(log.action)}`}>
                        {ACTION_LABELS[log.action] || log.action || 'İşlem'}
                      </span>
                    </td>
                    <td><span className="mono">{log.entity_id || log.entityId || '—'}</span></td>
                    <td className="w-[320px]">
                      {details.length > 0 ? (
                        <details className="group border border-[#d8dee6] bg-[#fafbfc]">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-[#344054] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1d6f8a]">
                            Değişiklik ayrıntıları
                            <ChevronDown className="transition-transform group-open:rotate-180" size={15} aria-hidden="true" />
                          </summary>
                          <dl className="border-t border-[#d8dee6] px-3 py-2">
                            {details.map(([key, value], detailIndex) => (
                              <div className="grid grid-cols-[minmax(95px,0.45fr)_minmax(0,1fr)] gap-3 border-b border-[#e8ebef] py-2 last:border-b-0" key={`${key}-${detailIndex}`}>
                                <dt className="text-[10px] font-bold uppercase tracking-[0.04em] text-[#667085]">{key}</dt>
                                <dd className="m-0 break-words text-xs font-medium leading-5 text-[#344054]">{displayDetailValue(value)}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      ) : <span className="text-xs text-[#667085]">Ek ayrıntı yok</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && !error && total > 0 && (
          <nav className="pagination" aria-label="İşlem günlüğü sayfaları">
            <p><strong>{firstRecord}–{lastRecord}</strong> / {total} kayıt</p>
            <div className="pagination-actions">
              <button className="btn btn--secondary" type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
                Önceki
              </button>
              <span aria-current="page">Sayfa {page + 1} / {pageCount}</span>
              <button className="btn btn--secondary" type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => current + 1)}>
                Sonraki
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  )
}
