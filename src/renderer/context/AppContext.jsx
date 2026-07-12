import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

const AppContext = createContext(null)

function normalizeUser(user) {
  if (user && typeof user === 'object') {
    return {
      ...user,
      username: user.username || user.name || 'admin',
      displayName: user.displayName || user.fullName || 'Sistem Yöneticisi',
      role: user.role || 'Yönetici',
    }
  }

  return {
    username: String(user || 'admin'),
    displayName: 'Sistem Yöneticisi',
    role: 'Yönetici',
  }
}

export function AppProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const toastIdRef = useRef(0)
  const toastTimersRef = useRef(new Map())

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)

  const removeToast = useCallback((id) => {
    const timer = toastTimersRef.current.get(id)
    if (timer) clearTimeout(timer)
    toastTimersRef.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback(({
    type = 'info',
    title,
    message,
    duration = 4500,
  }) => {
    const id = ++toastIdRef.current
    const safeDuration = Math.max(2500, Number(duration) || 4500)

    setToasts((current) => [
      ...current.slice(-3),
      { id, type, title, message, duration: safeDuration },
    ])

    const timer = setTimeout(() => removeToast(id), safeDuration)
    toastTimersRef.current.set(id, timer)
    return id
  }, [removeToast])

  useEffect(() => () => {
    toastTimersRef.current.forEach((timer) => clearTimeout(timer))
    toastTimersRef.current.clear()
  }, [])

  const login = useCallback((authenticatedUser) => {
    setUser(normalizeUser(authenticatedUser))
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.eTakip?.auth?.logout) {
        await window.eTakip.auth.logout()
      }
    } catch (error) {
      console.warn('Harici oturum kapatma işlemi tamamlanamadı:', error)
    } finally {
      setIsAuthenticated(false)
      setUser(null)
      setToasts([])
    }
  }, [])

  const value = {
    toasts,
    addToast,
    removeToast,
    isAuthenticated,
    user,
    login,
    logout,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within <AppProvider>')
  return context
}
