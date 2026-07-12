import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useApp } from './AppContext.jsx'

const PrescriptionContext = createContext(null)

const PAGE_SIZE = 20
const INITIAL_FILTERS = { status: '', search: '' }
const ALLOWED_STATUS_UPDATES = new Set(['verified', 'rejected', 'dispensed'])

function detectDataSource() {
  return typeof window !== 'undefined' && window.eTakip ? 'electron' : 'browser'
}

function databaseApiAvailable() {
  return Boolean(
    typeof window !== 'undefined' &&
    window.eTakip?.db?.prescriptions?.getAll &&
    window.eTakip?.db?.prescriptions?.getById &&
    window.eTakip?.db?.prescriptions?.update &&
    window.eTakip?.db?.analytics?.getDailySummary &&
    window.eTakip?.db?.analytics?.getTopCategories
  )
}

function assertSuccessfulResponse(response, defaultMessage) {
  if (!response?.success) {
    throw new Error(response?.error || defaultMessage)
  }
  return response.data
}

export function PrescriptionProvider({ children }) {
  const { addToast } = useApp()
  const [dataSource] = useState(detectDataSource)
  const [prescriptions, setPrescriptions] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedRx, setSelectedRx] = useState(null)
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(dataSource === 'electron')
  const [analyticsLoading, setAnalyticsLoading] = useState(dataSource === 'electron')
  const [detailLoading, setDetailLoading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(null)
  const [error, setError] = useState(null)
  const [detailError, setDetailError] = useState(null)
  const [analyticsError, setAnalyticsError] = useState(null)
  const [summary, setSummary] = useState(null)
  const [categories, setCategories] = useState([])
  const [filters, setFilterState] = useState(INITIAL_FILTERS)
  const [page, setPage] = useState(0)
  const [interactions, setInteractions] = useState([])

  const listRequestRef = useRef(0)
  const detailRequestRef = useRef(0)
  const analyticsRequestRef = useRef(0)

  const clearSelection = useCallback(() => {
    detailRequestRef.current += 1
    setSelectedId(null)
    setSelectedRx(null)
    setInteractions([])
    setDetailError(null)
    setDetailLoading(false)
  }, [])

  const setFilters = useCallback((nextFilters) => {
    listRequestRef.current += 1
    if (dataSource === 'electron') setListLoading(true)
    setFilterState((current) => {
      const resolved = typeof nextFilters === 'function'
        ? nextFilters(current)
        : nextFilters

      return {
        status: resolved?.status ?? current.status,
        search: resolved?.search ?? current.search,
      }
    })
    setPage(0)
    clearSelection()
  }, [clearSelection, dataSource])

  const fetchPrescriptions = useCallback(async () => {
    const requestId = ++listRequestRef.current

    if (dataSource === 'browser') {
      setPrescriptions([])
      setTotal(0)
      setError(null)
      setListLoading(false)
      return true
    }

    if (!databaseApiAvailable()) {
      setPrescriptions([])
      setTotal(0)
      setError('Yerel veri servisine erişilemiyor.')
      setListLoading(false)
      return false
    }

    setListLoading(true)
    setError(null)

    try {
      const response = await window.eTakip.db.prescriptions.getAll({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status: filters.status || undefined,
        search: filters.search.trim() || undefined,
      })
      const data = assertSuccessfulResponse(response, 'Reçete kayıtları alınamadı.')

      if (requestId !== listRequestRef.current) return false

      const rows = Array.isArray(data?.rows) ? data.rows : []
      const rowCount = Number(data?.total)

      setPrescriptions(rows)
      setTotal(Number.isFinite(rowCount) && rowCount >= 0 ? rowCount : 0)
      return true
    } catch (requestError) {
      if (requestId !== listRequestRef.current) return false

      console.error('[Reçeteler] Liste alınamadı:', requestError)
      setPrescriptions([])
      setTotal(0)
      setError('Reçete kayıtları alınamadı. Lütfen yeniden deneyin.')
      addToast({
        type: 'error',
        title: 'Veri bağlantısı hatası',
        message: 'Reçete kayıtları alınamadı.',
      })
      return false
    } finally {
      if (requestId === listRequestRef.current) setListLoading(false)
    }
  }, [addToast, dataSource, filters.search, filters.status, page])

  const fetchAnalytics = useCallback(async () => {
    const requestId = ++analyticsRequestRef.current

    if (dataSource === 'browser') {
      setSummary(null)
      setCategories([])
      setAnalyticsError(null)
      setAnalyticsLoading(false)
      return true
    }

    if (!databaseApiAvailable()) {
      setSummary(null)
      setCategories([])
      setAnalyticsError('Günlük özet servisine erişilemiyor.')
      setAnalyticsLoading(false)
      return false
    }

    setAnalyticsLoading(true)
    setAnalyticsError(null)

    try {
      const [summaryResponse, categoriesResponse] = await Promise.all([
        window.eTakip.db.analytics.getDailySummary(),
        window.eTakip.db.analytics.getTopCategories(),
      ])
      const dailySummary = assertSuccessfulResponse(
        summaryResponse,
        'Günlük özet alınamadı.'
      )
      const topCategories = assertSuccessfulResponse(
        categoriesResponse,
        'İlaç grupları alınamadı.'
      )

      if (requestId !== analyticsRequestRef.current) return false

      setSummary(dailySummary && typeof dailySummary === 'object' ? dailySummary : null)
      setCategories(Array.isArray(topCategories) ? topCategories : [])
      return true
    } catch (requestError) {
      if (requestId !== analyticsRequestRef.current) return false

      console.error('[Reçeteler] Özet alınamadı:', requestError)
      setSummary(null)
      setCategories([])
      setAnalyticsError('Günlük özet bilgileri alınamadı.')
      return false
    } finally {
      if (requestId === analyticsRequestRef.current) setAnalyticsLoading(false)
    }
  }, [dataSource])

  const refreshData = useCallback(async () => {
    const [listUpdated, analyticsUpdated] = await Promise.all([
      fetchPrescriptions(),
      fetchAnalytics(),
    ])
    return Boolean(listUpdated && analyticsUpdated)
  }, [fetchAnalytics, fetchPrescriptions])

  useEffect(() => {
    const delay = filters.search.trim() ? 250 : 0
    const timer = window.setTimeout(fetchPrescriptions, delay)
    return () => window.clearTimeout(timer)
  }, [fetchPrescriptions, filters.search])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  const selectPrescription = useCallback(async (id) => {
    if (!id) {
      clearSelection()
      return true
    }

    setSelectedId(id)
    setSelectedRx(null)
    setInteractions([])
    setDetailError(null)

    if (dataSource !== 'electron' || !databaseApiAvailable()) {
      setDetailError('Reçete ayrıntısı yalnızca yerel veri bağlantısıyla görüntülenebilir.')
      return false
    }

    const requestId = ++detailRequestRef.current
    setDetailLoading(true)

    try {
      const response = await window.eTakip.db.prescriptions.getById(id)
      const detail = assertSuccessfulResponse(response, 'Reçete ayrıntısı alınamadı.')

      if (requestId !== detailRequestRef.current) return false
      if (!detail) throw new Error('Reçete kaydı bulunamadı.')

      setSelectedRx(detail)
      setInteractions(Array.isArray(detail.interactions) ? detail.interactions : [])
      return true
    } catch (requestError) {
      if (requestId !== detailRequestRef.current) return false

      console.error('[Reçeteler] Ayrıntı alınamadı:', requestError)
      setSelectedRx(null)
      setInteractions([])
      setDetailError('Reçete ayrıntısı alınamadı. Lütfen yeniden deneyin.')
      addToast({
        type: 'error',
        title: 'Ayrıntı yüklenemedi',
        message: 'Seçilen reçetenin bilgileri alınamadı.',
      })
      return false
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false)
    }
  }, [addToast, clearSelection, dataSource])

  const updateStatus = useCallback(async (id, status) => {
    if (!id || !ALLOWED_STATUS_UPDATES.has(status)) {
      addToast({
        type: 'error',
        title: 'İşlem reddedildi',
        message: 'Geçersiz reçete durumu seçildi.',
      })
      return false
    }

    if (dataSource !== 'electron' || !databaseApiAvailable()) {
      addToast({
        type: 'error',
        title: 'İşlem yapılamadı',
        message: 'Durum değişikliği için yerel veri bağlantısı gereklidir.',
      })
      return false
    }

    setUpdatingStatus(id)

    try {
      const response = await window.eTakip.db.prescriptions.update(id, { status })
      assertSuccessfulResponse(response, 'Durum değişikliği kaydedilemedi.')

      await Promise.all([
        fetchPrescriptions(),
        fetchAnalytics(),
        selectPrescription(id),
      ])

      const labels = {
        verified: 'onaylandı',
        rejected: 'reddedildi',
        dispensed: 'teslim edildi',
      }
      addToast({
        type: status === 'rejected' ? 'info' : 'success',
        title: 'İşlem kaydedildi',
        message: `Reçete ${labels[status]}.`,
      })
      return true
    } catch (requestError) {
      console.error('[Reçeteler] Durum güncellenemedi:', requestError)
      addToast({
        type: 'error',
        title: 'Kayıt başarısız',
        message: 'Reçete durumu kaydedilemedi. Mevcut durum korunuyor.',
      })
      return false
    } finally {
      setUpdatingStatus(null)
    }
  }, [addToast, dataSource, fetchAnalytics, fetchPrescriptions, selectPrescription])

  const value = {
    prescriptions,
    total,
    loading: listLoading || analyticsLoading,
    listLoading,
    error: error || analyticsError,
    listError: error,
    filters,
    setFilters,
    page,
    setPage,
    PAGE_SIZE,
    fetchPrescriptions,
    refreshData,
    summary,
    categories,
    analyticsError,
    analyticsLoading,
    dataSource,
    selectedId,
    selectedRx,
    detailLoading,
    detailError,
    selectPrescription,
    updateStatus,
    updatingStatus,
    interactions,
  }

  return (
    <PrescriptionContext.Provider value={value}>
      {children}
    </PrescriptionContext.Provider>
  )
}

export function usePrescriptions() {
  const context = useContext(PrescriptionContext)
  if (!context) {
    throw new Error('usePrescriptions, PrescriptionProvider içinde kullanılmalıdır.')
  }
  return context
}
