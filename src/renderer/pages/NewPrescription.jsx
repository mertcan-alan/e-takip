import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  FilePlus2,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react'
import { usePrescriptions } from '../context/PrescriptionContext.jsx'

const EMPTY_DOCTOR = {
  license_no: '',
  first_name: '',
  last_name: '',
  specialty: '',
  hospital: '',
}

const UNIT_OPTIONS = ['kutu', 'tablet', 'kapsül', 'şişe', 'ampul', 'tüp', 'paket', 'adet']

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function newItem(id) {
  return {
    key: id,
    name: '',
    barcode: '',
    generic_name: '',
    category: '',
    form: '',
    strength: '',
    quantity: '1',
    unit: 'kutu',
    frequency: '',
    duration_days: '',
    instructions: '',
    controlled: false,
  }
}

function unwrapResponse(response, fallback) {
  if (!response?.success) throw new Error(response?.error || fallback)
  return response.data
}

function patientName(patient) {
  return [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || 'Ad bilgisi yok'
}

function maskIdentifier(value) {
  const text = String(value || '')
  if (!text) return 'Kimlik numarası yok'
  if (text.length <= 4) return text
  return `${'•'.repeat(text.length - 4)}${text.slice(-4)}`
}

function FieldError({ id, children }) {
  if (!children) return null
  return <span id={id} className="text-xs font-medium text-[#9f1230]">{children}</span>
}

function inputA11y(error, errorId) {
  return {
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? errorId : undefined,
  }
}

export default function NewPrescription() {
  const { refreshData } = usePrescriptions()
  const integrationAvailable = Boolean(
    typeof window !== 'undefined'
      && window.eTakip?.db?.patients?.getAll
      && window.eTakip?.db?.prescriptions?.create
  )
  const nextItemId = useRef(2)
  const successHeadingRef = useRef(null)
  const [patientQuery, setPatientQuery] = useState('')
  const [patients, setPatients] = useState([])
  const [patientsLoading, setPatientsLoading] = useState(integrationAvailable)
  const [patientError, setPatientError] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [doctor, setDoctor] = useState(EMPTY_DOCTOR)
  const [prescription, setPrescription] = useState({
    issued_date: localDateKey(),
    expiry_date: '',
    diagnosis_code: '',
    notes: '',
  })
  const [items, setItems] = useState([newItem(1)])
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const hasUnsavedChanges = !result && Boolean(
    selectedPatient
    || Object.values(doctor).some((value) => value.trim())
    || prescription.issued_date !== localDateKey()
    || prescription.expiry_date
    || prescription.diagnosis_code.trim()
    || prescription.notes.trim()
    || items.length > 1
    || items.some((item) => (
      ['name', 'barcode', 'generic_name', 'category', 'form', 'strength', 'frequency', 'duration_days', 'instructions']
        .some((field) => String(item[field]).trim())
      || item.quantity !== '1'
      || item.unit !== 'kutu'
      || item.controlled
    ))
  )

  useEffect(() => {
    if (result) successHeadingRef.current?.focus()
  }, [result])

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined

    const warnBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const confirmInternalNavigation = (event) => {
      const anchor = event.target.closest?.('a[href^="#/"]')
      if (anchor && !window.confirm('Kaydedilmemiş reçete bilgileri silinecek. Sayfadan ayrılmak istiyor musunuz?')) {
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

  useEffect(() => {
    if (!integrationAvailable) {
      setPatientsLoading(false)
      return undefined
    }

    let active = true
    const timer = window.setTimeout(async () => {
      setPatientsLoading(true)
      setPatientError('')
      try {
        const response = await window.eTakip.db.patients.getAll({
          limit: 30,
          offset: 0,
          search: patientQuery.trim() || undefined,
        })
        const data = unwrapResponse(response, 'Hasta kayıtları alınamadı.')
        if (active) setPatients(Array.isArray(data?.rows) ? data.rows : [])
      } catch (requestError) {
        if (active) {
          console.error('[Yeni reçete] Hasta listesi alınamadı:', requestError)
          setPatients([])
          setPatientError('Hasta kayıtları alınamadı. Aramayı yeniden deneyin.')
        }
      } finally {
        if (active) setPatientsLoading(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [integrationAvailable, patientQuery])

  const selectedPatientName = useMemo(
    () => selectedPatient ? patientName(selectedPatient) : '',
    [selectedPatient]
  )

  const updateDoctor = (field, value) => {
    setDoctor((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [`doctor.${field}`]: '' }))
  }

  const updatePrescription = (field, value) => {
    setPrescription((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const updateItem = (index, field, value) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )))
    setErrors((current) => ({ ...current, [`items.${index}.${field}`]: '' }))
  }

  const addItem = () => {
    setItems((current) => [...current, newItem(nextItemId.current++)])
  }

  const startNewPrescription = () => {
    setPatientQuery('')
    setSelectedPatient(null)
    setDoctor(EMPTY_DOCTOR)
    setPrescription({
      issued_date: localDateKey(),
      expiry_date: '',
      diagnosis_code: '',
      notes: '',
    })
    setItems([newItem(nextItemId.current++)])
    setErrors({})
    setSubmitError('')
    setResult(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const removeItem = (index) => {
    if (items.length === 1) return
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
    setErrors({})
  }

  const validate = () => {
    const nextErrors = {}
    if (!selectedPatient?.id) nextErrors.patient_id = 'Bir hasta kaydı seçin.'

    Object.entries({
      license_no: 'Hekim sicil numarasını girin.',
      first_name: 'Hekim adını girin.',
      last_name: 'Hekim soyadını girin.',
      specialty: 'Hekim uzmanlık alanını girin.',
      hospital: 'Hekimin kurumunu girin.',
    }).forEach(([field, message]) => {
      if (!doctor[field].trim()) nextErrors[`doctor.${field}`] = message
    })

    if (!prescription.issued_date) nextErrors.issued_date = 'Reçete tarihini seçin.'
    if (prescription.expiry_date && prescription.issued_date
      && prescription.expiry_date < prescription.issued_date) {
      nextErrors.expiry_date = 'Reçete geçerlilik tarihi reçete tarihinden önce olamaz.'
    }
    if (!prescription.diagnosis_code.trim()) nextErrors.diagnosis_code = 'Tanı kodunu girin.'

    const requiredItemFields = {
      name: 'İlaç adını girin.',
      generic_name: 'Etken maddeyi girin.',
      category: 'Kategoriyi girin.',
      form: 'Farmasötik formu girin.',
      strength: 'Doz/güç bilgisini girin.',
      quantity: 'Miktarı girin.',
      unit: 'Birimi seçin.',
      frequency: 'Kullanım sıklığını girin.',
      duration_days: 'Kullanım süresini girin.',
    }

    items.forEach((item, index) => {
      Object.entries(requiredItemFields).forEach(([field, message]) => {
        if (!String(item[field]).trim()) nextErrors[`items.${index}.${field}`] = message
      })
      if (item.quantity && (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) {
        nextErrors[`items.${index}.quantity`] = 'Miktar sıfırdan büyük olmalıdır.'
      }
      if (item.duration_days && (!Number.isInteger(Number(item.duration_days)) || Number(item.duration_days) <= 0)) {
        nextErrors[`items.${index}.duration_days`] = 'Süre tam sayı ve sıfırdan büyük olmalıdır.'
      }
    })

    setErrors(nextErrors)
    const firstErrorKey = Object.keys(nextErrors)[0]
    if (firstErrorKey) {
      window.requestAnimationFrame(() => {
        document.querySelector(`[data-error-key="${firstErrorKey}"]`)?.focus()
      })
    }
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')
    if (!validate()) return
    if (!integrationAvailable) {
      setSubmitError('Tarayıcı önizlemesinde kayıt oluşturulamaz. Masaüstü uygulamasını kullanın.')
      return
    }

    const payload = {
      patient_id: selectedPatient.id,
      doctor: Object.fromEntries(
        Object.entries(doctor).map(([key, value]) => [key, value.trim()])
      ),
      issued_date: prescription.issued_date,
      expiry_date: prescription.expiry_date || null,
      diagnosis_code: prescription.diagnosis_code.trim(),
      notes: prescription.notes.trim() || null,
      items: items.map((item) => ({
        drug: {
          name: item.name.trim(),
          barcode: item.barcode.trim() || null,
          generic_name: item.generic_name.trim(),
          category: item.category.trim(),
          form: item.form.trim(),
          strength: item.strength.trim(),
          controlled: item.controlled,
        },
        quantity: Number(item.quantity),
        unit: item.unit,
        frequency: item.frequency.trim(),
        duration_days: Number(item.duration_days),
        instructions: item.instructions.trim() || null,
      })),
    }

    setSubmitting(true)
    try {
      const response = await window.eTakip.db.prescriptions.create(payload)
      const data = unwrapResponse(response, 'Reçete kaydı oluşturulamadı.')
      await refreshData()
      setResult({
        ...data,
        patientName: selectedPatientName,
        issuedDate: prescription.issued_date,
        itemCount: items.length,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (requestError) {
      console.error('[Yeni reçete] Kayıt oluşturulamadı:', requestError)
      setSubmitError(requestError.message || 'Reçete kaydı oluşturulamadı. Lütfen yeniden deneyin.')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="page-shell" aria-labelledby="new-prescription-success-title">
        <section className="border border-[#b9d5c5] border-t-4 border-t-[#26764a] bg-white px-6 py-7 shadow-[0_1px_2px_rgba(16,24,40,0.06)] sm:px-8">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 flex-none place-items-center bg-[#edf8f1] text-[#17633a]">
              <CheckCircle2 size={24} aria-hidden="true" />
            </span>
            <div>
              <p className="page-kicker !mt-0">Kayıt tamamlandı</p>
              <h1 ref={successHeadingRef} id="new-prescription-success-title" tabIndex="-1" className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#17202a]">
                Reçete yerel veri tabanına kaydedildi
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#5d6875]">
                Kayıt numarası sistem tarafından üretildi. Bu ekran klinik uygunluk değerlendirmesi veya tedavi önerisi sunmaz.
              </p>
            </div>
          </div>

          <dl className="mt-6 grid border-l border-t border-[#d8dee6] sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Reçete numarası', result.barcode || result.id || '—'],
              ['Hasta', result.patientName],
              ['Reçete tarihi', result.issuedDate],
              ['İlaç kalemi', result.itemCount],
            ].map(([term, value]) => (
              <div key={term} className="border-b border-r border-[#d8dee6] px-4 py-3">
                <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#667085]">{term}</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-[#28323d]">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn btn--primary" to="/prescriptions">Reçetelere dön</Link>
            <button className="btn btn--secondary" type="button" onClick={startNewPrescription}>
              Yeni bir reçete ekle
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page-shell" aria-labelledby="new-prescription-title">
      <header className="page-header">
        <div>
          <p className="page-kicker">Reçete yönetimi</p>
          <h1 id="new-prescription-title">Yeni reçete kaydı</h1>
          <p>Hasta, hekim ve ilaç bilgilerini eksiksiz girerek yerel kayıt oluşturun.</p>
        </div>
        <span className={`status-badge ${integrationAvailable ? 'status-badge--verified' : 'status-badge--neutral'}`}>
          {integrationAvailable ? 'Yerel veri bağlı' : 'Önizleme modu'}
        </span>
      </header>

      {!integrationAvailable && (
        <div className="mt-5 border border-[#d7c382] border-l-4 border-l-[#9a7517] bg-[#fffbef] px-4 py-3 text-sm text-[#685116]" role="status">
          Tarayıcı önizlemesinde hasta verileri yüklenmez ve kayıt kaydedilmez. Formun gerçek işleyişi masaüstü uygulamasında kullanılabilir.
        </div>
      )}

      <form className="mt-5 space-y-5" onSubmit={handleSubmit} noValidate>
        <section className="panel" aria-labelledby="patient-selection-title">
          <div className="panel-header">
            <div>
              <h2 id="patient-selection-title">1. Hasta seçimi</h2>
              <p>Kayıtlı hastayı adı, soyadı veya T.C. kimlik numarasıyla arayın.</p>
            </div>
            <UserRound size={20} className="text-[#a50e24]" aria-hidden="true" />
          </div>
          <div className="p-5">
            <label className="field max-w-2xl" htmlFor="patient-search">
              <span>Hasta ara</span>
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#697586]" size={17} aria-hidden="true" />
                <input
                  id="patient-search"
                  className="form-control !pl-10"
                  type="search"
                  value={patientQuery}
                  onChange={(event) => setPatientQuery(event.target.value)}
                  placeholder="Ad, soyad veya T.C. kimlik numarası"
                  autoComplete="off"
                  disabled={!integrationAvailable}
                  data-error-key="patient_id"
                  {...inputA11y(errors.patient_id, 'patient-selection-error')}
                />
              </span>
            </label>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-[#667085]">
              Arama en fazla 30 sonuç gösterir. Hasta görünmüyorsa daha ayırt edici bir ad, soyad veya T.C. kimlik numarası girin.
            </p>

            <div className="mt-4 max-h-64 overflow-auto border border-[#d8dee6]" aria-live="polite" aria-busy={patientsLoading}>
              {patientsLoading ? (
                <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-[#667085]" role="status">
                  <Loader2 className="spinner" size={18} aria-hidden="true" /> Hasta kayıtları yükleniyor
                </div>
              ) : patientError ? (
                <p className="min-h-28 px-5 py-8 text-center text-sm text-[#9f1230]" role="alert">{patientError}</p>
              ) : patients.length === 0 ? (
                <p className="min-h-28 px-5 py-8 text-center text-sm leading-6 text-[#667085]">
                  {integrationAvailable
                    ? patientQuery.trim() ? 'Aramayla eşleşen hasta kaydı bulunamadı.' : 'Henüz kayıtlı hasta bulunmuyor.'
                    : 'Önizleme modunda hasta listesi gösterilmez.'}
                </p>
              ) : (
                <ul className="divide-y divide-[#e4e7ec]" aria-label="Hasta arama sonuçları">
                  {patients.map((patient) => {
                    const selected = selectedPatient?.id === patient.id
                    return (
                      <li key={patient.id}>
                        <button
                          className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1d6f8a] ${selected ? 'bg-[#eef5f7]' : 'bg-white hover:bg-[#f7f9fa]'}`}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setSelectedPatient(patient)
                            setErrors((current) => ({ ...current, patient_id: '' }))
                          }}
                        >
                          <span>
                            <strong className="block text-sm font-semibold text-[#28323d]">{patientName(patient)}</strong>
                            <small className="mt-1 block text-xs text-[#667085]">T.C. {maskIdentifier(patient.tc_id)}</small>
                          </span>
                          <span className={`status-badge ${selected ? 'status-badge--verified' : 'status-badge--neutral'}`}>
                            {selected ? 'Seçildi' : 'Seç'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <FieldError id="patient-selection-error">{errors.patient_id}</FieldError>

            {selectedPatient && (
              <div className="mt-4 border-l-4 border-[#2f6f7b] bg-[#f1f6f7] px-4 py-3 text-sm text-[#40545f]">
                Seçili hasta: <strong className="text-[#263843]">{selectedPatientName}</strong>
              </div>
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="doctor-information-title">
          <div className="panel-header">
            <div>
              <h2 id="doctor-information-title">2. Hekim bilgileri</h2>
              <p>Reçeteyi düzenleyen hekime ait kayıt bilgileri.</p>
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
            {[
              ['license_no', 'Sicil numarası', 'Sicil numarası'],
              ['first_name', 'Ad', 'Hekim adı'],
              ['last_name', 'Soyad', 'Hekim soyadı'],
              ['specialty', 'Uzmanlık', 'Uzmanlık alanı'],
              ['hospital', 'Kurum', 'Kurum adı'],
            ].map(([field, label, placeholder]) => {
              const errorKey = `doctor.${field}`
              const errorId = `doctor-${field}-error`
              return (
                <label className="field" key={field}>
                  <span>{label}</span>
                  <input
                    className="form-control"
                    value={doctor[field]}
                    onChange={(event) => updateDoctor(field, event.target.value)}
                    placeholder={placeholder}
                    autoComplete="off"
                    data-error-key={errorKey}
                    {...inputA11y(errors[errorKey], errorId)}
                  />
                  <FieldError id={errorId}>{errors[errorKey]}</FieldError>
                </label>
              )
            })}
          </div>
        </section>

        <section className="panel" aria-labelledby="prescription-information-title">
          <div className="panel-header">
            <div>
              <h2 id="prescription-information-title">3. Reçete bilgileri</h2>
              <p>Tarih, tanı kodu ve kayıt notları.</p>
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <label className="field">
              <span>Reçete tarihi</span>
              <input
                className="form-control"
                type="date"
                value={prescription.issued_date}
                onChange={(event) => updatePrescription('issued_date', event.target.value)}
                data-error-key="issued_date"
                {...inputA11y(errors.issued_date, 'issued-date-error')}
              />
              <FieldError id="issued-date-error">{errors.issued_date}</FieldError>
            </label>
            <label className="field">
              <span>Reçete geçerlilik tarihi <small className="font-normal text-[#667085]">(opsiyonel)</small></span>
              <input
                className="form-control"
                type="date"
                min={prescription.issued_date || undefined}
                value={prescription.expiry_date}
                onChange={(event) => updatePrescription('expiry_date', event.target.value)}
                data-error-key="expiry_date"
                {...inputA11y(errors.expiry_date, 'expiry-date-error')}
              />
              <FieldError id="expiry-date-error">{errors.expiry_date}</FieldError>
            </label>
            <label className="field">
              <span>Tanı kodu</span>
              <input
                className="form-control uppercase"
                value={prescription.diagnosis_code}
                onChange={(event) => updatePrescription('diagnosis_code', event.target.value)}
                placeholder="Örn. ICD kodu"
                autoComplete="off"
                data-error-key="diagnosis_code"
                {...inputA11y(errors.diagnosis_code, 'diagnosis-code-error')}
              />
              <FieldError id="diagnosis-code-error">{errors.diagnosis_code}</FieldError>
            </label>
            <label className="field">
              <span>Reçete notu <small className="font-normal text-[#667085]">(opsiyonel)</small></span>
              <textarea
                className="form-control min-h-[42px] resize-y"
                rows="2"
                value={prescription.notes}
                onChange={(event) => updatePrescription('notes', event.target.value)}
                placeholder="Kayıtla ilgili açıklama"
              />
            </label>
          </div>
        </section>

        <section className="panel" aria-labelledby="drug-items-title">
          <div className="panel-header">
            <div>
              <h2 id="drug-items-title">4. İlaç kalemleri</h2>
              <p>Her ilaç için ürün ve kullanım bilgilerini ayrı kaydedin.</p>
            </div>
            <button className="btn btn--secondary" type="button" onClick={addItem}>
              <Plus size={16} aria-hidden="true" /> İlaç ekle
            </button>
          </div>
          <div className="space-y-4 bg-[#f7f9fa] p-4 sm:p-5">
            {items.map((item, index) => (
              <fieldset className="border border-[#cfd6dc] bg-white" key={item.key}>
                <legend className="sr-only">{index + 1}. ilaç kalemi</legend>
                <div className="flex items-center justify-between gap-4 border-b border-[#e1e5e8] px-4 py-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a50e24]">İlaç kalemi</p>
                    <h3 className="mt-0.5 text-sm font-semibold text-[#28323d]">{index + 1}. ürün bilgileri</h3>
                  </div>
                  <button
                    className="btn btn--danger btn-sm"
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    aria-label={`${index + 1}. ilaç kalemini kaldır`}
                  >
                    <Trash2 size={15} aria-hidden="true" /> Kaldır
                  </button>
                </div>

                <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['name', 'İlaç adı', 'Ürün adı'],
                    ['barcode', 'Barkod (opsiyonel)', 'Ürün barkodu'],
                    ['generic_name', 'Etken madde', 'Etken madde'],
                    ['category', 'Kategori', 'İlaç kategorisi'],
                    ['form', 'Farmasötik form', 'Tablet, şurup, ampul…'],
                    ['strength', 'Doz / güç', 'Örn. 500 mg'],
                  ].map(([field, label, placeholder]) => {
                    const errorKey = `items.${index}.${field}`
                    const errorId = `item-${item.key}-${field}-error`
                    return (
                      <label className="field" key={field}>
                        <span>{label}</span>
                        <input
                          className="form-control"
                          value={item[field]}
                          onChange={(event) => updateItem(index, field, event.target.value)}
                          placeholder={placeholder}
                          autoComplete="off"
                          data-error-key={errorKey}
                          {...inputA11y(errors[errorKey], errorId)}
                        />
                        <FieldError id={errorId}>{errors[errorKey]}</FieldError>
                      </label>
                    )
                  })}

                  <label className="field">
                    <span>Miktar</span>
                    <input
                      className="form-control"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                      data-error-key={`items.${index}.quantity`}
                      {...inputA11y(errors[`items.${index}.quantity`], `item-${item.key}-quantity-error`)}
                    />
                    <FieldError id={`item-${item.key}-quantity-error`}>{errors[`items.${index}.quantity`]}</FieldError>
                  </label>
                  <label className="field">
                    <span>Birim</span>
                    <select
                      className="form-control"
                      value={item.unit}
                      onChange={(event) => updateItem(index, 'unit', event.target.value)}
                      data-error-key={`items.${index}.unit`}
                      {...inputA11y(errors[`items.${index}.unit`], `item-${item.key}-unit-error`)}
                    >
                      {UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                    <FieldError id={`item-${item.key}-unit-error`}>{errors[`items.${index}.unit`]}</FieldError>
                  </label>
                  <label className="field">
                    <span>Kullanım sıklığı</span>
                    <input
                      className="form-control"
                      value={item.frequency}
                      onChange={(event) => updateItem(index, 'frequency', event.target.value)}
                      placeholder="Örn. günde 2 kez"
                      data-error-key={`items.${index}.frequency`}
                      {...inputA11y(errors[`items.${index}.frequency`], `item-${item.key}-frequency-error`)}
                    />
                    <FieldError id={`item-${item.key}-frequency-error`}>{errors[`items.${index}.frequency`]}</FieldError>
                  </label>
                  <label className="field">
                    <span>Süre (gün)</span>
                    <input
                      className="form-control"
                      type="number"
                      min="1"
                      step="1"
                      value={item.duration_days}
                      onChange={(event) => updateItem(index, 'duration_days', event.target.value)}
                      data-error-key={`items.${index}.duration_days`}
                      {...inputA11y(errors[`items.${index}.duration_days`], `item-${item.key}-duration-error`)}
                    />
                    <FieldError id={`item-${item.key}-duration-error`}>{errors[`items.${index}.duration_days`]}</FieldError>
                  </label>
                  <label className="field md:col-span-2 xl:col-span-3">
                    <span>Kullanım talimatı <small className="font-normal text-[#667085]">(opsiyonel)</small></span>
                    <textarea
                      className="form-control min-h-20 resize-y"
                      rows="2"
                      value={item.instructions}
                      onChange={(event) => updateItem(index, 'instructions', event.target.value)}
                      placeholder="Kayıtlı kullanım açıklaması"
                    />
                  </label>
                  <label className="flex min-h-[80px] cursor-pointer items-center gap-3 border border-[#d8dee6] bg-[#fafbfc] px-4 py-3 text-sm font-semibold text-[#344054]">
                    <input
                      className="h-4 w-4 accent-[#a50e24]"
                      type="checkbox"
                      checked={item.controlled}
                      onChange={(event) => updateItem(index, 'controlled', event.target.checked)}
                    />
                    Kontrole tabi ilaç
                  </label>
                </div>
              </fieldset>
            ))}
          </div>
        </section>

        <section className="panel p-5" aria-labelledby="save-prescription-title">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <h2 id="save-prescription-title" className="text-base font-semibold text-[#202a35]">Kaydı tamamla</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#667085]">
                Kaydetmeden önce bilgileri kaynak belgeyle karşılaştırın. Sistem klinik karar veya ilaç uygunluğu onayı vermez.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="btn btn--secondary" to="/prescriptions">İptal</Link>
              <button className="btn btn--primary" type="submit" disabled={submitting || !integrationAvailable}>
                {submitting
                  ? <><Loader2 className="spinner" size={17} aria-hidden="true" /> Kaydediliyor</>
                  : <><FilePlus2 size={17} aria-hidden="true" /> Reçeteyi kaydet</>}
              </button>
            </div>
          </div>

          {submitError && (
            <div className="mt-4 flex items-start gap-3 border border-[#e1aeb6] border-l-4 border-l-[#b5152b] bg-[#fff7f8] px-4 py-3 text-sm text-[#8f1022]" role="alert">
              <AlertCircle className="mt-0.5 flex-none" size={18} aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}
        </section>
      </form>
    </div>
  )
}
