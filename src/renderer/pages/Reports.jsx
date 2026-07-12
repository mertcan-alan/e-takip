import React, { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CalendarRange,
  FileBarChart2,
  Info,
  Printer,
} from 'lucide-react'

const numberFormatter = new Intl.NumberFormat('tr-TR')
const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})
const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const STATUS_LABELS = {
  pending: 'Beklemede',
  verified: 'Onaylandı',
  dispensed: 'Teslim edildi',
  rejected: 'Reddedildi',
  expired: 'Süresi doldu',
}

function toInputDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value) {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? `${value}T00:00:00`
    : value
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = parseDate(value)
  return date ? dateFormatter.format(date) : '—'
}

function formatDateTime(value) {
  const date = parseDate(value)
  return date ? dateTimeFormatter.format(date) : '—'
}

function statusClass(status) {
  if (status === 'rejected' || status === 'expired') return 'border-[#e1aeb6] bg-[#fff4f5] text-[#8f1022]'
  if (status === 'pending') return 'border-[#e5d39f] bg-[#fff9e9] text-[#795a08]'
  if (status === 'verified' || status === 'dispensed') return 'border-[#bcd8c8] bg-[#f4fbf7] text-[#17633a]'
  return 'border-[#d8dee6] bg-[#f8fafb] text-[#4b5563]'
}

function EmptyReport({ browserMode, requested }) {
  return (
    <section className="flex min-h-64 flex-col items-center justify-center border border-dashed border-[#cbd2da] bg-[#fafbfc] px-6 text-center">
      <Info size={27} strokeWidth={1.5} className="text-[#697586]" aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold text-[#28323d]">
        {browserMode
          ? 'Rapor entegrasyonu kullanılamıyor'
          : requested
            ? 'Bu aralıkta kayıt bulunamadı'
            : 'Rapor henüz oluşturulmadı'}
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-[#667085]">
        {browserMode
          ? 'Gerçek rapor verisi yalnızca masaüstü uygulamasındaki yerel veritabanından alınır.'
          : requested
            ? 'Seçilen tarihler arasında rapora dahil edilebilecek işlem yok.'
            : 'Başlangıç ve bitiş tarihini seçip “Raporu oluştur” düğmesini kullanın.'}
      </p>
    </section>
  )
}

export default function Reports() {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = useState(() => toInputDate(monthStart))
  const [endDate, setEndDate] = useState(() => toInputDate(today))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [requested, setRequested] = useState(false)
  const [error, setError] = useState('')

  const integrationAvailable = typeof window !== 'undefined'
    && typeof window.eTakip?.db?.reports?.generateRange === 'function'
  const prescriptions = Array.isArray(report?.prescriptions) ? report.prescriptions : []
  const alerts = Array.isArray(report?.alerts) ? report.alerts : []
  const statuses = report?.statuses || {}
  const summary = report?.summary || {}
  const limits = report?.limits || {}
  const hasActivity = Number(summary.prescriptionCount) > 0
    || Number(summary.auditCount) > 0
    || Number(summary.alertCount) > 0

  const resetResult = () => {
    setReport(null)
    setRequested(false)
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setRequested(true)
    setError('')
    setReport(null)

    if (!startDate || !endDate) {
      setError('Başlangıç ve bitiş tarihini seçin.')
      return
    }
    if (startDate > endDate) {
      setError('Başlangıç tarihi bitiş tarihinden sonra olamaz.')
      return
    }
    if (!integrationAvailable) return

    setLoading(true)
    try {
      const response = await window.eTakip.db.reports.generateRange({ startDate, endDate })
      if (!response?.success) throw new Error(response?.error || 'Rapor oluşturulamadı.')
      if (!response.data || typeof response.data !== 'object') throw new Error('Rapor servisi geçersiz veri döndürdü.')
      setReport(response.data)
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Rapor oluşturulamadı.')
    } finally {
      setLoading(false)
    }
  }

  const summaryCards = [
    ['Reçete', summary.prescriptionCount],
    ['Benzersiz hasta', summary.patientCount],
    ['Günlük işlemi', summary.auditCount],
    ['Uyarı', summary.alertCount],
  ]

  return (
    <div className="min-h-full bg-[#f4f6f8] px-5 py-7 text-[#17202a] sm:px-7">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .report-print-area, .report-print-area * { visibility: visible !important; }
          .report-print-area { position: absolute !important; inset: 0 !important; width: 100% !important; border: 0 !important; }
          [data-print-hide="true"] { display: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-[1400px] space-y-6">
        <header className="border-t-4 border-[#c8102e] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a50e24]">Kayıt raporları</p>
          <div className="mt-2 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.025em]">Tarih aralığı raporu</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5d6875]">
                Reçete, benzersiz hasta, durum ve işlem özeti yerel kayıtlardan hesaplanır.
              </p>
            </div>
            {report && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-10 items-center justify-center gap-2 border border-[#b5152b] bg-white px-4 text-sm font-semibold text-[#a50e24] hover:bg-[#fff4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b5152b]"
              >
                <Printer size={17} aria-hidden="true" />
                Yazdır
              </button>
            )}
          </div>
        </header>

        <section className="border border-[#d8dee6] bg-white p-5 sm:p-6" data-print-hide="true" aria-labelledby="report-query-title">
          <div className="border-b border-[#e4e7ec] pb-4">
            <h2 id="report-query-title" className="text-base font-semibold">Rapor aralığı</h2>
            <p className="mt-1 text-sm text-[#667085]">En fazla 366 günlük bir aralık seçilebilir.</p>
          </div>
          <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,16rem)_auto] sm:items-end">
            <label className="text-sm font-semibold text-[#344054]">
              Başlangıç tarihi
              <input
                type="date"
                value={startDate}
                onChange={(event) => { setStartDate(event.target.value); resetResult() }}
                disabled={loading || !integrationAvailable}
                className="mt-2 h-11 w-full border border-[#b8c0ca] bg-white px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b5152b]"
              />
            </label>
            <label className="text-sm font-semibold text-[#344054]">
              Bitiş tarihi
              <input
                type="date"
                value={endDate}
                onChange={(event) => { setEndDate(event.target.value); resetResult() }}
                disabled={loading || !integrationAvailable}
                className="mt-2 h-11 w-full border border-[#b8c0ca] bg-white px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b5152b]"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !integrationAvailable}
              className="inline-flex h-11 items-center justify-center gap-2 bg-[#b5152b] px-5 text-sm font-semibold text-white hover:bg-[#951225] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b5152b] disabled:cursor-not-allowed disabled:bg-[#aeb4bc]"
            >
              <FileBarChart2 size={17} aria-hidden="true" />
              {loading ? 'Hazırlanıyor…' : 'Raporu oluştur'}
            </button>
          </form>
        </section>

        {error && (
          <section role="alert" className="flex items-start gap-3 border border-[#e1aeb6] bg-[#fff7f8] p-5 text-[#8f1022]" data-print-hide="true">
            <AlertCircle size={20} className="mt-0.5 flex-none" aria-hidden="true" />
            <div><h2 className="text-sm font-semibold">Rapor oluşturulamadı</h2><p className="mt-1 text-sm">{error}</p></div>
          </section>
        )}

        {loading ? (
          <section role="status" className="min-h-64 animate-pulse border border-[#d8dee6] bg-white p-6">
            <span className="sr-only">Rapor hazırlanıyor.</span>
            <div className="h-4 w-48 bg-[#e8ebef]" /><div className="mt-6 h-44 bg-[#f0f2f4]" />
          </section>
        ) : report ? (
          <article className="report-print-area border border-[#d8dee6] bg-white p-5 sm:p-7" aria-labelledby="report-result-title">
            <header className="flex flex-col justify-between gap-3 border-b-2 border-[#b5152b] pb-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a50e24]">E-Takip kayıt raporu</p>
                <h2 id="report-result-title" className="mt-2 text-xl font-semibold">{formatDate(report.startDate)} – {formatDate(report.endDate)}</h2>
              </div>
              <p className="text-xs text-[#667085]">Oluşturulma: {formatDateTime(report.generatedAt)}</p>
            </header>

            <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {summaryCards.map(([label, value]) => (
                <div key={label} className="border border-[#d8dee6] bg-[#fafbfc] p-4">
                  <dt className="text-sm text-[#5d6875]">{label}</dt>
                  <dd className="mt-2 text-2xl font-semibold">{numberFormatter.format(Number(value) || 0)}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 border border-[#e5d39f] bg-[#fff9e9] px-4 py-3 text-xs leading-5 text-[#685116]">
              Bu çıktı kişisel sağlık verisi içerir. Yalnız yetkili kullanım için saklayın ve paylaşmayın.
              {(limits.prescriptionsTruncated || limits.alertsTruncated) && (
                <strong className="mt-1 block">
                  Performans için ayrıntı tabloları ilk {numberFormatter.format(Number(limits.rowLimit) || 500)} kayıtla sınırlandı; üstteki özet sayıları aralığın tamamını kapsar.
                </strong>
              )}
            </div>

            <section className="mt-7" aria-labelledby="status-summary-title">
              <div className="flex items-center gap-2"><CalendarRange size={19} className="text-[#a50e24]" aria-hidden="true" /><h3 id="status-summary-title" className="font-semibold">Durum dağılımı</h3></div>
              <dl className="mt-3 grid grid-cols-2 gap-px border border-[#d8dee6] bg-[#d8dee6] sm:grid-cols-5">
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <div key={status} className="bg-white p-4"><dt className="text-xs text-[#667085]">{label}</dt><dd className="mt-1 text-lg font-semibold">{numberFormatter.format(Number(statuses[status]) || 0)}</dd></div>
                ))}
              </dl>
            </section>

            {prescriptions.length > 0 && (
              <section className="mt-7" aria-labelledby="report-rx-title">
                <h3 id="report-rx-title" className="font-semibold">Reçete kayıtları</h3>
                <div className="mt-3 overflow-x-auto border border-[#d8dee6]">
                  <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead className="bg-[#f4f6f8] text-[#4b5563]"><tr><th className="px-4 py-3" scope="col">Barkod</th><th className="px-4 py-3" scope="col">Hasta</th><th className="px-4 py-3" scope="col">Hekim</th><th className="px-4 py-3" scope="col">Tarih</th><th className="px-4 py-3" scope="col">Durum</th></tr></thead>
                    <tbody>{prescriptions.map((item, index) => <tr key={item.id || item.barcode || index} className="border-t border-[#edf0f3]"><td className="px-4 py-3 font-mono text-xs">{item.barcode || '—'}</td><td className="px-4 py-3">{item.patient_name || '—'}</td><td className="px-4 py-3">{item.doctor_name || '—'}</td><td className="px-4 py-3">{formatDate(item.issued_date || item.created_at)}</td><td className="px-4 py-3"><span className={`inline-flex border px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{STATUS_LABELS[item.status] || item.status || 'Belirsiz'}</span></td></tr>)}</tbody>
                  </table>
                </div>
              </section>
            )}

            {alerts.length > 0 && (
              <section className="mt-7" aria-labelledby="report-alert-title">
                <div className="flex items-center gap-2"><AlertTriangle size={19} className="text-[#8f1022]" aria-hidden="true" /><h3 id="report-alert-title" className="font-semibold">Kayıtlı uyarılar</h3></div>
                <div className="mt-3 overflow-x-auto border border-[#d8dee6]">
                  <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                    <thead className="bg-[#f4f6f8] text-[#4b5563]"><tr><th className="px-4 py-3" scope="col">Seviye</th><th className="px-4 py-3" scope="col">İlaç</th><th className="px-4 py-3" scope="col">Reçete</th><th className="px-4 py-3" scope="col">Hasta</th></tr></thead>
                    <tbody>{alerts.map((item, index) => <tr key={item.id || index} className="border-t border-[#edf0f3]"><td className="px-4 py-3 font-semibold text-[#8f1022]">{item.status === 'critical' ? 'Kritik' : 'Uyarı'}</td><td className="px-4 py-3">{item.drug_name || '—'}</td><td className="px-4 py-3 font-mono text-xs">{item.barcode || item.prescription_barcode || '—'}</td><td className="px-4 py-3">{item.patient_name || '—'}</td></tr>)}</tbody>
                  </table>
                </div>
              </section>
            )}

            {!hasActivity && <div className="mt-7"><EmptyReport browserMode={false} requested /></div>}
          </article>
        ) : error ? null : <EmptyReport browserMode={!integrationAvailable} requested={requested} />}
      </div>
    </div>
  )
}
