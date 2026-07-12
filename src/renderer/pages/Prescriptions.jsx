import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePrescriptions } from '../context/PrescriptionContext.jsx'

const STATUS_OPTIONS = [
  { value: '', label: 'Tüm durumlar' },
  { value: 'pending', label: 'Beklemede' },
  { value: 'verified', label: 'Onaylandı' },
  { value: 'dispensed', label: 'Teslim edildi' },
  { value: 'rejected', label: 'Reddedildi' },
  { value: 'expired', label: 'Süresi doldu' },
]

const STATUS_META = {
  pending: { label: 'Beklemede', className: 'status-badge--pending' },
  verified: { label: 'Onaylandı', className: 'status-badge--verified' },
  dispensed: { label: 'Teslim edildi', className: 'status-badge--dispensed' },
  rejected: { label: 'Reddedildi', className: 'status-badge--rejected' },
  expired: { label: 'Süresi doldu', className: 'status-badge--expired' },
}

const SEVERITY_META = {
  critical: { label: 'Kritik', className: 'status-badge--critical' },
  warning: { label: 'Uyarı', className: 'status-badge--warning' },
  safe: { label: 'Kayıtlı uyarı yok', className: 'status-badge--neutral' },
}

const GENDER_LABELS = {
  F: 'Kadın',
  female: 'Kadın',
  woman: 'Kadın',
  M: 'Erkek',
  male: 'Erkek',
  man: 'Erkek',
}

function formatDate(value, includeTime = false) {
  if (!value) return '—'

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

function maskIdentifier(value) {
  if (!value) return '—'
  const text = String(value)
  if (text.length <= 4) return text
  return `${'•'.repeat(text.length - 4)}${text.slice(-4)}`
}

function displayValue(value) {
  return value === null || value === undefined || value === '' ? '—' : value
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || {
    label: displayValue(status),
    className: 'status-badge--neutral',
  }

  return (
    <span className={`status-badge ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function SeverityBadge({ severity }) {
  const meta = SEVERITY_META[severity] || SEVERITY_META.safe
  return (
    <span className={`status-badge ${meta.className}`}>
      {meta.label}
    </span>
  )
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

function DetailField({ term, children }) {
  return (
    <div className="detail-field">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export default function Prescriptions() {
  const {
    prescriptions,
    total,
    listLoading: loading,
    listError: error,
    filters,
    setFilters,
    page,
    setPage,
    PAGE_SIZE,
    fetchPrescriptions,
    summary,
    categories,
    analyticsError,
    dataSource,
    selectedId,
    selectedRx,
    detailLoading,
    detailError,
    selectPrescription,
    updateStatus,
    updatingStatus,
    interactions,
  } = usePrescriptions()

  const [pendingAction, setPendingAction] = useState(null)
  const hasFilters = Boolean(filters.status || filters.search.trim())
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstRecord = total === 0 ? 0 : page * PAGE_SIZE + 1
  const lastRecord = Math.min((page + 1) * PAGE_SIZE, total)
  const isUpdating = updatingStatus === selectedId
  const hasCriticalInteraction = interactions.some(
    (interaction) => interaction.severity === 'critical'
  )

  const clearFilters = () => setFilters({ status: '', search: '' })

  const toggleRow = (id) => {
    setPendingAction(null)
    selectPrescription(id === selectedId ? null : id)
  }

  const handleRowKeyDown = (event, id) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleRow(id)
    }
  }

  const changePage = (nextPage) => {
    const boundedPage = Math.min(Math.max(nextPage, 0), pageCount - 1)
    if (boundedPage === page) return
    setPendingAction(null)
    selectPrescription(null)
    setPage(boundedPage)
  }

  const confirmStatusChange = async () => {
    if (!pendingAction || !selectedRx) return
    const nextStatus = pendingAction
    setPendingAction(null)
    await updateStatus(selectedRx.id, nextStatus)
  }

  const confirmationCopy = {
    verified: {
      title: 'Reçete onayını doğrulayın',
      message: hasCriticalInteraction
        ? 'Bu reçetede kritik etkileşim kaydı bulunuyor. Klinik değerlendirmeyi tamamladığınızı ve yine de onay vermek istediğinizi doğrulayın.'
        : 'İlaçları, dozları ve hasta bilgilerini kontrol ettiğinizi doğrulayın.',
      button: 'Onayı kaydet',
    },
    rejected: {
      title: 'Reddetme işlemini doğrulayın',
      message: 'Bu işlem reçeteyi reddedildi olarak kaydeder. Devam etmek istediğinizi doğrulayın.',
      button: 'Reddetmeyi kaydet',
    },
    dispensed: {
      title: 'Teslim işlemini doğrulayın',
      message: 'İlaçların hastaya teslim edildiğini doğrulayın. Bu işlem kalıcı olarak kaydedilir.',
      button: 'Teslimi kaydet',
    },
  }

  const activeConfirmation = pendingAction
    ? confirmationCopy[pendingAction]
    : null

  return (
    <div className="page-shell prescriptions-page" aria-labelledby="prescriptions-title">
      <header className="page-header">
        <div>
          <p className="page-kicker">Reçete yönetimi</p>
          <h1 id="prescriptions-title">Reçete kayıtları</h1>
          <p>
            {dataSource === 'electron'
              ? `${total} gerçek kayıt bulundu.`
              : 'Tarayıcı önizlemesinde yerel veri bağlantısı kullanılmaz.'}
          </p>
        </div>
        <div className="page-header__actions">
          <span
            className={`status-badge ${
              dataSource === 'electron'
                ? 'status-badge--verified'
                : 'status-badge--neutral'
            }`}
          >
            {dataSource === 'electron' ? 'Yerel veri bağlı' : 'Önizleme modu'}
          </span>
          <Link className="btn btn-primary" to="/prescriptions/new">
            <Plus size={17} aria-hidden="true" />
            Yeni reçete
          </Link>
        </div>
      </header>

      {(summary || categories.length > 0 || analyticsError) && (
        <section className="panel summary-panel" aria-labelledby="daily-summary-title">
          <div className="panel-header">
            <div>
              <h2 id="daily-summary-title">Günlük işlem özeti</h2>
              <p>Değerler doğrudan yerel veri tabanından alınır.</p>
            </div>
          </div>

          {analyticsError ? (
            <div className="empty-state empty-state--compact" role="status">
              <p>{analyticsError}</p>
            </div>
          ) : (
            <>
              {summary && (
                <dl className="summary-list">
                  <div className="summary-item">
                    <dt>Bugün oluşturulan</dt>
                    <dd>{displayValue(summary.total)}</dd>
                  </div>
                  <div className="summary-item">
                    <dt>Bekleyen</dt>
                    <dd>{displayValue(summary.pending)}</dd>
                  </div>
                  <div className="summary-item">
                    <dt>Onaylı durumda</dt>
                    <dd>{displayValue(summary.verified)}</dd>
                  </div>
                  <div className="summary-item">
                    <dt>Teslim durumunda</dt>
                    <dd>{displayValue(summary.dispensed)}</dd>
                  </div>
                </dl>
              )}

              {categories.length > 0 && (
                <div className="category-summary" aria-label="En sık kaydedilen ilaç grupları">
                  <strong>İlaç grupları</strong>
                  <ul>
                    {categories.slice(0, 4).map((category) => (
                      <li key={category.category}>
                        <span>{displayValue(category.category)}</span>
                        <span>{displayValue(category.count)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <div className={`content-split ${selectedId ? 'content-split--detail' : ''}`}>
        <section className="panel records-panel" aria-labelledby="records-panel-title">
          <div className="panel-header">
            <div>
              <h2 id="records-panel-title">Kayıt listesi</h2>
              <p id="records-description">Reçete numarası, hasta veya hekim adına göre arayın.</p>
            </div>
          </div>

          <form className="toolbar" aria-label="Reçete filtreleri" onSubmit={(event) => event.preventDefault()}>
            <label className="field field--search">
              <span>Arama</span>
              <input
                className="form-control"
                type="search"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))}
                placeholder="Reçete no, hasta veya hekim"
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span>Durum</span>
              <select
                className="form-control"
                value={filters.status}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {hasFilters && (
              <button className="btn btn--secondary" type="button" onClick={clearFilters}>
                Filtreleri temizle
              </button>
            )}
          </form>

          <div className="table-wrap" aria-live="polite">
            <table
              className="data-table"
              aria-describedby="records-description"
              aria-busy={loading}
            >
              <caption className="sr-only">Reçete kayıtları</caption>
              <thead>
                <tr>
                  <th scope="col">Uyarı düzeyi</th>
                  <th scope="col">Reçete no</th>
                  <th scope="col">Hasta</th>
                  <th scope="col">Hekim</th>
                  <th scope="col">Düzenlenme tarihi</th>
                  <th scope="col">Durum</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableState
                    title="Kayıtlar yükleniyor"
                    message="Yerel veri tabanından güncel reçeteler alınıyor."
                  />
                ) : error ? (
                  <TableState
                    title="Kayıtlar alınamadı"
                    message={error}
                    role="alert"
                    action={(
                      <button className="btn btn--primary" type="button" onClick={fetchPrescriptions}>
                        Yeniden dene
                      </button>
                    )}
                  />
                ) : prescriptions.length === 0 ? (
                  <TableState
                    title={dataSource === 'browser'
                      ? 'Önizlemede veri gösterilmez'
                      : hasFilters
                        ? 'Filtrelerle eşleşen kayıt yok'
                        : 'Henüz reçete kaydı yok'}
                    message={dataSource === 'browser'
                      ? 'Gerçek kayıtlar yalnızca masaüstü uygulamasındaki yerel veri bağlantısından alınır.'
                      : hasFilters
                        ? 'Arama metnini veya durum filtresini değiştirin.'
                        : 'Veri tabanına reçete eklendiğinde kayıtlar burada görünür.'}
                    action={hasFilters ? (
                      <button className="btn btn--secondary" type="button" onClick={clearFilters}>
                        Filtreleri temizle
                      </button>
                    ) : null}
                  />
                ) : (
                  prescriptions.map((prescription) => {
                    const isSelected = prescription.id === selectedId
                    return (
                      <tr
                        key={prescription.id}
                        className={`data-table__row--interactive${isSelected ? ' data-table__row--selected' : ''}`}
                        tabIndex={0}
                        aria-label={`${displayValue(prescription.barcode)} numaralı reçeteyi ${
                          isSelected ? 'kapat' : 'incele'
                        }`}
                        onClick={() => toggleRow(prescription.id)}
                        onKeyDown={(event) => handleRowKeyDown(event, prescription.id)}
                      >
                        <td><SeverityBadge severity={prescription.highest_severity} /></td>
                        <td><span className="mono">{displayValue(prescription.barcode)}</span></td>
                        <td>
                          <strong>{displayValue(prescription.patient_name)}</strong>
                          <small>{maskIdentifier(prescription.patient_tc)}</small>
                        </td>
                        <td>
                          <strong>{displayValue(prescription.doctor_name)}</strong>
                          <small>{displayValue(prescription.doctor_specialty)}</small>
                        </td>
                        <td>{formatDate(prescription.issued_date)}</td>
                        <td><StatusBadge status={prescription.status} /></td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && !error && total > 0 && (
            <nav className="pagination" aria-label="Reçete sayfaları">
              <p>
                <strong>{firstRecord}–{lastRecord}</strong> / {total} kayıt
              </p>
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

        {selectedId && (
          <aside className="panel detail-panel" aria-labelledby="detail-panel-title">
            <div className="panel-header detail-header">
              <div>
                <p className="page-kicker">Kayıt ayrıntısı</p>
                <h2 id="detail-panel-title">
                  {selectedRx?.barcode || 'Reçete yükleniyor'}
                </h2>
              </div>
              <button
                className="btn btn--secondary"
                type="button"
                onClick={() => {
                  setPendingAction(null)
                  selectPrescription(null)
                }}
              >
                Kapat
              </button>
            </div>

            {detailLoading ? (
              <div className="empty-state" role="status">
                <h3>Ayrıntılar yükleniyor</h3>
                <p>Seçilen reçetenin güncel kaydı alınıyor.</p>
              </div>
            ) : detailError ? (
              <div className="empty-state" role="alert">
                <h3>Ayrıntı görüntülenemedi</h3>
                <p>{detailError}</p>
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={() => selectPrescription(selectedId)}
                >
                  Yeniden dene
                </button>
              </div>
            ) : selectedRx ? (
              <div className="detail-content">
                <section className="detail-section" aria-labelledby="patient-title">
                  <div className="section-header">
                    <h3 id="patient-title">Hasta ve reçete bilgileri</h3>
                    <StatusBadge status={selectedRx.status} />
                  </div>
                  <dl className="detail-grid">
                    <DetailField term="Hasta">{displayValue(selectedRx.patient_name)}</DetailField>
                    <DetailField term="T.C. kimlik no">{maskIdentifier(selectedRx.tc_id)}</DetailField>
                    <DetailField term="Doğum tarihi">{formatDate(selectedRx.date_of_birth)}</DetailField>
                    <DetailField term="Cinsiyet">
                      {GENDER_LABELS[selectedRx.gender] || displayValue(selectedRx.gender)}
                    </DetailField>
                    <DetailField term="Kan grubu">{displayValue(selectedRx.blood_type)}</DetailField>
                    <DetailField term="Düzenlenme tarihi">{formatDate(selectedRx.issued_date)}</DetailField>
                  </dl>

                  <div className="record-note">
                    <strong>Alerji kaydı</strong>
                    {Array.isArray(selectedRx.allergies) && selectedRx.allergies.length > 0 ? (
                      <ul className="tag-list">
                        {selectedRx.allergies.map((allergy) => (
                          <li className="tag tag--warning" key={allergy}>{allergy}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Kayıtlı alerji bilgisi bulunmuyor.</p>
                    )}
                  </div>
                </section>

                <section className="detail-section" aria-labelledby="doctor-title">
                  <h3 id="doctor-title">Hekim bilgileri</h3>
                  <dl className="detail-grid">
                    <DetailField term="Hekim">{displayValue(selectedRx.doctor_name)}</DetailField>
                    <DetailField term="Uzmanlık">{displayValue(selectedRx.specialty)}</DetailField>
                    <DetailField term="Kurum">{displayValue(selectedRx.hospital)}</DetailField>
                    <DetailField term="Sicil no">{displayValue(selectedRx.license_no)}</DetailField>
                  </dl>
                </section>

                <section className="detail-section" aria-labelledby="medications-title">
                  <h3 id="medications-title">İlaç kayıtları</h3>
                  {Array.isArray(selectedRx.items) && selectedRx.items.length > 0 ? (
                    <ul className="record-list">
                      {selectedRx.items.map((item) => (
                        <li className="record-item" key={item.id}>
                          <div className="record-item__header">
                            <div>
                              <strong>{displayValue(item.drug_name)}</strong>
                              <p>{displayValue(item.generic_name)}</p>
                            </div>
                            <SeverityBadge severity={item.status} />
                          </div>
                          <dl className="detail-grid detail-grid--compact">
                            <DetailField term="Miktar">
                              {displayValue(item.quantity)} {displayValue(item.unit)}
                            </DetailField>
                            <DetailField term="Kullanım sıklığı">{displayValue(item.frequency)}</DetailField>
                            <DetailField term="Süre">
                              {item.duration_days ? `${item.duration_days} gün` : '—'}
                            </DetailField>
                            <DetailField term="Kontrole tabi">
                              {item.controlled === 1
                                ? 'Evet'
                                : item.controlled === 0
                                  ? 'Hayır'
                                  : '—'}
                            </DetailField>
                          </dl>
                          {item.instructions && (
                            <p className="record-note"><strong>Talimat:</strong> {item.instructions}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-state empty-state--compact">
                      <p>Bu reçeteye bağlı ilaç kaydı bulunmuyor.</p>
                    </div>
                  )}
                </section>

                <section className="detail-section" aria-labelledby="interactions-title">
                  <h3 id="interactions-title">İlaç etkileşimi kayıtları</h3>
                  {interactions.length > 0 ? (
                    <ul className="alert-list">
                      {interactions.map((interaction, index) => (
                        <li
                          className={`alert alert--${
                            interaction.severity === 'critical' ? 'critical' : 'warning'
                          }`}
                          key={interaction.id || `${interaction.drug_a_id}-${interaction.drug_b_id}-${index}`}
                        >
                          <div className="alert__header">
                            <strong>
                              {displayValue(interaction.drug_a_name)} + {displayValue(interaction.drug_b_name)}
                            </strong>
                            <SeverityBadge severity={interaction.severity} />
                          </div>
                          <p>{displayValue(interaction.description)}</p>
                          {interaction.mechanism && (
                            <p><strong>Mekanizma:</strong> {interaction.mechanism}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-state empty-state--compact">
                      <p>Kayıtlı ilaç etkileşimi bulunmuyor.</p>
                    </div>
                  )}
                  <p className="safety-note">
                    Bu ekran yalnızca veri tabanındaki kayıtları gösterir; klinik değerlendirme yerine geçmez.
                  </p>
                </section>

                {(selectedRx.verified_by || selectedRx.verified_at) && (
                  <section className="detail-section" aria-labelledby="audit-title">
                    <h3 id="audit-title">Onay kaydı</h3>
                    <dl className="detail-grid">
                      <DetailField term="Onaylayan">{displayValue(selectedRx.verified_by)}</DetailField>
                      <DetailField term="Onay zamanı">{formatDate(selectedRx.verified_at, true)}</DetailField>
                    </dl>
                  </section>
                )}

                {activeConfirmation && (
                  <section
                    className="confirmation-box"
                    role="group"
                    aria-labelledby="confirmation-title"
                    aria-describedby="confirmation-description"
                  >
                    <h3 id="confirmation-title">{activeConfirmation.title}</h3>
                    <p id="confirmation-description">{activeConfirmation.message}</p>
                    <div className="actions">
                      <button
                        className="btn btn--secondary"
                        type="button"
                        onClick={() => setPendingAction(null)}
                        disabled={isUpdating}
                      >
                        Vazgeç
                      </button>
                      <button
                        className={`btn ${pendingAction === 'rejected' ? 'btn--danger' : 'btn--primary'}`}
                        type="button"
                        onClick={confirmStatusChange}
                        disabled={isUpdating}
                      >
                        {isUpdating ? 'Kaydediliyor…' : activeConfirmation.button}
                      </button>
                    </div>
                  </section>
                )}

                {!activeConfirmation && selectedRx.status === 'pending' && (
                  <section className="detail-actions" aria-labelledby="pending-actions-title">
                    <div>
                      <h3 id="pending-actions-title">İnceleme sonucu</h3>
                      <p>Karar vermeden önce hasta, ilaç ve etkileşim kayıtlarını kontrol edin.</p>
                    </div>
                    <div className="actions">
                      <button
                        className="btn btn--danger"
                        type="button"
                        onClick={() => setPendingAction('rejected')}
                        disabled={isUpdating}
                      >
                        Reçeteyi reddet
                      </button>
                      <button
                        className="btn btn--primary"
                        type="button"
                        onClick={() => setPendingAction('verified')}
                        disabled={isUpdating}
                      >
                        Reçeteyi onayla
                      </button>
                    </div>
                  </section>
                )}

                {!activeConfirmation && selectedRx.status === 'verified' && (
                  <section className="detail-actions" aria-labelledby="dispense-actions-title">
                    <div>
                      <h3 id="dispense-actions-title">Teslim işlemi</h3>
                      <p>Yalnızca ilaçlar hastaya teslim edildikten sonra kaydedin.</p>
                    </div>
                    <button
                      className="btn btn--primary"
                      type="button"
                      onClick={() => setPendingAction('dispensed')}
                      disabled={isUpdating}
                    >
                      Teslim edildi olarak işaretle
                    </button>
                  </section>
                )}
              </div>
            ) : null}
          </aside>
        )}
      </div>
    </div>
  )
}
