import React from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'

const TOAST_CONFIG = {
  success: { icon: CheckCircle2, fallbackTitle: 'İşlem tamamlandı' },
  error: { icon: AlertCircle, fallbackTitle: 'İşlem tamamlanamadı' },
  warning: { icon: AlertTriangle, fallbackTitle: 'Dikkat' },
  info: { icon: Info, fallbackTitle: 'Bilgi' },
}

function ToastItem({ toast, onDismiss }) {
  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info
  const Icon = config.icon
  const type = TOAST_CONFIG[toast.type] ? toast.type : 'info'

  return (
    <div
      className={'toast toast--' + type}
      role={type === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      <span className="toast__icon" aria-hidden="true">
        <Icon size={19} strokeWidth={2} />
      </span>
      <div className="toast__content">
        <p className="toast__title">{toast.title || config.fallbackTitle}</p>
        {toast.message && <p className="toast__message">{toast.message}</p>}
      </div>
      <button
        type="button"
        className="toast__dismiss"
        onClick={() => onDismiss(toast.id)}
        aria-label="Bildirimi kapat"
      >
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  )
}

export default function Toast() {
  const { toasts, removeToast } = useApp()
  if (!toasts.length) return null

  return (
    <section className="toast-stack" aria-label="Bildirimler">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </section>
  )
}
