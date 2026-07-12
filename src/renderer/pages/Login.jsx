import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  AlertCircle,
  FileCheck2,
  Loader2,
  LockKeyhole,
  UserRound,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin'

export default function Login() {
  const { login } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const errorRef = useRef(null)

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  const clearError = () => {
    if (error) setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const normalizedUsername = username.trim()
    if (!normalizedUsername || !password) {
      setError('Kullanıcı adı ve şifre alanlarını doldurun.')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (normalizedUsername !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        setError('Kullanıcı adı veya şifre hatalı. Bilgileri kontrol edip yeniden deneyin.')
        return
      }

      if (typeof window !== 'undefined' && window.eTakip?.auth?.login) {
        const response = await window.eTakip.auth.login(normalizedUsername, password)
        if (!response?.success) {
          setError('Oturum açılamadı. Kullanıcı bilgilerinizi kontrol edip yeniden deneyin.')
          return
        }
        login(response.data?.user)
      } else {
        login({
          username: ADMIN_USERNAME,
          displayName: 'Sistem Yöneticisi',
          role: 'Yönetici',
        })
      }
    } catch {
      setError('Oturum açılamadı. Uygulama bağlantısını kontrol edip yeniden deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-page__accent" aria-hidden="true" />

      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card__brand" aria-hidden="true">
          <FileCheck2 size={26} strokeWidth={1.8} />
        </div>

        <p className="login-card__kicker">E-Takip Yönetim Paneli</p>
        <h1 id="login-title" className="login-card__title">Yetkili kullanıcı girişi</h1>
        <p className="login-card__description">
          Yönetim ekranına erişmek için kullanıcı bilgilerinizi girin.
        </p>

        <form className="login-form" onSubmit={handleSubmit} noValidate aria-busy={loading}>
          {error && (
            <div
              ref={errorRef}
              className="form-alert form-alert--error"
              role="alert"
              aria-live="assertive"
              tabIndex={-1}
            >
              <AlertCircle size={18} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="form-field">
            <label className="form-label" htmlFor="login-username">Kullanıcı adı</label>
            <div className="form-control-wrap">
              <UserRound className="form-control-icon" size={18} aria-hidden="true" />
              <input
                id="login-username"
                name="username"
                type="text"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value)
                  clearError()
                }}
                className="form-control form-control--with-icon"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Kullanıcı adınızı girin…"
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="login-password">Şifre</label>
            <div className="form-control-wrap">
              <LockKeyhole className="form-control-icon" size={18} aria-hidden="true" />
              <input
                id="login-password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  clearError()
                }}
                className="form-control form-control--with-icon"
                autoComplete="current-password"
                placeholder="Şifrenizi girin…"
                required
              />
            </div>
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="spinner" size={18} aria-hidden="true" />
                Giriş yapılıyor…
              </>
            ) : (
              <>
                Giriş Yap
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="login-credentials" aria-label="Yerel yönetici hesabı">
          <span>Yerel yönetici hesabı</span>
          <code>admin / admin</code>
        </div>
      </section>

      <p className="login-page__footer">
        Bu ekran yalnızca yetkili yerel kullanıcıların erişimi içindir.
      </p>
    </main>
  )
}
