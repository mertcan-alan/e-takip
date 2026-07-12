import React from 'react'
import {
  AlertCircle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Database,
  PackageCheck,
  AlertTriangle,
} from 'lucide-react'
import { usePrescriptions } from '../context/PrescriptionContext.jsx'

const numberFormatter = new Intl.NumberFormat('tr-TR')
const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatNumber(value) {
  return numberFormatter.format(toNumber(value))
}

function formatDate(value) {
  if (!value) return 'Tarih yok'

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Analiz verileri yükleniyor.</span>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-40 border border-[#d8dee6] bg-white p-5">
            <div className="h-3 w-32 bg-[#e8ebef]" />
            <div className="mt-6 h-8 w-20 bg-[#e8ebef]" />
            <div className="mt-6 h-2 w-full bg-[#f0f2f4]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="h-80 border border-[#d8dee6] bg-white" />
        <div className="h-80 border border-[#d8dee6] bg-white" />
      </div>
    </div>
  )
}

function EmptyBlock({ title, description }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center border border-dashed border-[#cbd2da] bg-[#fafbfc] px-6 text-center">
      <Database size={24} strokeWidth={1.5} className="text-[#697586]" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-[#28323d]">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-[#667085]">{description}</p>
    </div>
  )
}

function StatusRow({ icon: Icon, label, value, total, colorClass, barClass }) {
  const numericValue = toNumber(value)
  const percentage = total > 0 ? Math.min((numericValue / total) * 100, 100) : 0

  return (
    <li className="border-b border-[#edf0f3] py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <span className="flex min-w-0 items-center gap-3 text-sm font-medium text-[#344054]">
          <Icon size={18} strokeWidth={1.7} className={colorClass} aria-hidden="true" />
          {label}
        </span>
        <span className="text-base font-semibold text-[#202a35]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatNumber(numericValue)}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden bg-[#edf0f3]" aria-hidden="true">
        <div className={`h-full ${barClass}`} style={{ width: `${percentage}%` }} />
      </div>
    </li>
  )
}

export default function Analytics() {
  const {
    total = 0,
    summary,
    categories = [],
    loading = false,
    error = '',
    analyticsError = '',
    dataSource = 'browser',
  } = usePrescriptions()
  const dataError = error || analyticsError

  const hasSummary = summary && typeof summary === 'object'
  const dailyTotal = hasSummary ? toNumber(summary.total) : 0
  const trend = Array.isArray(summary?.trend) ? summary.trend : []
  const categoryRows = Array.isArray(categories)
    ? categories.map((item, index) => ({
      key: String(item?.category ?? item?.name ?? index),
      name: item?.category || item?.name || 'Kategorisiz',
      count: toNumber(item?.count),
    }))
    : []
  const categoryTotal = categoryRows.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="min-h-full bg-[#f4f6f8] px-5 py-7 text-[#17202a] sm:px-7">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <header className="border-t-4 border-[#c8102e] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a50e24]">Kayıt analizi</p>
          <div className="mt-2 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.025em] text-[#17202a]">Analiz ve dağılımlar</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5d6875]">
                {dataSource === 'electron'
                  ? 'Bu sayfa yalnızca yerel veri tabanındaki güncel özet ve dağılımları gösterir.'
                  : 'Tarayıcı önizlemesinde analiz verisi gösterilmez.'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#5d6875]">
              <Database size={16} strokeWidth={1.7} aria-hidden="true" />
              <span>
                Toplam kayıt: <strong className="font-semibold text-[#17202a]">{formatNumber(total)}</strong>
              </span>
            </div>
          </div>
        </header>

        {loading ? (
          <LoadingState />
        ) : dataError ? (
          <section role="alert" className="border border-[#e1aeb6] bg-[#fff7f8] p-5 text-[#8f1022]">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} strokeWidth={1.8} className="mt-0.5 flex-none" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold">Analiz verileri alınamadı</h2>
                <p className="mt-1 text-sm leading-6">{String(dataError)}</p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
              <section aria-labelledby="status-heading" className="border border-[#d8dee6] bg-white p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4 border-b border-[#e4e7ec] pb-4">
                  <div>
                    <h2 id="status-heading" className="text-base font-semibold text-[#202a35]">Bugün oluşturulanların durum dağılımı</h2>
                    <p className="mt-1 text-sm text-[#667085]">
                      Günlük toplam: <strong className="font-semibold text-[#344054]">{hasSummary ? formatNumber(dailyTotal) : '—'}</strong>
                    </p>
                  </div>
                  <BarChart3 size={21} strokeWidth={1.6} className="text-[#a50e24]" aria-hidden="true" />
                </div>

                {hasSummary ? (
                  <ul className="mt-1">
                    <StatusRow
                      icon={Clock3}
                      label="Beklemede"
                      value={summary.pending}
                      total={dailyTotal}
                      colorClass="text-[#8a6508]"
                      barClass="bg-[#b48716]"
                    />
                    <StatusRow
                      icon={CheckCircle2}
                      label="Onaylı durumda"
                      value={summary.verified}
                      total={dailyTotal}
                      colorClass="text-[#17633a]"
                      barClass="bg-[#26764a]"
                    />
                    <StatusRow
                      icon={PackageCheck}
                      label="Teslim durumunda"
                      value={summary.dispensed}
                      total={dailyTotal}
                      colorClass="text-[#315c74]"
                      barClass="bg-[#47758e]"
                    />
                  </ul>
                ) : (
                  <div className="mt-5">
                    <EmptyBlock
                      title="Durum özeti bulunamadı"
                      description="Veri kaynağı bu dönem için bir durum özeti döndürmedi."
                    />
                  </div>
                )}
              </section>

              <aside aria-labelledby="alert-heading" className="border border-[#d8dee6] bg-white p-5 sm:p-6">
                <div className="border-b border-[#e4e7ec] pb-4">
                  <h2 id="alert-heading" className="text-base font-semibold text-[#202a35]">Kayıtlı etkileşim uyarıları</h2>
                  <p className="mt-1 text-sm leading-5 text-[#667085]">Yalnız yerel etkileşim tablosuyla eşleşen bugünkü ilaç kalemleri; klinik güvenlik sonucu değildir.</p>
                </div>

                {hasSummary ? (
                  <dl className="mt-5 space-y-4">
                    <div className="border border-[#efc9ce] bg-[#fff8f8] p-4">
                      <dt className="flex items-center gap-2 text-sm font-medium text-[#8f1022]">
                        <AlertCircle size={18} strokeWidth={1.7} aria-hidden="true" />
                        Kritik kalem
                      </dt>
                      <dd className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#8f1022]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatNumber(summary.critical)}
                      </dd>
                    </div>
                    <div className="border border-[#ead9ad] bg-[#fffaf0] p-4">
                      <dt className="flex items-center gap-2 text-sm font-medium text-[#795a08]">
                        <AlertTriangle size={18} strokeWidth={1.7} aria-hidden="true" />
                        Uyarı kalemi
                      </dt>
                      <dd className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#795a08]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatNumber(summary.warnings)}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <div className="mt-5">
                    <EmptyBlock
                      title="Uyarı özeti bulunamadı"
                      description="Kritik ve uyarı sayılarına ulaşılamadı."
                    />
                  </div>
                )}
              </aside>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <section aria-labelledby="trend-table-heading" className="border border-[#d8dee6] bg-white p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4 border-b border-[#e4e7ec] pb-4">
                  <div>
                    <h2 id="trend-table-heading" className="text-base font-semibold text-[#202a35]">Günlük işlem kayıtları</h2>
                    <p className="mt-1 text-sm text-[#667085]">Özet servisinin döndürdüğü tarih ve adetler.</p>
                  </div>
                  <CalendarRange size={20} strokeWidth={1.6} className="text-[#a50e24]" aria-hidden="true" />
                </div>

                {trend.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <caption className="sr-only">Günlere göre işlem sayıları</caption>
                      <thead>
                        <tr className="border-b border-[#d8dee6] text-[#5d6875]">
                          <th scope="col" className="px-2 py-3 font-semibold">Tarih</th>
                          <th scope="col" className="px-2 py-3 text-right font-semibold">Kayıt sayısı</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trend.map((item, index) => (
                          <tr key={`${item?.date ?? 'tarih'}-${index}`} className="border-b border-[#edf0f3] last:border-b-0">
                            <td className="px-2 py-3 text-[#344054]">{formatDate(item?.date)}</td>
                            <td className="px-2 py-3 text-right font-semibold text-[#202a35]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatNumber(item?.count)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-5">
                    <EmptyBlock
                      title="Günlük veri yok"
                      description="Seçili dönem için günlük işlem kaydı bulunmuyor."
                    />
                  </div>
                )}
              </section>

              <section aria-labelledby="category-table-heading" className="border border-[#d8dee6] bg-white p-5 sm:p-6">
                <div className="border-b border-[#e4e7ec] pb-4">
                  <h2 id="category-table-heading" className="text-base font-semibold text-[#202a35]">Kategori dağılımı</h2>
                  <p className="mt-1 text-sm text-[#667085]">
                    Kategorilerdeki toplam kayıt: <strong className="font-semibold text-[#344054]">{formatNumber(categoryTotal)}</strong>
                  </p>
                </div>

                {categoryRows.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <caption className="sr-only">İlaç kategorilerine göre kayıt dağılımı</caption>
                      <thead>
                        <tr className="border-b border-[#d8dee6] text-[#5d6875]">
                          <th scope="col" className="px-2 py-3 font-semibold">Kategori</th>
                          <th scope="col" className="px-2 py-3 text-right font-semibold">Adet</th>
                          <th scope="col" className="px-2 py-3 text-right font-semibold">Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryRows.map(item => {
                          const percentage = categoryTotal > 0 ? (item.count / categoryTotal) * 100 : 0

                          return (
                            <tr key={item.key} className="border-b border-[#edf0f3] last:border-b-0">
                              <td className="max-w-64 truncate px-2 py-3 font-medium text-[#344054]">{item.name}</td>
                              <td className="px-2 py-3 text-right font-semibold text-[#202a35]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {formatNumber(item.count)}
                              </td>
                              <td className="px-2 py-3 text-right text-[#5d6875]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                %{numberFormatter.format(Number(percentage.toFixed(1)))}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-5">
                    <EmptyBlock
                      title="Kategori verisi yok"
                      description="Henüz kategori dağılımı oluşturacak kayıt bulunmuyor."
                    />
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
