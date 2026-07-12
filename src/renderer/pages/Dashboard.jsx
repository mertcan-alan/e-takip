import React from 'react'
import {
  AlertCircle,
  Archive,
  CalendarDays,
  CheckCircle2,
  Clock3,
  PackageCheck,
  FilePlus2,
  UserRoundPlus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePrescriptions } from '../context/PrescriptionContext.jsx'

const numberFormatter = new Intl.NumberFormat('tr-TR')
const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatNumber(value) {
  return numberFormatter.format(toNumber(value))
}

function formatTrendDate(value) {
  if (!value) return 'Tarih yok'

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
}

function SummaryCard({ icon: Icon, label, value, description, emphasis = 'neutral' }) {
  const emphasisClasses = {
    neutral: 'border-[#d8dee6] bg-white text-[#17202a]',
    danger: 'border-[#efc9ce] bg-[#fff8f8] text-[#a50e24]',
    warning: 'border-[#ead9ad] bg-[#fffaf0] text-[#795a08]',
  }

  return (
    <article className={`min-w-0 border p-5 ${emphasisClasses[emphasis]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#4b5563]">{label}</p>
          <p
            className="mt-3 text-3xl font-semibold tracking-[-0.035em]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatNumber(value)}
          </p>
        </div>
        <span className="flex h-10 w-10 flex-none items-center justify-center border border-current/15 bg-white/70">
          <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#667085]">{description}</p>
    </article>
  )
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Veriler yükleniyor.</span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 border border-[#d8dee6] bg-white p-5">
            <div className="h-3 w-28 bg-[#e8ebef]" />
            <div className="mt-5 h-8 w-20 bg-[#e8ebef]" />
            <div className="mt-5 h-2 w-full bg-[#f0f2f4]" />
          </div>
        ))}
      </div>
      <div className="h-72 border border-[#d8dee6] bg-white" />
    </div>
  )
}

function EmptyPanel({ title, description }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center border border-dashed border-[#cbd2da] bg-[#fafbfc] px-6 text-center">
      <Archive size={25} strokeWidth={1.5} className="text-[#697586]" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-[#28323d]">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-[#667085]">{description}</p>
    </div>
  )
}

export default function Dashboard() {
  const {
    summary,
    categories = [],
    loading = false,
    error = '',
    analyticsError = '',
    dataSource = 'browser',
  } = usePrescriptions()
  const dataError = error || analyticsError

  const hasSummary = summary && typeof summary === 'object'
  const trend = Array.isArray(summary?.trend) ? summary.trend : []
  const categoryRows = Array.isArray(categories)
    ? categories.map((item, index) => ({
      key: String(item?.category ?? item?.name ?? index),
      name: item?.category || item?.name || 'Kategorisiz',
      count: toNumber(item?.count),
    }))
    : []

  const trendMax = Math.max(...trend.map(item => toNumber(item?.count)), 1)
  const categoryMax = Math.max(...categoryRows.map(item => item.count), 1)

  const summaryCards = hasSummary
    ? [
      {
        label: 'Bugün oluşturulan',
        value: summary.total,
        description: 'Bugün veritabanına eklenen reçete sayısı.',
        icon: CalendarDays,
      },
      {
        label: 'Bugünkü kayıtlarda bekleyen',
        value: summary.pending,
        description: 'Bugün oluşturulan ve mevcut durumu beklemede olan reçeteler.',
        icon: Clock3,
      },
      {
        label: 'Bugünkü kayıtlarda onaylı',
        value: summary.verified,
        description: 'Bugün oluşturulan ve mevcut durumu onaylandı olan reçeteler.',
        icon: CheckCircle2,
      },
      {
        label: 'Bugünkü kayıtlarda teslim',
        value: summary.dispensed,
        description: 'Bugün oluşturulan ve mevcut durumu teslim edildi olan reçeteler.',
        icon: PackageCheck,
      },
    ]
    : []

  return (
    <div className="min-h-full bg-[#f4f6f8] px-5 py-7 text-[#17202a] sm:px-7">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <header className="border-t-4 border-[#c8102e] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a50e24]">Yönetim paneli</p>
          <div className="mt-2 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.025em] text-[#17202a]">Genel durum</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5d6875]">
                {dataSource === 'electron'
                  ? 'Kayıt durumu ve sistem özetleri yerel veri tabanından alınır.'
                  : 'Tarayıcı önizlemesinde yerel kayıt verisi gösterilmez.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                to="/prescriptions/new"
                className="inline-flex h-10 items-center justify-center gap-2 bg-[#b5152b] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#951225] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b5152b] focus-visible:ring-offset-2"
              >
                <FilePlus2 size={17} aria-hidden="true" />
                Yeni reçete
              </Link>
              <Link
                to="/patients"
                className="inline-flex h-10 items-center justify-center gap-2 border border-[#b8c0ca] bg-white px-4 text-sm font-semibold text-[#344054] transition-colors hover:bg-[#f4f6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b5152b] focus-visible:ring-offset-2"
              >
                <UserRoundPlus size={17} aria-hidden="true" />
                Hasta kaydı
              </Link>
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
                <h2 className="text-sm font-semibold">Veriler alınamadı</h2>
                <p className="mt-1 text-sm leading-6">{String(dataError)}</p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section aria-labelledby="summary-heading" className="space-y-3">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 id="summary-heading" className="text-lg font-semibold text-[#202a35]">Günlük özet</h2>
                  <p className="mt-1 text-sm text-[#667085]">Yalnızca sistemden dönen güncel değerler gösterilir.</p>
                </div>
              </div>

              {hasSummary ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {summaryCards.map(card => <SummaryCard key={card.label} {...card} />)}
                </div>
              ) : (
                <EmptyPanel
                  title={dataSource === 'browser' ? 'Önizlemede veri gösterilmez' : 'Günlük özet bulunamadı'}
                  description={dataSource === 'browser'
                    ? 'Günlük özet yalnızca masaüstü uygulamasındaki yerel veri tabanından alınır.'
                    : 'Yerel veri tabanı bu ekran için bir günlük özet döndürmedi.'}
                />
              )}
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.75fr)]">
              <section aria-labelledby="trend-heading" className="border border-[#d8dee6] bg-white p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4 border-b border-[#e4e7ec] pb-4">
                  <div>
                    <h2 id="trend-heading" className="text-base font-semibold text-[#202a35]">Günlük işlem eğilimi</h2>
                    <p className="mt-1 text-sm text-[#667085]">Veri bulunan günlerdeki reçete sayısı.</p>
                  </div>
                  <CalendarDays size={20} strokeWidth={1.6} className="text-[#a50e24]" aria-hidden="true" />
                </div>

                {trend.length > 0 ? (
                  <ol className="mt-5 space-y-4">
                    {trend.map((item, index) => {
                      const count = toNumber(item?.count)
                      const width = `${Math.max((count / trendMax) * 100, count > 0 ? 2 : 0)}%`

                      return (
                        <li key={`${item?.date ?? 'tarih'}-${index}`} className="grid grid-cols-[7.5rem_minmax(0,1fr)_3.5rem] items-center gap-3">
                          <span className="text-xs font-medium text-[#4b5563]">{formatTrendDate(item?.date)}</span>
                          <span className="h-2 overflow-hidden bg-[#edf0f3]" aria-hidden="true">
                            <span className="block h-full bg-[#b5152b]" style={{ width }} />
                          </span>
                          <span className="text-right text-sm font-semibold text-[#26313c]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatNumber(count)}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                ) : (
                  <div className="mt-5">
                    <EmptyPanel
                      title="Eğilim verisi yok"
                      description="Seçili dönem için günlük işlem kaydı bulunmuyor."
                    />
                  </div>
                )}
              </section>

              <section aria-labelledby="category-heading" className="border border-[#d8dee6] bg-white p-5 sm:p-6">
                <div className="border-b border-[#e4e7ec] pb-4">
                  <h2 id="category-heading" className="text-base font-semibold text-[#202a35]">İlaç kategorileri</h2>
                  <p className="mt-1 text-sm text-[#667085]">Kayıtlardaki kategori dağılımı.</p>
                </div>

                {categoryRows.length > 0 ? (
                  <ol className="mt-5 space-y-4">
                    {categoryRows.map(item => (
                      <li key={item.key}>
                        <div className="flex items-center justify-between gap-4">
                          <span className="min-w-0 truncate text-sm font-medium text-[#344054]">{item.name}</span>
                          <span className="text-sm font-semibold text-[#202a35]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatNumber(item.count)}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden bg-[#edf0f3]" aria-hidden="true">
                          <div className="h-full bg-[#b5152b]" style={{ width: `${(item.count / categoryMax) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="mt-5">
                    <EmptyPanel
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
