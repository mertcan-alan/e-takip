import React, { useEffect, useState } from 'react'
import { FileCheck2, LogOut, Minus, Square, X } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Genel Bakış' },
  { to: '/prescriptions', label: 'Reçeteler' },
  { to: '/patients', label: 'Hastalar' },
  { to: '/analytics', label: 'İstatistikler' },
  { to: '/reports', label: 'Raporlar' },
  { to: '/audit-logs', label: 'İşlem Günlüğü' },
]

const ROUTE_TITLES = {
  '/dashboard': 'Genel Bakış',
  '/prescriptions': 'Reçeteler',
  '/prescriptions/new': 'Yeni Reçete',
  '/patients': 'Hasta Kayıtları',
  '/analytics': 'İstatistikler',
  '/reports': 'Raporlar',
  '/audit-logs': 'İşlem Günlüğü',
}

export default function TitleBar() {
  const { user, logout } = useApp()
  const location = useLocation()
  const [isMaximized, setIsMaximized] = useState(false)
  const isElectron = typeof window !== 'undefined' && Boolean(window.eTakip?.window)
  const currentTitle = ROUTE_TITLES[location.pathname] || 'Yönetim Paneli'

  useEffect(() => {
    if (!isElectron) return undefined

    let cleanup
    window.eTakip.window.isMaximized?.().then?.(setIsMaximized).catch?.(() => {})
    cleanup = window.eTakip.window.onMaximizedChange?.(setIsMaximized)

    return typeof cleanup === 'function' ? cleanup : undefined
  }, [isElectron])

  const displayName = user?.displayName || user?.username || 'Sistem Yöneticisi'
  const username = user?.username || 'admin'

  return (
    <header className="site-header">
      <div id="app-drag-region" className="window-strip">
        <div className="window-strip__title">
          <span>E-Takip</span>
          <span className="window-strip__separator" aria-hidden="true">•</span>
          <span>{currentTitle}</span>
        </div>

        {isElectron && (
          <div className="window-controls" aria-label="Pencere denetimleri">
            <button
              type="button"
              className="window-control"
              onClick={() => window.eTakip.window.minimize()}
              aria-label="Pencereyi küçült"
            >
              <Minus size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="window-control"
              onClick={() => window.eTakip.window.maximize()}
              aria-label={isMaximized ? 'Pencereyi önceki boyutuna getir' : 'Pencereyi büyüt'}
            >
              <Square size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="window-control window-control--close"
              onClick={() => window.eTakip.window.close()}
              aria-label="Uygulamayı kapat"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="primary-header">
        <div className="app-identity" aria-label="E-Takip Reçete Yönetim Sistemi">
          <span className="app-identity__mark" aria-hidden="true">
            <FileCheck2 size={22} strokeWidth={1.8} />
          </span>
          <span className="app-identity__copy">
            <strong>E-Takip</strong>
            <small>Reçete Yönetim Sistemi</small>
          </span>
        </div>

        <nav className="primary-nav" aria-label="Ana menü">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (
                'primary-nav__link' + (isActive ? ' primary-nav__link--active' : '')
              )}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="account-area">
          <div className="account-summary">
            <span className="account-summary__avatar" aria-hidden="true">
              {username.charAt(0).toLocaleUpperCase('tr-TR')}
            </span>
            <span className="account-summary__copy">
              <strong>{displayName}</strong>
              <small>{user?.role || 'Yönetici'} · {username}</small>
            </span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm account-logout"
            onClick={() => void logout()}
          >
            <LogOut size={16} aria-hidden="true" />
            Çıkış Yap
          </button>
        </div>
      </div>
    </header>
  )
}
